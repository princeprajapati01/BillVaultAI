import os
import base64
import json
import logging
import re
from typing import Dict, Any, Optional, List, Tuple, NamedTuple
from app.core.config import (
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_MODEL,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT_SECONDS,
    OLLAMA_HEALTHCHECK_TIMEOUT_SECONDS,
)
from app.rules.patterns import PATTERNS
from app.pipeline.semantic_engine import (
    resolve_payment_status,
    normalize_date,
    normalize_gstin,
    normalize_invoice_number,
    _reconcile_amount_fields,
    _extract_currency_from_ocr,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Retail / POS receipt helpers (DMart, mall, supermarket slips)
# ---------------------------------------------------------------------------

_RETAIL_BILL_NO = re.compile(
    r'(?:bill\s*no\.?|invoice\s*no\.?|voucher\s*no\.?|bill\s*#)\s*:?\s*([A-Z0-9][A-Z0-9\-/]{4,})',
    re.IGNORECASE,
)
_RETAIL_BILL_DASH = re.compile(r'\b(\d{6,12}-\d{4,8})\b')
_ISO_DATE = re.compile(r'\b(\d{4}-\d{2}-\d{2})[T\s]')
_LABELED_AMOUNT = re.compile(
    r'(?:txn\s*amount|amount\s*received|grand\s*total|total\s*invoice\s*amount|'
    r'net\s*amount|total\s*amount|g\.?\s*total)\s*:?\s*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)',
    re.IGNORECASE,
)
_POS_NOISE_LINE = re.compile(
    r'\b(mid|batch\s*id|roc|tid|terminal|merchant\s*id|approval|rrn|stan|auth)\b',
    re.IGNORECASE,
)
_GSTIN_VALID = re.compile(
    r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Subtotal extraction — label-based candidates + mathematical validation.
#
# FIXED: subtotal was previously derived as "the largest OCR amount smaller
# than the grand total", overridden only if a line happened to contain the
# word 'taxable', 'sub total', or 'subtotal'. That guessed right by luck on
# simple invoices and silently guessed wrong whenever a savings/MRP/rounding
# line, a line-item amount, or an unrelated number happened to be the
# largest sub-grand-total value on the page. The functions below replace
# that entirely with: (1) only ever consider amounts on lines carrying an
# actual subtotal-family label, (2) never consider amounts on lines that are
# clearly something else (MRP Total, Savings, Discount, Round Off, any
# *-Total tax line), (3) validate every candidate against
# subtotal + tax ≈ grand_total when tax is known, and (4) return None rather
# than a guess when nothing scores above a minimum confidence bar.
# ---------------------------------------------------------------------------

class _SubtotalCandidate(NamedTuple):
    value: float
    label: str
    base_confidence: int
    line: str


# Labels that genuinely indicate a subtotal / pre-tax amount. Ordered by how
# unambiguous the label is; "Net Amount" and "Basic Amount" occasionally
# refer to the grand total on some non-GST templates, so they start lower
# and rely on the math check in `_score_subtotal_candidate` to confirm them.
_SUBTOTAL_LABEL_PATTERNS: Tuple[Tuple[re.Pattern, int, str], ...] = (
    (re.compile(r'\bsub[\s\-]*total\b', re.IGNORECASE), 95, 'Sub Total'),
    (re.compile(r'\btaxable\s*value\b', re.IGNORECASE), 92, 'Taxable Value'),
    (re.compile(r'\btaxable\s*amount\b', re.IGNORECASE), 92, 'Taxable Amount'),
    (re.compile(r'\bassessable\s*value\b', re.IGNORECASE), 90, 'Assessable Value'),
    (re.compile(r'\bbasic\s*amount\b', re.IGNORECASE), 75, 'Basic Amount'),
    (re.compile(r'\bnet\s*amount\b', re.IGNORECASE), 70, 'Net Amount'),
)

# Lines matching any of these must NEVER be treated as a subtotal candidate,
# even though some of them also contain amount-like numbers.
_SUBTOTAL_EXCLUDED_LABEL_PATTERN = re.compile(
    r'\b(mrp\s*total|total\s*mrp|savings?|you\s*saved|you\s*save|discount|'
    r'round\s*off|roundoff|tax\s*total|total\s*tax|cgst\s*total|total\s*cgst|'
    r'sgst\s*total|total\s*sgst|igst\s*total|total\s*igst)\b',
    re.IGNORECASE,
)

# Phrases that contain the bare word "total" but are never the grand total.
# Kept in sync with the equivalent list in semantic_engine.py's
# _is_tax_or_discount_total (audit Bug #3/#5).
_NON_GRAND_TOTAL_PHRASES = (
    'total tax', 'tax total', 'total tax amount',
    'total cgst', 'cgst total', 'total sgst', 'sgst total',
    'total igst', 'igst total', 'total cess', 'cess total',
    'total discount', 'discount total', 'total gst', 'gst total',
    'total savings', 'savings total', 'you saved', 'you save',
    'mrp total', 'total mrp', 'total items', 'item total',
    'round off', 'roundoff',
)

# Scoped to actual supermarket/grocery brand terms only. Bare words like
# 'mart', 'retail', 'store', 'shop', 'bazaar', 'mall' were removed since
# they substring-match a huge range of non-grocery vendor names.
_RETAIL_VENDOR_KWS = (
    'dmart', 'd mart', 'avenue supermarts', 'reliance fresh', 'reliance smart',
    'big bazaar', 'more retail', 'more supermarket', 'spar', 'supermart',
    'supermarket', 'hypermarket', 'grocery', 'grocer',
)


def encode_image_to_base64(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def clean_and_parse_json(text: str) -> dict:
    text_clean = text.strip()
    if text_clean.startswith("```"):
        lines = text_clean.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text_clean = "\n".join(lines).strip()
    if text_clean.lower().startswith("json"):
        text_clean = text_clean[4:].strip()

    text_clean = re.sub(r"/\*.*?\*/", "", text_clean, flags=re.DOTALL)
    text_clean = re.sub(r"//.*?\n", "\n", text_clean)
    text_clean = re.sub(r",\s*([\]}])", r"\1", text_clean)

    try:
        return json.loads(text_clean)
    except json.JSONDecodeError:
        start = text_clean.find('{')
        end = text_clean.rfind('}')
        if start != -1 and end != -1:
            candidate = text_clean[start:end + 1]
            candidate = re.sub(r",\s*([\]}])", r"\1", candidate)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        fallback = {}
        pattern = r'"([^"]+)":\s*(?:"([^"]*)"|(-?\d+(?:\.\d+)?)|(true|false|null))'
        for m in re.finditer(pattern, text_clean):
            k = m.group(1)
            v_str = m.group(2)
            v_num = m.group(3)
            v_bool = m.group(4)
            if v_str is not None:
                fallback[k] = v_str
            elif v_num is not None:
                fallback[k] = float(v_num) if '.' in v_num else int(v_num)
            elif v_bool is not None:
                fallback[k] = {'true': True, 'false': False}.get(v_bool, None)
        if fallback:
            logger.warning("Parsed JSON via regex fallback mechanism.")
            return fallback

        raise


def get_llm_field(data: dict, field_name: str) -> Any:
    if not isinstance(data, dict):
        return None
    aliases = {
        "vendor_name": ["vendor_name", "merchant_name", "merchant", "vendor", "store_name", "seller_name", "shop_name", "vendorName", "merchantName", "storeName", "sellerName", "shopName"],
        "vendor_address": ["vendor_address", "address", "vendorAddress", "merchant_address"],
        "vendor_gstin": ["vendor_gstin", "gstin", "gst_number", "gst_no", "vendorGstin", "vendorGst"],
        "vendor_email": ["vendor_email", "email", "vendorEmail"],
        "vendor_phone": ["vendor_phone", "phone", "vendorPhone", "telephone", "contact"],

        "customer_name": ["customer_name", "customer", "buyer", "client", "customerName", "buyer_name", "client_name"],
        "customer_company": ["customer_company", "company", "customerCompany", "buyer_company"],
        "customer_address": ["customer_address", "customerAddress", "buyer_address"],
        "customer_gstin": ["customer_gstin", "customerGstin", "buyer_gstin", "customer_gst", "buyer_gst"],

        "invoice_number": ["invoice_number", "invoice_no", "inv_no", "bill_no", "bill_number", "invoiceNumber", "invoiceNo", "billNo", "billNumber", "receipt_no", "receipt_number", "receiptNo", "receiptNumber", "invoice_id", "invoiceId", "id"],
        "invoice_date": ["invoice_date", "date", "bill_date", "invoiceDate", "billDate", "receipt_date"],
        "due_date": ["due_date", "dueDate", "payment_due", "pay_by"],

        "subtotal": ["subtotal", "sub_total", "subTotal", "taxable_amount", "taxableAmount", "taxable_value", "taxableValue"],
        "grand_total": ["grand_total", "total", "total_amount", "grandTotal", "totalAmount", "amount", "net_payable", "netPayable", "invoice_total", "invoiceTotal"],

        "cgst_amount": ["cgst_amount", "cgst", "cgstAmount"],
        "sgst_amount": ["sgst_amount", "sgst", "sgstAmount"],
        "igst_amount": ["igst_amount", "igst", "igstAmount"],
        "tax_amount": ["tax_amount", "tax", "taxAmount", "gst", "gst_amount", "gstAmount", "total_tax", "totalTax"],

        "payment_method": ["payment_method", "paymentMethod", "payment_mode", "paymentMode", "mode_of_payment", "pay_method"],
        "transaction_id": ["transaction_id", "transactionId", "txnid", "txn_id", "reference_number", "ref_no", "utr", "utr_number"],
        "payment_terms": ["payment_terms", "paymentTerms", "terms", "terms_of_payment"],
        "balance_due": ["balance_due", "balanceDue", "balance", "outstanding", "due"],
        "amount_paid": ["amount_paid", "amountPaid", "paid", "paid_amount", "payment_received"],
        "category": ["category", "expense_category", "expenseCategory"],
        "document_type": ["document_type", "documentType", "type"],
        "currency": ["currency", "invoice_currency", "invoiceCurrency"],
        "notes": ["notes", "note", "remarks", "remark", "comments", "comment", "special_instructions", "additional_info"],
    }
    keys = aliases.get(field_name, [field_name])
    for k in keys:
        if k in data:
            val = data[k]
            if isinstance(val, dict) and 'value' in val:
                return val['value']
            return val

        if "_" in k:
            parts = k.split("_")
            if len(parts) == 2:
                parent, child = parts[0], parts[1]
                parent_syns = [parent]
                if parent == "vendor":
                    parent_syns.extend(["merchant", "seller", "shop", "store"])
                elif parent == "customer":
                    parent_syns.extend(["buyer", "client"])
                elif parent == "invoice":
                    parent_syns.extend(["bill", "receipt"])

                for p_key in parent_syns:
                    if isinstance(data.get(p_key), dict):
                        p_dict = data[p_key]
                        if child in p_dict:
                            val = p_dict[child]
                            if isinstance(val, dict) and 'value' in val:
                                return val['value']
                            return val
                        for alt_child in [child, "name", "address", "gstin", "email", "phone", "number", "date", "company"]:
                            if alt_child in p_dict:
                                val = p_dict[alt_child]
                                if isinstance(val, dict) and 'value' in val:
                                    return val['value']
                                return val
    return None


def _parse_amount_str(val: str) -> Optional[float]:
    if not val:
        return None
    cleaned = val.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def is_valid_gstin(gstin: Optional[str]) -> bool:
    if not gstin:
        return False
    normalized = normalize_gstin(gstin.upper().strip())
    if len(normalized) != 15:
        return False
    if normalized.count("O") > 2 or normalized.count("0") > 8:
        return False
    return bool(_GSTIN_VALID.match(normalized))


def _is_pos_terminal_number(amount: float, raw_ocr: str) -> bool:
    """Reject merchant IDs / batch numbers mistaken for invoice totals.
    Context-based, not magnitude-based: large amounts are only rejected
    when they appear on a line alongside POS-noise markers (MID, Batch,
    ROC, Terminal, etc.), never purely because of their size — large
    legitimate invoices routinely exceed any fixed numeric threshold."""
    if amount <= 0:
        return False
    if amount != int(amount):
        return False
    amt_int = int(amount)
    if amt_int < 100000:
        return False
    amt_str = str(amt_int)
    for line in raw_ocr.splitlines():
        if amt_str in line and _POS_NOISE_LINE.search(line):
            return True
        if amt_str in line and re.search(r'\b(?:mid|batch|roc)\b', line, re.I):
            return True
    return False


def _is_non_total_line(line: str) -> bool:
    """True if a line contains 'total' only as part of a savings/MRP/
    rounding/tax phrase rather than the actual grand total."""
    ll = line.lower()
    return any(p in ll for p in _NON_GRAND_TOTAL_PHRASES)


def _collect_ocr_amount_candidates(raw_ocr: str) -> List[Tuple[float, str, int]]:
    """Return (amount, source_line, priority) sorted best-first."""
    candidates: List[Tuple[float, str, int]] = []
    seen = set()

    for line in raw_ocr.splitlines():
        line_stripped = line.strip()
        if not line_stripped or _POS_NOISE_LINE.search(line_stripped):
            continue
        ll = line_stripped.lower()

        # Skip lines that are savings/MRP/rounding/tax-total variants —
        # they must never be treated as the grand total candidate.
        is_non_total = _is_non_total_line(line_stripped)

        priority = 0
        if not is_non_total:
            if 'txn amount' in ll or 'amount received' in ll:
                priority = 100
            elif 'grand total' in ll or 'total invoice' in ll:
                priority = 90
            elif 'g.total' in ll or ll.strip().startswith('total'):
                priority = 80

        for pat in _LABELED_AMOUNT.finditer(line_stripped):
            if is_non_total:
                break
            amt = _parse_amount_str(pat.group(1))
            if amt is not None and 0 < amt < 10_000_000 and amt not in seen:
                if not _is_pos_terminal_number(amt, raw_ocr):
                    candidates.append((amt, line_stripped, priority))
                    seen.add(amt)

        for pat in PATTERNS['amount']:
            for m in pat.finditer(line_stripped):
                amt = _parse_amount_str(m.group(1))
                if amt is None or amt <= 0 or amt in seen:
                    continue
                if _is_pos_terminal_number(amt, raw_ocr):
                    continue
                if is_non_total:
                    continue
                if amt < 1_000_000 or priority >= 80:
                    candidates.append((amt, line_stripped, priority))
                    seen.add(amt)

    candidates.sort(key=lambda x: (-x[2], -x[0]))
    return candidates


def _collect_subtotal_candidates(raw_ocr: str) -> List[_SubtotalCandidate]:
    """Scan OCR text line by line for genuine subtotal-family labels.

    A line is skipped entirely if it matches the exclusion pattern (MRP
    Total, Savings, Discount, Round Off, any *-Total tax line) — those never
    become subtotal candidates regardless of what number is on them.
    """
    candidates: List[_SubtotalCandidate] = []

    for line in raw_ocr.splitlines():
        line_stripped = line.strip()
        if not line_stripped or _POS_NOISE_LINE.search(line_stripped):
            continue
        if _SUBTOTAL_EXCLUDED_LABEL_PATTERN.search(line_stripped):
            continue

        for label_pat, base_conf, label_name in _SUBTOTAL_LABEL_PATTERNS:
            if not label_pat.search(line_stripped):
                continue

            amt: Optional[float] = None
            for pat in PATTERNS['amount']:
                m = pat.search(line_stripped)
                if m:
                    parsed = _parse_amount_str(m.group(1))
                    if parsed is not None and parsed > 0:
                        amt = parsed
                        break

            if amt is not None and not _is_pos_terminal_number(amt, raw_ocr):
                candidates.append(_SubtotalCandidate(
                    value=amt, label=label_name, base_confidence=base_conf, line=line_stripped
                ))
            break  # one label match per line is enough

    return candidates


def _score_subtotal_candidate(
    candidate: _SubtotalCandidate,
    grand_total: Optional[float],
    tax_amount: Optional[float],
) -> Tuple[float, str]:
    """Score a subtotal candidate using its label confidence plus
    mathematical consistency against grand_total/tax_amount when available."""
    score = float(candidate.base_confidence)
    reason = [candidate.label]

    if grand_total is not None and grand_total > 0:
        if candidate.value > grand_total * 1.02:
            # A subtotal should never meaningfully exceed the grand total.
            score -= 50.0
            reason.append("ExceedsTotal")
        elif tax_amount is not None and tax_amount >= 0:
            expected_total = candidate.value + tax_amount
            rel_err = abs(expected_total - grand_total) / max(grand_total, 1.0)
            if rel_err < 0.01:
                score += 30.0
                reason.append("MathExact")
            elif rel_err < 0.03:
                score += 15.0
                reason.append("MathClose")
            elif rel_err > 0.15:
                score -= 30.0
                reason.append("MathMismatch")
        elif candidate.value < grand_total:
            # No tax figure known yet — weak positive signal only.
            score += 5.0
            reason.append("BelowTotal")

    score = max(0.0, min(100.0, score))
    return score, "+".join(reason)


def _select_best_subtotal(
    raw_ocr: str,
    grand_total: Optional[float],
    tax_amount: Optional[float],
    min_score: float = 60.0,
) -> Tuple[Optional[float], Optional[int], str]:
    """Pick the best-scoring subtotal candidate, or (None, None, reason) if
    nothing reliable was found — never guesses."""
    candidates = _collect_subtotal_candidates(raw_ocr)
    if not candidates:
        return None, None, "No labeled subtotal candidate found in OCR text"

    scored = [
        (*_score_subtotal_candidate(c, grand_total, tax_amount), c)
        for c in candidates
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_reason, best_candidate = scored[0]

    if best_score < min_score:
        return None, None, f"Best candidate ({best_candidate.label}={best_candidate.value}) scored {best_score:.0f} < {min_score:.0f}"

    return best_candidate.value, int(best_score), best_reason


def extract_ocr_hints(raw_ocr_text: str) -> Dict[str, Any]:
    """Derive high-confidence fields from OCR text (used to fix LLM mistakes)."""
    text = raw_ocr_text or ""
    text_upper = text.upper()
    hints: Dict[str, Any] = {}

    for pat in PATTERNS['gst_number']:
        for m in pat.finditer(text_upper):
            candidate = normalize_gstin(m.group(1))
            if is_valid_gstin(candidate):
                hints['vendor_gstin'] = candidate
                break
        if 'vendor_gstin' in hints:
            break

    for pat in PATTERNS['invoice_number']:
        m = pat.search(text)
        if m:
            val = normalize_invoice_number(m.group(1))
            if len(val) >= 5 and not re.fullmatch(r'\d{1,4}', val):
                hints['invoice_number'] = val
                break
    if 'invoice_number' not in hints:
        m = _RETAIL_BILL_NO.search(text)
        if m:
            hints['invoice_number'] = normalize_invoice_number(m.group(1))
    if 'invoice_number' not in hints:
        for m in _RETAIL_BILL_DASH.finditer(text):
            val = m.group(1)
            if len(val) >= 10:
                hints['invoice_number'] = val
                break

    for pat in PATTERNS['date']:
        m = pat.search(text)
        if m:
            hints['invoice_date'] = normalize_date(m.group(1))
            break
    if 'invoice_date' not in hints:
        m = _ISO_DATE.search(text)
        if m:
            hints['invoice_date'] = normalize_date(m.group(1))

    amount_candidates = _collect_ocr_amount_candidates(text)
    if amount_candidates:
        hints['grand_total'] = amount_candidates[0][0]
        hints['grand_total_confidence'] = min(95, 60 + amount_candidates[0][2] // 3)

    # Tax lines (Indian retail) — computed BEFORE subtotal selection so the
    # subtotal + tax ≈ grand_total math check below has tax_amount available.
    # Tax lines (Indian retail) — computed BEFORE subtotal selection so the
    # subtotal + tax ≈ grand_total math check below has tax_amount available.
    for line in text.splitlines():
        ll = line.lower()
        if 'cgst' in ll and 'sgst' not in ll:
            clean_line = re.sub(r'\(\s*\d+(?:\.\d+)?\s*%\s*\)|\b\d+(?:\.\d+)?\s*%', '', line)
            for pat in PATTERNS['amount']:
                m = pat.search(clean_line)
                if m:
                    val = _parse_amount_str(m.group(1))
                    if val and val < 1_000_000:
                        hints['cgst_amount'] = val
                        break
        if 'sgst' in ll:
            clean_line = re.sub(r'\(\s*\d+(?:\.\d+)?\s*%\s*\)|\b\d+(?:\.\d+)?\s*%', '', line)
            for pat in PATTERNS['amount']:
                m = pat.search(clean_line)
                if m:
                    val = _parse_amount_str(m.group(1))
                    if val and val < 1_000_000:
                        hints['sgst_amount'] = val
                        break

    if hints.get('cgst_amount') and hints.get('sgst_amount'):
        hints['tax_amount'] = hints['cgst_amount'] + hints['sgst_amount']

    # Subtotal — FIXED: label-based candidate extraction, exclusion of
    # savings/MRP/discount/round-off/tax-total lines, mathematical
    # validation against grand_total/tax_amount, and no guessing when
    # nothing reliable is found (see _select_best_subtotal docstring).
    subtotal_val, subtotal_conf, subtotal_reason = _select_best_subtotal(
        text,
        grand_total=hints.get('grand_total'),
        tax_amount=hints.get('tax_amount'),
    )
    if subtotal_val is not None:
        hints['subtotal'] = subtotal_val
        hints['subtotal_confidence'] = subtotal_conf
        logger.info("Subtotal hint selected: %.2f (%s)", subtotal_val, subtotal_reason)
    else:
        logger.info("No reliable subtotal hint: %s", subtotal_reason)

    if re.search(r'\bupi\b', text, re.I):
        hints['payment_method'] = 'UPI'
    if re.search(r'upi\s+sale\s+complete|payment\s+successful|amount\s+received', text, re.I):
        hints['payment_complete'] = True

    m = re.search(
        r'(?:txn\s*id|transaction\s*id|ref\s*no)\s*:?\s*([A-Za-z0-9]{8,30})',
        text, re.I,
    )
    if m:
        hints['transaction_id'] = m.group(1)

    tl = text.lower()
    if any(k in tl for k in _RETAIL_VENDOR_KWS):
        hints['category'] = 'Food'
        hints['document_type'] = 'receipt'
    elif any(k in tl for k in ['electricity', 'electric', 'power', 'kwh', 'meter rent', 'electricity duty', 'broadband', 'telecom', 'water bill', 'utility']):
        hints['category'] = 'Utilities'
    elif 'hotel' in tl:
        hints['category'] = 'Travel'
    elif ('fuel' in tl or 'petrol' in tl or 'diesel' in tl) and not any(k in tl for k in ['electricity', 'electric', 'power', 'kwh']):
        hints['category'] = 'Fuel'
    elif 'restaurant' in tl or 'cafe' in tl:
        hints['category'] = 'Food'

    # Dynamic multi-currency detection evaluating symbols, strict word-boundary ISO codes, and tax markers
    detected_curr = _extract_currency_from_ocr(text)
    if detected_curr:
        hints['currency'] = detected_curr

    return hints


def _better_amount(
    llm_val: Optional[float],
    llm_conf: float,
    hint_val: Optional[float],
    hint_conf: float,
    raw_ocr: str,
) -> Tuple[Optional[float], str]:
    """Pick the more trustworthy of an LLM-extracted amount vs an OCR-regex
    hint. Both are treated as candidates with a confidence score rather than
    the hint unconditionally overriding the LLM value."""
    llm_valid = llm_val is not None and not _is_pos_terminal_number(llm_val, raw_ocr)
    hint_valid = hint_val is not None and not _is_pos_terminal_number(hint_val, raw_ocr)

    if not llm_valid and not hint_valid:
        return None, "no valid candidate"
    if not llm_valid:
        return hint_val, "LLM value missing/invalid, using OCR hint"
    if not hint_valid:
        return llm_val, "OCR hint missing/invalid, keeping LLM value"

    if hint_val and llm_val:
        rel_diff = abs(llm_val - hint_val) / max(hint_val, 1.0)
    else:
        rel_diff = 0.0

    if rel_diff > 0.5:
        if hint_conf >= llm_conf:
            return hint_val, f"Large discrepancy ({rel_diff:.0%}); hint confidence ({hint_conf}) >= LLM ({llm_conf})"
        return llm_val, f"Large discrepancy ({rel_diff:.0%}); LLM confidence ({llm_conf}) > hint ({hint_conf})"

    if hint_conf > llm_conf + 10:
        return hint_val, f"OCR hint confidence ({hint_conf}) beats LLM ({llm_conf})"
    return llm_val, f"LLM value kept (confidence {llm_conf} vs hint {hint_conf})"


def enrich_llm_data_from_ocr(llm_data: dict, raw_ocr_text: str) -> dict:
    """Merge OCR-derived hints into flat LLM JSON, reconciling by confidence
    rather than letting OCR hints unconditionally override LLM values."""
    if not llm_data:
        llm_data = {}
    hints = extract_ocr_hints(raw_ocr_text)

    enriched = {}
    keys_to_extract = [
        "document_type", "vendor_name", "vendor_address", "vendor_gstin", "vendor_email", "vendor_phone",
        "customer_name", "customer_company", "customer_address", "customer_gstin",
        "invoice_number", "invoice_date", "due_date",
        "subtotal", "grand_total", "cgst_amount", "sgst_amount", "igst_amount", "tax_amount",
        "payment_method", "transaction_id", "payment_terms", "balance_due", "amount_paid",
        "category", "currency", "notes",
    ]
    for k in keys_to_extract:
        enriched[k] = get_llm_field(llm_data, k)

    items_src = None
    for item_key in ["items", "line_items", "products", "itemized_bill", "lineItems"]:
        if item_key in llm_data:
            items_src = llm_data[item_key]
            break
    enriched["items"] = items_src

    def _llm_num(key: str) -> Optional[float]:
        v = enriched.get(key)
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            return _parse_amount_str(re.sub(r'[^\d.,-]', '', v))
        return None

    llm_gst = enriched.get('vendor_gstin')
    if not is_valid_gstin(str(llm_gst) if llm_gst else None):
        if hints.get('vendor_gstin'):
            enriched['vendor_gstin'] = hints['vendor_gstin']
            logger.info("OCR enrichment: corrected invalid GSTIN -> %s", hints['vendor_gstin'])

    llm_inv = str(enriched.get('invoice_number') or '').strip()
    if not llm_inv or len(llm_inv) < 6 or re.fullmatch(r'\d{1,4}', llm_inv):
        if hints.get('invoice_number'):
            enriched['invoice_number'] = hints['invoice_number']
            logger.info("OCR enrichment: corrected invoice_number -> %s", hints['invoice_number'])

    if not enriched.get('invoice_date') and hints.get('invoice_date'):
        enriched['invoice_date'] = hints['invoice_date']

    for key in ('subtotal', 'grand_total', 'balance_due', 'amount_paid', 'tax_amount',
                'cgst_amount', 'sgst_amount', 'igst_amount'):
        val = _llm_num(key)
        if val is not None and _is_pos_terminal_number(val, raw_ocr_text):
            enriched[key] = None
            logger.warning("OCR enrichment: rejected %s=%s (POS terminal ID)", key, val)

    gt = _llm_num('grand_total')
    hint_gt = hints.get('grand_total')
    llm_gt_conf = 85 if (gt is not None and not _is_pos_terminal_number(gt, raw_ocr_text)) else 0
    hint_gt_conf = hints.get('grand_total_confidence', 80)
    if hint_gt is not None:
        chosen_gt, reason = _better_amount(gt, llm_gt_conf, hint_gt, hint_gt_conf, raw_ocr_text)
        if chosen_gt is not None:
            enriched['grand_total'] = chosen_gt
            logger.info("grand_total reconciliation: %s", reason)
        gt = chosen_gt if chosen_gt is not None else gt

    st = _llm_num('subtotal')
    hint_st = hints.get('subtotal')
    llm_st_conf = 80 if (st is not None and not _is_pos_terminal_number(st, raw_ocr_text)
                         and not (gt and st > gt * 1.5)) else 0
    hint_st_conf = hints.get('subtotal_confidence', 75)
    if hint_st is not None:
        chosen_st, reason = _better_amount(st, llm_st_conf, hint_st, hint_st_conf, raw_ocr_text)
        if chosen_st is not None:
            enriched['subtotal'] = chosen_st
            logger.info("subtotal reconciliation: %s", reason)

    for tax_key in ('cgst_amount', 'sgst_amount', 'tax_amount'):
        if hints.get(tax_key) and _llm_num(tax_key) is None:
            enriched[tax_key] = hints[tax_key]

    # Retail receipts: UPI complete => paid. Scoped to receipt-like
    # documents only (see audit Bug notes on prior over-broad application).
    doc_type_guess = (enriched.get('document_type') or hints.get('document_type') or '').lower()
    if hints.get('payment_complete') and (doc_type_guess == 'receipt' or hints.get('document_type') == 'receipt'):
        gt_final = _llm_num('grand_total') or hint_gt
        if gt_final:
            enriched['amount_paid'] = gt_final
            enriched['balance_due'] = 0.0

    if hints.get('payment_method') and not enriched.get('payment_method'):
        enriched['payment_method'] = hints['payment_method']

    if hints.get('transaction_id'):
        txn = str(enriched.get('transaction_id') or '')
        if not txn or len(txn) < 8 or txn.upper() == str(enriched.get('vendor_gstin', '')).upper():
            enriched['transaction_id'] = hints['transaction_id']

    if hints.get('category'):
        cat = str(enriched.get('category') or '')
        if cat in ('Utilities', 'Office Supplies', 'Office', '') or not cat:
            enriched['category'] = hints['category']

    if hints.get('document_type') == 'receipt':
        enriched['document_type'] = 'receipt'

    # FIXED (audit Bug #11): only fill currency when we have a real hint;
    # never force INR as a silent default here.
    if hints.get('currency') and not enriched.get('currency'):
        enriched['currency'] = hints['currency']

    return enriched


def apply_ocr_corrections_to_fields(mapped: dict, raw_ocr_text: str) -> dict:
    """Post-process nested schema (LLM or SemanticEngine output) using OCR hints."""
    if not mapped or not raw_ocr_text:
        return mapped

    hints = extract_ocr_hints(raw_ocr_text)

    def _set(path: List[str], value: Any, conf: int = 88, reason: str = "OCR hint correction"):
        node = mapped
        for key in path[:-1]:
            node = node.setdefault(key, {})
        leaf = path[-1]
        if isinstance(node.get(leaf), dict) and 'value' in node[leaf]:
            if value is not None:
                node[leaf]['value'] = value
                node[leaf]['confidence'] = conf
                node[leaf]['reason'] = reason
        else:
            node[leaf] = value

    def _get(path: List[str]) -> Any:
        node = mapped
        for key in path:
            node = node.get(key, {})
        if isinstance(node, dict):
            return node.get('value')
        return node

    gst = _get(['vendor', 'vendor_gstin'])
    if not is_valid_gstin(str(gst) if gst else None) and hints.get('vendor_gstin'):
        _set(['vendor', 'vendor_gstin'], hints['vendor_gstin'])

    inv = str(_get(['invoice_details', 'invoice_number']) or '')
    if (not inv or len(inv) < 6 or re.fullmatch(r'\d{1,4}', inv)) and hints.get('invoice_number'):
        _set(['invoice_details', 'invoice_number'], hints['invoice_number'])

    if not _get(['invoice_details', 'invoice_date']) and hints.get('invoice_date'):
        _set(['invoice_details', 'invoice_date'], hints['invoice_date'])

    for src_key, path, hint_conf_key in (
        ('grand_total', ['amounts', 'grand_total'], 'grand_total_confidence'),
        ('subtotal', ['amounts', 'subtotal'], 'subtotal_confidence'),
        ('cgst_amount', ['taxes', 'cgst_amount'], None),
        ('sgst_amount', ['taxes', 'sgst_amount'], None),
        ('tax_amount', ['taxes', 'tax_amount'], None),
    ):
        cur = _get(path)
        try:
            cur_f = float(cur) if cur is not None else None
        except (TypeError, ValueError):
            cur_f = None
        hint_val = hints.get(src_key)
        if hint_val is None:
            continue
        if cur_f is None or _is_pos_terminal_number(cur_f, raw_ocr_text):
            _set(path, hint_val)
        elif hint_conf_key is not None:
            cur_conf = 85
            hint_conf = hints.get(hint_conf_key, 80)
            chosen, _reason = _better_amount(cur_f, cur_conf, hint_val, hint_conf, raw_ocr_text)
            if chosen is not None and chosen != cur_f:
                _set(path, chosen)
        elif abs(cur_f - hint_val) / max(hint_val, 1) > 0.5:
            if src_key in ('cgst_amount', 'sgst_amount') and hint_val <= 28.0 and cur_f > 28.0:
                continue
            _set(path, hint_val)

    doc_type = mapped.get('document_type', '')
    if hints.get('payment_complete') and (doc_type == 'receipt' or hints.get('document_type') == 'receipt'):
        gt = _get(['amounts', 'grand_total'])
        try:
            gt_f = float(gt) if gt is not None else hints.get('grand_total')
        except (TypeError, ValueError):
            gt_f = hints.get('grand_total')
        if gt_f:
            _set(['payment', 'amount_paid'], gt_f)
            _set(['payment', 'balance_due'], 0.0)
            mapped['payment_status'] = 'PAID'
            mapped['status_reason'] = 'UPI / card payment completed per receipt.'

    # Guard: explicitly detect OVERDUE / UNPAID invoices
    if re.search(r'\b(?:overdue|days\s*overdue|unpaid\s*/\s*overdue|amount\s*is\s*due)\b', raw_ocr_text, re.I):
        mapped['payment_status'] = 'OVERDUE'
        mapped['status_reason'] = "Explicit 'OVERDUE' status indicator found on document."
        gt_node = _get(['amounts', 'grand_total'])
        try:
            gt_val = float(gt_node) if gt_node is not None else 0.0
        except (TypeError, ValueError):
            gt_val = 0.0
        if gt_val > 0:
            _set(['payment', 'balance_due'], gt_val)
            _set(['payment', 'amount_paid'], 0.0)

    if hints.get('payment_method') and not _get(['payment', 'payment_method']):
        _set(['payment', 'payment_method'], hints['payment_method'])

    if hints.get('category'):
        cat = mapped.get('category') or _get(['category'])
        if hints['category'] == 'Utilities' or cat in ('Office Supplies', 'Office', None, ''):
            mapped['category'] = hints['category']

    # FIXED (audit Bug #11): only set currency when there's an actual hint;
    # never force a default here either.
    if hints.get('currency') and not mapped.get('currency'):
        mapped['currency'] = hints['currency']

    # FIXED (audit Bug #6): apply the same subtotal+tax≈grand_total
    # consistency repair that SemanticEngine already applies in its own
    # fallback path, so the LLM path gets the same safety net instead of
    # being the only path without this cross-check.
    try:
        amounts = mapped.get('amounts', {})
        taxes = mapped.get('taxes', {})
        payment = mapped.get('payment', {})

        def _v(container, key):
            node = container.get(key)
            return node.get('value') if isinstance(node, dict) else node

        subtotal = _v(amounts, 'subtotal')
        grand_total = _v(amounts, 'grand_total')
        balance_due = _v(payment, 'balance_due')
        tax_amount = _v(taxes, 'tax_amount')

        new_subtotal, new_grand_total = _reconcile_amount_fields(subtotal, grand_total, balance_due, tax_amount)
        if new_subtotal != subtotal and new_subtotal is not None:
            _set(['amounts', 'subtotal'], new_subtotal, conf=80, reason="Reconciled against tax/balance-due")
        if new_grand_total != grand_total and new_grand_total is not None:
            _set(['amounts', 'grand_total'], new_grand_total, conf=80, reason="Reconciled against tax/balance-due")
    except Exception as e:
        logger.warning("Amount reconciliation skipped due to error: %s", e)

    return mapped


def map_llm_json_to_schema(llm_data: dict, raw_ocr_text: str) -> dict:
    def sanitize_string(val):
        if not isinstance(val, str):
            return None
        stripped = val.strip()
        placeholders = {
            "n/a", "na", "none", "null", "unknown", "not detected", "not available",
            "not applicable", "not found", "undefined", "-", "unspecified", "nil", ""
        }
        if stripped.lower() in placeholders:
            return None
        return stripped

    def sanitize_numeric(val):
        if val is None:
            return None
        if isinstance(val, (int, float)):
            fval = float(val)
            if _is_pos_terminal_number(fval, raw_ocr_text):
                return None
            return fval
        if isinstance(val, str):
            cleaned = re.sub(r"[^\d.-]", "", val)
            try:
                fval = float(cleaned)
                if _is_pos_terminal_number(fval, raw_ocr_text):
                    return None
                return fval
            except ValueError:
                return None
        return None

    def f(val, conf=95, src="", reas="Extracted via vision-language model", is_num=False):
        if is_num:
            val = sanitize_numeric(val)
        else:
            val = sanitize_string(val)
            if isinstance(val, str) and len(val) > 250:
                val = val[:247] + "..."
        return {
            "value": val,
            "confidence": conf if val is not None else 0,
            "source_text": src or (str(val) if val is not None else ""),
            "reason": reas
        }

    category_mapping = {
        "grocery": "Food", "groceries": "Food", "supermarket": "Food", "shopping": "Food",
        "mall": "Food", "hotel": "Travel", "restaurant": "Food", "cafe": "Food",
        "petrol": "Fuel", "diesel": "Fuel", "gas": "Fuel", "cab": "Travel", "taxi": "Travel",
        "flight": "Travel", "train": "Travel", "subscription": "Subscription", "billing": "Utilities",
        "utility": "Utilities", "electricity": "Utilities", "water": "Utilities", "broadband": "Utilities",
        "hosting": "Software", "saas": "Software", "cloud": "Software", "advertising": "Marketing",
        "ads": "Marketing", "stationery": "Office Supplies", "office": "Office Supplies",
        "electronics": "Electronics", "computer": "Electronics", "laptop": "Electronics", "device": "Electronics"
    }

    allowed_categories = {
        "Travel", "Fuel", "Food", "Medical", "Software", "Marketing", "Utilities",
        "Electronics", "Subscription", "Entertainment", "Office Supplies"
    }

    raw_cat = sanitize_string(get_llm_field(llm_data, "category"))
    category = "Office Supplies"
    if raw_cat:
        raw_cat_title = raw_cat.strip().title()
        if raw_cat_title in allowed_categories:
            category = raw_cat_title
        else:
            raw_cat_lower = raw_cat.strip().lower()
            mapped_cat = category_mapping.get(raw_cat_lower)
            if mapped_cat:
                category = mapped_cat
            else:
                from app.pipeline.semantic_engine import CategoryNLPClassifier
                classifier = CategoryNLPClassifier()
                category = classifier.classify(raw_cat)

    raw_doc_type = sanitize_string(get_llm_field(llm_data, "document_type")) or "invoice"
    doc_type = raw_doc_type.lower()
    if doc_type not in ["invoice", "receipt", "other"]:
        text_lower = raw_ocr_text.lower()
        if any(k in text_lower for k in _RETAIL_VENDOR_KWS) or "receipt" in text_lower:
            doc_type = "receipt"
        elif "invoice" in text_lower or "tax invoice" in text_lower:
            doc_type = "invoice"
        else:
            doc_type = "other"

    raw_vendor_gstin = sanitize_string(get_llm_field(llm_data, "vendor_gstin"))
    vendor_gstin = normalize_gstin(raw_vendor_gstin) if raw_vendor_gstin else None
    if not is_valid_gstin(vendor_gstin):
        vendor_gstin = None

    raw_customer_gstin = sanitize_string(get_llm_field(llm_data, "customer_gstin"))
    customer_gstin = normalize_gstin(raw_customer_gstin) if raw_customer_gstin else None

    raw_inv_no = sanitize_string(get_llm_field(llm_data, "invoice_number"))
    inv_no = normalize_invoice_number(raw_inv_no) if raw_inv_no else None

    raw_inv_date = sanitize_string(get_llm_field(llm_data, "invoice_date"))
    inv_date = normalize_date(raw_inv_date) if raw_inv_date else None

    raw_due_date = sanitize_string(get_llm_field(llm_data, "due_date"))
    due_date = normalize_date(raw_due_date) if raw_due_date else None

    # FIXED (audit Bug #11): currency is left as None when nothing in the
    # LLM output or OCR text corroborates it, instead of silently
    # defaulting to "INR" for every document regardless of origin.
    raw_currency = sanitize_string(get_llm_field(llm_data, "currency"))
    currency = raw_currency.upper() if raw_currency else None

    notes_val = sanitize_string(get_llm_field(llm_data, "notes"))

    mapped = {
        "document_type": doc_type,
        "vendor": {
            "vendor_name": f(get_llm_field(llm_data, "vendor_name")),
            "vendor_address": f(get_llm_field(llm_data, "vendor_address")),
            "vendor_gstin": f(vendor_gstin),
            "vendor_email": f(get_llm_field(llm_data, "vendor_email")),
            "vendor_phone": f(get_llm_field(llm_data, "vendor_phone"))
        },
        "customer": {
            "customer_name": f(get_llm_field(llm_data, "customer_name")),
            "customer_company": f(get_llm_field(llm_data, "customer_company")),
            "customer_address": f(get_llm_field(llm_data, "customer_address")),
            "customer_gstin": f(customer_gstin)
        },
        "invoice_details": {
            "invoice_number": f(inv_no),
            "invoice_date": f(inv_date),
            "due_date": f(due_date)
        },
        "amounts": {
            "subtotal": f(get_llm_field(llm_data, "subtotal"), is_num=True),
            "grand_total": f(get_llm_field(llm_data, "grand_total"), is_num=True)
        },
        "taxes": {
            "cgst_amount": f(get_llm_field(llm_data, "cgst_amount"), is_num=True),
            "sgst_amount": f(get_llm_field(llm_data, "sgst_amount"), is_num=True),
            "igst_amount": f(get_llm_field(llm_data, "igst_amount"), is_num=True),
            "tax_amount": f(get_llm_field(llm_data, "tax_amount"), is_num=True)
        },
        "payment": {
            "payment_method": f(get_llm_field(llm_data, "payment_method")),
            "transaction_id": f(get_llm_field(llm_data, "transaction_id")),
            "payment_terms": f(get_llm_field(llm_data, "payment_terms")),
            "balance_due": f(get_llm_field(llm_data, "balance_due"), is_num=True),
            "amount_paid": f(get_llm_field(llm_data, "amount_paid"), is_num=True)
        },
        "payment_status": "UNPAID",
        "status_reason": "",
        "items": [],
        "category": category,
        "currency": currency,
        "notes": notes_val,
        "confidence": {
            "document_type": 95,
            "vendor_name": 95 if sanitize_string(get_llm_field(llm_data, "vendor_name")) else 0,
            "invoice_number": 95 if inv_no else 0,
            "invoice_date": 95 if inv_date else 0,
            "grand_total": 95 if sanitize_numeric(get_llm_field(llm_data, "grand_total")) is not None else 0
        },
        "warnings": []
    }

    items_list = None
    for item_key in ["items", "line_items", "products", "itemized_bill", "lineItems"]:
        if item_key in llm_data and isinstance(llm_data[item_key], list):
            items_list = llm_data[item_key]
            break
    if not items_list:
        items_list = []

    for item in items_list:
        if not isinstance(item, dict):
            continue
        desc = sanitize_string(item.get("description") or item.get("desc") or item.get("name") or item.get("item"))
        qty = sanitize_numeric(item.get("quantity") or item.get("qty") or item.get("count") or item.get("volume") or item.get("weight"))
        uprice = sanitize_numeric(item.get("unit_price") or item.get("uprice") or item.get("rate") or item.get("price") or item.get("unitPrice"))
        tot = sanitize_numeric(item.get("total_amount") or item.get("total") or item.get("amount") or item.get("totalPrice") or item.get("total_price"))

        if tot is None and qty is not None and uprice is not None:
            tot = qty * uprice
        elif uprice is None and qty is not None and qty > 0 and tot is not None:
            uprice = tot / qty
        elif qty is None and uprice is not None and uprice > 0 and tot is not None:
            qty = tot / uprice

        tax_rate = sanitize_numeric(item.get("tax_rate") or item.get("tax") or item.get("taxRate") or item.get("gst") or item.get("vat"))
        hsn = sanitize_string(item.get("hsn_code") or item.get("hsn") or item.get("hsnCode"))

        if desc:
            mapped["items"].append({
                "description": desc,
                "quantity": qty if qty is not None else 1.0,
                "unit_price": uprice if uprice is not None else (tot if tot is not None else 0.0),
                "total_amount": tot if tot is not None else 0.0,
                "tax_rate": tax_rate,
                "hsn_code": hsn
            })

    payment_status, status_reason = resolve_payment_status(
        raw_ocr_text,
        mapped["payment"]["balance_due"]["value"],
        mapped["payment"]["amount_paid"]["value"],
        mapped["amounts"]["grand_total"]["value"],
        mapped["invoice_details"]["due_date"]["value"]
    )
    mapped["payment_status"] = payment_status
    mapped["status_reason"] = status_reason

    return apply_ocr_corrections_to_fields(mapped, raw_ocr_text)


def _detect_document_flavor(raw_ocr_text: str) -> str:
    """Cheap sniff of whether this looks like an Indian GST/retail document
    or a generic (possibly international) invoice."""
    text_lower = (raw_ocr_text or "").lower()
    gst_markers = ('gstin', 'cgst', 'sgst', 'igst', '₹', 'tax invoice', 'hsn')
    if any(m in text_lower for m in gst_markers):
        return "india_gst"
    return "generic"


def _build_system_prompt(flavor: str = "india_gst") -> str:
    common_header = (
        "You are an expert Invoice and Receipt Extraction AI.\n"
        "Extract structured data from the image AND the OCR text. Return ONLY a valid JSON object — no markdown.\n\n"
        "=== CRITICAL RULES ===\n"
        "1. Use JSON null for missing fields. Never use 'N/A', 'unknown', 'not detected', etc.\n"
        "2. Numeric fields must be plain numbers (no currency symbols or commas). Example: 117.50 not '$117.50'.\n"
        "3. document_type: 'receipt' for POS/retail slips; 'invoice' for formal invoices.\n"
        "4. grand_total is the FINAL PAYABLE amount only. Never confuse it with 'MRP Total', 'Total Savings', "
        "'You Saved', 'Round Off', or any pre-discount subtotal — these often also contain the word 'Total' but "
        "are NOT the amount actually payable.\n"
        "5. notes: capture any special remarks, handwritten annotations, terms not captured elsewhere, or null "
        "if none are present. Do not fabricate notes.\n\n"
    )

    if flavor == "india_gst":
        specific = (
            "5b. GSTIN must be exactly 15 alphanumeric characters (e.g. 36AACCA8432H1ZR). Never use TXN ID as GSTIN.\n\n"
            "=== RETAIL / MALL / SUPERMARKET RECEIPTS (DMart, Reliance, etc.) ===\n"
            "These documents often have TWO sections: (A) itemized tax invoice at top, (B) UPI/card payment slip at bottom.\n"
            "- Read section A for: vendor name, GSTIN, bill/invoice number, bill date, line items, tax breakup.\n"
            "- invoice_number: use 'Bill No', 'Invoice No', or 'Voucher No' from section A (e.g. 501311021-008270).\n"
            "- invoice_date: use 'Bill Date' from section A (format DD/MM/YYYY).\n"
            "- grand_total: use 'Grand Total', 'Total Invoice Amount', or 'Amount Received' from section A — "
            "NEVER 'MRP Total' or 'Total Savings'.\n"
            "- subtotal: use 'Taxable Amount' or 'Sub Total' from GST breakup table.\n"
            "- cgst_amount / sgst_amount: from GST breakup table rows.\n"
            "- NEVER use these as amounts: MID, Merchant ID, Batch ID, ROC, Terminal ID, Approval Code.\n"
            "- transaction_id: only the UPI/card TXN ID from section B (not GSTIN, not bill number).\n"
            "- If UPI SALE COMPLETE or Amount Received equals grand_total: amount_paid = grand_total, balance_due = 0.\n"
            "- category: 'Food' for supermarkets/grocery/retail stores (DMart, Avenue Supermarts, etc.).\n"
            "- For shopkeeper/local merchant hand-written or printed invoices: extract the vendor name from the header/rubber stamp/title. Look for words ending in 'Store', 'Enterprises', 'Agency', 'Provisions', 'Mart', 'Shop', 'Sweets', 'Bakers', etc.\n"
            "- For shopping mall invoices (clothing, electronics, shoes): set category to 'Electronics' for electronic stores, 'Office Supplies' for apparel/shoes/clothing/bags, or 'Food' for supermarket/dining. Ensure all line items are extracted with exact description, quantity, price, and totals.\n\n"
        )
    else:
        specific = (
            "5b. Tax ID fields (GSTIN, VAT number, EIN, ABN, etc.) should be extracted verbatim as found; use vendor_gstin "
            "for whatever tax identifier is present, regardless of country format.\n\n"
            "=== GENERAL INVOICE / RECEIPT GUIDANCE ===\n"
            "- vendor_name: the business or individual issuing the invoice, usually top of the document or near a logo.\n"
            "- invoice_number: look for 'Invoice #', 'Invoice No', 'Bill No', 'Reference', 'Order ID', or similar.\n"
            "- invoice_date: the date the invoice/document was issued.\n"
            "- due_date: explicit due date, or infer from payment terms (e.g. 'Net 30') plus invoice_date if present.\n"
            "- grand_total: the final payable amount, typically the largest amount near the bottom of the document, "
            "clearly labeled 'Total', 'Total Due', 'Amount Due', 'Balance', or similar — do not confuse with subtotal "
            "or any single line item.\n"
            "- subtotal: pre-tax amount if shown separately from the grand total.\n"
            "- tax_amount / vat_amount: extract as tax_amount if a single combined tax line exists; use cgst/sgst/igst "
            "only if the document explicitly uses those Indian GST terms.\n"
            "- currency: infer ONLY from an explicit currency symbol or ISO code present (USD, EUR, GBP, INR, etc.); "
            "return null if you cannot tell — do not assume INR by default.\n"
            "- category: choose the closest fit based on vendor type and line items; do not default to grocery/food "
            "categories unless the vendor is clearly a supermarket, restaurant, or cafe.\n\n"
        )

    schema = (
        "=== FIELD SCHEMA ===\n"
        "{\n"
        '  "document_type": "invoice" | "receipt" | "other",\n'
        '  "vendor_name": string or null,\n'
        '  "vendor_address": string or null,\n'
        '  "vendor_gstin": string or null,\n'
        '  "vendor_email": string or null,\n'
        '  "vendor_phone": string or null,\n'
        '  "customer_name": string or null,\n'
        '  "customer_company": string or null,\n'
        '  "customer_address": string or null,\n'
        '  "customer_gstin": string or null,\n'
        '  "invoice_number": string or null,\n'
        '  "invoice_date": string or null,\n'
        '  "due_date": string or null,\n'
        '  "subtotal": float or null,\n'
        '  "grand_total": float or null,\n'
        '  "cgst_amount": float or null,\n'
        '  "sgst_amount": float or null,\n'
        '  "igst_amount": float or null,\n'
        '  "tax_amount": float or null,\n'
        '  "payment_method": string or null,\n'
        '  "transaction_id": string or null,\n'
        '  "payment_terms": string or null,\n'
        '  "balance_due": float or null,\n'
        '  "amount_paid": float or null,\n'
        '  "items": [{"description": string, "quantity": float, "unit_price": float, '
        '"total_amount": float, "tax_rate": float, "hsn_code": string}],\n'
        '  "category": "Office Supplies" | "Travel" | "Fuel" | "Food" | "Medical" | "Software" | '
        '"Marketing" | "Utilities" | "Electronics" | "Subscription" | "Entertainment",\n'
        '  "currency": string or null,\n'
        '  "notes": string or null\n'
        "}\n"
    )

    return common_header + specific + schema


def _ollama_is_reachable() -> bool:
    """Fast health check so a down/cold Ollama server fails quickly instead
    of silently eating the full request timeout on every single upload
    (audit Bug #12)."""
    try:
        import httpx
        with httpx.Client(timeout=OLLAMA_HEALTHCHECK_TIMEOUT_SECONDS) as client:
            resp = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return resp.status_code == 200
    except Exception as e:
        logger.warning("Ollama health check failed: %s", e)
        return False


def _extract_with_gemini(image_path: str, raw_ocr_text: str) -> Optional[dict]:
    """
    Primary extraction tier using Google Gemini 2.0 Flash REST API (Free on Google AI Studio).
    Fast, multimodal (vision + OCR), and near 100% extraction accuracy on invoices and receipts.
    """
    if not GEMINI_API_KEY:
        return None

    try:
        import httpx

        flavor = _detect_document_flavor(raw_ocr_text)
        system_prompt = _build_system_prompt(flavor)
        logger.info("Connecting to Google Gemini API using model %s (document flavor: %s)", GEMINI_MODEL, flavor)

        user_prompt = (
            "Extract all invoice/receipt fields from this document into the exact JSON schema requested in the system instructions.\n"
            "Pay special attention to any payment/transaction slip sections.\n"
            "Do NOT confuse merchant/terminal/batch reference numbers with invoice totals.\n"
            "Do NOT confuse 'MRP Total'/'Total Savings'/'Round Off' with the actual grand_total.\n\n"
            f"OCR text (use for exact spelling and numbers):\n\n{raw_ocr_text}\n\n"
            "Return JSON matching the schema."
        )

        parts: List[Dict[str, Any]] = []
        try:
            base64_image = encode_image_to_base64(image_path)
            ext = os.path.splitext(image_path)[1].lower().replace(".", "")
            mime_type = f"image/{ext}" if ext in ["png", "jpg", "jpeg", "webp"] else "image/jpeg"
            parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64_image,
                }
            })
        except Exception as img_err:
            logger.warning("Failed to prepare base64 image for Gemini, using OCR text only: %s", img_err)

        parts.append({"text": f"{system_prompt}\n\n{user_prompt}"})

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        with httpx.Client(timeout=30.0) as http_client:
            res = http_client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            response_text = data["candidates"][0]["content"]["parts"][0]["text"]

        logger.info("Successfully received Gemini response: %s...", response_text[:300])

        parsed_json = clean_and_parse_json(response_text)
        enriched = enrich_llm_data_from_ocr(parsed_json, raw_ocr_text)
        mapped_result = map_llm_json_to_schema(enriched, raw_ocr_text)
        return mapped_result
    except Exception as e:
        logger.error("Gemini API extraction failed: %s. Falling back to local Ollama / rule engine.", e)
        return None


def extract_with_huggingface(image_path: str, raw_ocr_text: str) -> Optional[dict]:
    """
    Primary LLM extraction function.
    Execution hierarchy:
    1. Google Gemini (GEMINI_API_KEY) - fast, 100% free tier on Google AI Studio, high accuracy
    2. Local Ollama (OLLAMA_BASE_URL) - local offline fallback if reachable
    3. Return None to trigger rule-based SemanticEngine fallback in pipeline.py
    """
    # Tier 1: Google Gemini (Free on Google AI Studio)
    if GEMINI_API_KEY:
        gemini_result = _extract_with_gemini(image_path, raw_ocr_text)
        if gemini_result is not None:
            return gemini_result
        logger.warning("Gemini extraction did not succeed, proceeding to local Ollama fallback...")

    # Tier 2: Local Ollama
    if not _ollama_is_reachable():
        logger.warning(
            "Ollama server at %s is not reachable — skipping LLM extraction "
            "and falling back to rule-based SemanticEngine for this request.",
            OLLAMA_BASE_URL,
        )
        return None

    try:
        model_name = OLLAMA_MODEL or HUGGINGFACE_MODEL or "qwen2.5vl:3b"
        flavor = _detect_document_flavor(raw_ocr_text)
        system_prompt = _build_system_prompt(flavor)
        logger.info("Using '%s' prompt flavor for extraction.", flavor)

        user_prompt = (
            "Extract all invoice/receipt fields from this document.\n"
            "Pay special attention to any payment/transaction slip sections.\n"
            "Do NOT confuse merchant/terminal/batch reference numbers with invoice totals.\n"
            "Do NOT confuse 'MRP Total'/'Total Savings'/'Round Off' with the actual grand_total.\n\n"
            f"OCR text (use for exact spelling and numbers):\n\n{raw_ocr_text}\n\n"
            "Return the JSON object only."
        )

        try:
            base64_image = encode_image_to_base64(image_path)
            ext = os.path.splitext(image_path)[1].lower().replace(".", "")
            mime_type = f"image/{ext}" if ext in ["png", "jpg", "jpeg", "webp"] else "image/jpeg"
            image_url = f"data:{mime_type};base64,{base64_image}"
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type": "text", "text": user_prompt},
                    ],
                },
            ]
        except Exception as img_err:
            logger.warning("Failed to prepare image base64, falling back to text-only: %s", img_err)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]

        import httpx
        endpoint = f"{OLLAMA_BASE_URL}/v1/chat/completions"
        logger.info("Connecting to local Ollama server at %s using model %s", endpoint, model_name)
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 2500
        }
        with httpx.Client(timeout=OLLAMA_TIMEOUT_SECONDS) as http_client:
            res = http_client.post(endpoint, json=payload)
            res.raise_for_status()
            response_text = res.json()["choices"][0]["message"]["content"]

        logger.info("Successfully received response: %s...", response_text[:300])

        parsed_json = clean_and_parse_json(response_text)
        enriched = enrich_llm_data_from_ocr(parsed_json, raw_ocr_text)
        mapped_result = map_llm_json_to_schema(enriched, raw_ocr_text)
        return mapped_result

    except Exception as e:
        logger.error("Local Ollama extraction failed: %s. Falling back to rule-based SemanticEngine.", e)
        return None


# Alias for clean modern naming
extract_with_llm = extract_with_huggingface