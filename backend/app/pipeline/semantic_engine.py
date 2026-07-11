import re
import datetime
from typing import Dict, Any, List, Optional
import torch
from app.rules.patterns import PATTERNS, KEYWORDS
from app.pipeline.ocr_engine import OCRResult
from app.core.config import ENABLE_ADVANCED_RANKING

try:
    # Optional advanced helpers (must not break legacy flow if missing)
    from app.pipeline.candidate_engine import CandidateEngine
    from app.pipeline.ranking_engine import RankingEngine
    from app.pipeline.table_reconstructor import TableReconstructor
except Exception:  # pragma: no cover
    CandidateEngine = None  # type: ignore
    RankingEngine = None  # type: ignore
    TableReconstructor = None  # type: ignore

class CategoryNLPClassifier:
    """
    NLP Category Classifier utilizing PyTorch tensors for similarity computations.
    """
    def __init__(self):
        # NLP vocabulary built from all category keywords
        self.categories = {
            "Travel": ["travel", "flight", "ticket", "airline", "cab", "taxi", "uber", "ola", "travels", "booking", "boarding", "passenger"],
            "Fuel": ["fuel", "petrol", "diesel", "gas", "station", "filling", "nozzle", "hsd", "lubricant", "refueling"],
            "Food": ["restaurant", "food", "dining", "cafe", "caterer", "eats", "waiter", "table", "meal", "coffee", "beverage", "kitchen", "lunch", "dinner", "breakfast", "burger", "pizza", "menu"],
            "Medical": ["medical", "pharmacy", "hospital", "doctor", "rx", "medicine", "healthcare", "chemist", "pharma", "drug", "clinic", "prescription"],
            "Software": ["software", "saas", "subscription", "cloud", "aws", "gcp", "azure", "hosting", "domain", "github", "atlassian", "microsoft", "license", "api", "digitalocean"],
            "Marketing": ["marketing", "ads", "facebook ads", "google ads", "advertisement", "promotion", "campaign", "adwords"],
            "Utilities": ["utility", "electricity", "water", "power", "telecom", "broadband", "phone", "mobile", "internet", "sewer", "trash"],
            "Electronics": ["electronics", "laptop", "mobile", "charger", "keyboard", "mouse", "monitor", "hardware", "device", "printer", "accessories"],
            "Subscription": ["subscription", "monthly", "yearly", "netflix", "spotify", "zoom", "renewal", "membership"],
            "Entertainment": ["entertainment", "movie", "ticket", "event", "show", "cinema", "theatre", "amusement"],
            "Office Supplies": ["stationery", "paper", "pen", "office", "supplies", "printing", "stapler", "envelope", "notebook", "shoes", "shoe", "apparel", "wear", "shirt", "clothing"]
        }

        # Build vocabulary
        vocab_set = set()
        for kws in self.categories.values():
            for kw in kws:
                vocab_set.add(kw)
        self.vocab = sorted(list(vocab_set))
        self.vocab_idx = {word: idx for idx, word in enumerate(self.vocab)}

        # Represent each category as a normalized unit vector tensor in PyTorch
        num_vocab = len(self.vocab)
        num_categories = len(self.categories)
        self.cat_matrix = torch.zeros((num_categories, num_vocab), dtype=torch.float32)

        self.cat_list = list(self.categories.keys())
        for cat_idx, cat_name in enumerate(self.cat_list):
            for kw in self.categories[cat_name]:
                if kw in self.vocab_idx:
                    self.cat_matrix[cat_idx, self.vocab_idx[kw]] = 1.0
            # Normalize vector to unit length
            norm = torch.norm(self.cat_matrix[cat_idx])
            if norm > 0:
                self.cat_matrix[cat_idx] /= norm

    def classify(self, text: str) -> str:
        # Tokenize text
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())

        # Build input vector
        input_vector = torch.zeros((len(self.vocab),), dtype=torch.float32)
        for w in words:
            if w in self.vocab_idx:
                input_vector[self.vocab_idx[w]] += 1.0

        # Normalize input vector
        input_norm = torch.norm(input_vector)
        if input_norm == 0:
            return "Office Supplies" # Default category

        input_vector /= input_norm

        # Compute Cosine Similarity using PyTorch matrix multiplication
        similarities = torch.matmul(self.cat_matrix, input_vector)

        # Find index of maximum similarity
        max_idx = torch.argmax(similarities).item()

        # If the highest similarity is 0, fallback
        if similarities[max_idx].item() == 0:
            return "Office Supplies"

        return self.cat_list[max_idx]


class FieldNLPClassifier:
    """
    NLP Field Classifier utilizing PyTorch tensors for similarity computations
    to match arbitrary text labels to standard invoice fields.
    """
    def __init__(self):
        self.fields = {
            "invoice_number": ["invoice", "inv", "bill", "receipt", "no", "number", "id", "num", "token", "document", "sale"],
            "invoice_date": ["date", "dated", "billing", "issue"],
            "due_date": ["due", "pay", "by", "expiry", "expire", "expires", "validity"],
            "payment_terms": ["terms", "payment terms", "condition", "conditions", "net"],
            "balance_due": ["balance", "due", "outstanding", "amount due", "outstanding amount", "balance due", "bal"],
            "amount_paid": ["paid", "amount paid", "received", "payment", "paid amount"],
            "gst_number": ["gstin", "gst", "gstno", "registration", "reg", "taxpayer", "taxid"],
            "subtotal": ["subtotal", "sub", "taxable", "value", "amount", "net", "before"],
            "cgst_amount": ["cgst", "c.g.s.t", "central", "tax"],
            "sgst_amount": ["sgst", "s.g.s.t", "state", "tax"],
            "igst_amount": ["igst", "i.g.s.t", "integrated", "tax"],
            "tax_amount": ["tax", "gst", "vat", "cess"],
            "invoice_total": ["grand", "total", "payable", "gross", "grand total", "total due", "net"]
        }

        # Build vocabulary
        vocab_set = set()
        for kws in self.fields.values():
            for kw in kws:
                vocab_set.add(kw)
        self.vocab = sorted(list(vocab_set))
        self.vocab_idx = {word: idx for idx, word in enumerate(self.vocab)}

        # Represent each field as a normalized unit vector tensor in PyTorch
        num_vocab = len(self.vocab)
        num_fields = len(self.fields)
        self.field_matrix = torch.zeros((num_fields, num_vocab), dtype=torch.float32)

        self.field_list = list(self.fields.keys())
        for f_idx, f_name in enumerate(self.field_list):
            for kw in self.fields[f_name]:
                if kw in self.vocab_idx:
                    self.field_matrix[f_idx, self.vocab_idx[kw]] = 1.0
            # Normalize vector to unit length
            norm = torch.norm(self.field_matrix[f_idx])
            if norm > 0:
                self.field_matrix[f_idx] /= norm

    def classify_label(self, text: str, threshold: float = 0.3) -> Optional[str]:
        # Tokenize text (letters only, min length 2)
        words = re.findall(r'\b[a-z]{2,}\b', text.lower())

        # Build input vector
        input_vector = torch.zeros((len(self.vocab),), dtype=torch.float32)
        for w in words:
            if w in self.vocab_idx:
                input_vector[self.vocab_idx[w]] += 1.0

        # Normalize input vector
        input_norm = torch.norm(input_vector)
        if input_norm == 0:
            return None

        input_vector /= input_norm

        # Compute Cosine Similarity
        similarities = torch.matmul(self.field_matrix, input_vector)

        # Find index of maximum similarity
        max_idx = torch.argmax(similarities).item()
        max_score = similarities[max_idx].item()

        if max_score >= threshold:
            return self.field_list[max_idx]
        return None


def normalize_gstin(gstin_str: str) -> str:
    gstin_str = gstin_str.upper().strip()
    if len(gstin_str) != 15:
        return gstin_str
    chars = list(gstin_str)
    # 1. State code: positions 0 and 1 must be digits
    for i in [0, 1]:
        if chars[i] == 'O':
            chars[i] = '0'
        elif chars[i] in ['I', 'L']:
            chars[i] = '1'
    # 2. PAN letters: positions 2 to 6 must be letters
    for i in [2, 3, 4, 5, 6]:
        if chars[i] == '0':
            chars[i] = 'O'
        elif chars[i] in ['1', 'l']:
            chars[i] = 'I'
    # 3. PAN digits: positions 7 to 10 must be digits
    for i in [7, 8, 9, 10]:
        if chars[i] == 'O':
            chars[i] = '0'
        elif chars[i] in ['I', 'L']:
            chars[i] = '1'
    # 4. PAN letter: position 11 must be letter
    if chars[11] == '0':
        chars[11] = 'O'
    elif chars[11] in ['1', 'l']:
        chars[11] = 'I'
    # 5. Z code: position 13 must be Z
    if chars[13] in ['2', 'S', 's', '5']:
        chars[13] = 'Z'
    return "".join(chars)

def normalize_invoice_number(inv_str: str) -> str:
    inv_str = inv_str.strip()
    # Correct common prefix OCR typos (1NV-, lNV- -> INV-)
    m = re.match(r'^[1l]nv-', inv_str, re.IGNORECASE)
    if m:
        inv_str = 'INV-' + inv_str[4:]
    else:
        m2 = re.match(r'^[1l]nv(\d+)', inv_str, re.IGNORECASE)
        if m2:
            inv_str = 'INV' + m2.group(1)

    # Correct letter O/l mistaken for zero/one in the numeric suffix (e.g. INV-O00001 -> INV-000001)
    inv_match = re.match(r'^((?:INV|inv|Inv)[- ]?)(.+)$', inv_str)
    if inv_match:
        prefix, suffix = inv_match.group(1), inv_match.group(2)
        suffix = re.sub(r'[Oo]', '0', suffix)
        inv_str = prefix + suffix
    return inv_str


_ADDRESS_WORD_PATTERN = re.compile(
    r'\b(?:street|st\.|road|rd\.|avenue|ave\.|lane|blvd|boulevard|drive|dr\.|'
    r'floor|building|nagar|district|state|city|zip|pincode|gstin)\b',
    re.IGNORECASE,
)


def _is_subtotal_label(text_lower: str) -> bool:
    return bool(re.search(r'\bsub[\s-]*total\b', text_lower))


def _is_grand_total_label(text_lower: str) -> bool:
    if _is_subtotal_label(text_lower):
        return False
    if re.search(r'\b(?:grand\s+total|total\s+amount|total\s+due|net\s+payable)\b', text_lower):
        return True
    return bool(re.fullmatch(r'\s*total\s*:?\s*', text_lower) or re.search(r'(?<!\w)total(?!\w)', text_lower) and 'tax' not in text_lower and 'discount' not in text_lower)


def _looks_like_address_line(text: str) -> bool:
    text = text.strip()
    if not text:
        return True
    text_lower = text.lower()
    if _ADDRESS_WORD_PATTERN.search(text_lower):
        return True
    if any(kw in text_lower for kw in ['opposite', 'near', 'tax invoice', 'phone', 'email', 'bill to', 'ship to', 'u.s.a', 'united states', 'india']):
        return True
    if re.match(r'^\d+[,\s]', text):
        return True
    if re.search(r'[\d]{4,}(?:\s*[A-Z]{2})?$', text):
        return True
    if re.search(r'^[A-Za-z\s]{2,}\d{4,}', text):
        return True
    if re.fullmatch(r'[\d,\.\s\-]+', text):
        return True
    return False


def _score_vendor_candidate(text: str) -> float:
    text = text.strip()
    if len(text) < 3 or not any(c.isalpha() for c in text):
        return -100.0
    if _looks_like_address_line(text):
        return -100.0
    text_lower = text.lower()
    if any(kw in text_lower for kw in ['invoice', 'tax invoice', 'receipt', 'bill to', 'ship to']):
        return -100.0
    score = 0.0
    words = [w for w in re.split(r'\s+', text) if w]
    if 2 <= len(words) <= 5:
        score += 25.0
    if words and all(w[0].isupper() for w in words if w and w[0].isalpha()):
        score += 20.0
    if any(k in text_lower for k in KEYWORDS['company']):
        score += 30.0
    if re.search(r'[A-Za-z]+\s+[A-Za-z]+', text):
        score += 10.0
    return score


def _extract_currency_from_ocr(ocr_results: List[OCRResult]) -> str:
    full_text = " ".join(r.text for r in ocr_results)
    if '$' in full_text or re.search(r'\bUSD\b', full_text, re.IGNORECASE):
        return 'USD'
    if '₹' in full_text or re.search(r'\b(?:INR|Rs\.?)\b', full_text, re.IGNORECASE):
        return 'INR'
    if re.search(r'\bEUR\b|€', full_text, re.IGNORECASE):
        return 'EUR'
    if re.search(r'\bGBP\b|£', full_text, re.IGNORECASE):
        return 'GBP'
    return 'INR'


def _reconcile_amount_fields(
    subtotal: Optional[float],
    grand_total: Optional[float],
    balance_due: Optional[float],
    tax_amount: Optional[float],
) -> tuple:
    """Fix common mis-assignments where subtotal is stored as grand_total."""
    try:
        if balance_due is not None and grand_total is not None:
            bd = float(balance_due)
            gt = float(grand_total)
            if bd > gt + 0.01:
                if subtotal is None or abs(float(subtotal) - gt) < 0.01:
                    subtotal = gt
                grand_total = bd
        if grand_total is not None and subtotal is not None and tax_amount is not None:
            gt = float(grand_total)
            st = float(subtotal)
            tax = float(tax_amount)
            if gt < st and abs(st + tax - gt) > 1.0:
                subtotal, grand_total = min(st, gt), max(st, gt)
    except (TypeError, ValueError):
        pass
    return subtotal, grand_total

MONTH_MAP = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9, 'sept': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12
}

def normalize_date(date_str: str) -> str:
    if not date_str:
        return date_str

    # Clean the string
    s = date_str.strip()

    # Remove common suffixes like st, nd, rd, th from days (e.g. 24th -> 24)
    s = re.sub(r'(\d+)(?:st|nd|rd|th)\b', r'\1', s, flags=re.IGNORECASE)

    # Try Month DD, YYYY (e.g. "April 8, 2015" or "October 2, 2083")
    m1 = re.search(r'([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})', s)
    if m1:
        month_name = m1.group(1).lower()
        day = int(m1.group(2))
        year = int(m1.group(3))
        month = MONTH_MAP.get(month_name)
        if month and 1 <= day <= 31:
            return f"{day:02d}/{month:02d}/{year:04d}"

    # Try DD Month YYYY (e.g. "8 April 2015" or "24 May 2026")
    m2 = re.search(r'(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})', s)
    if m2:
        day = int(m2.group(1))
        month_name = m2.group(2).lower()
        year = int(m2.group(3))
        month = MONTH_MAP.get(month_name)
        if month and 1 <= day <= 31:
            return f"{day:02d}/{month:02d}/{year:04d}"

    # Try YYYY/MM/DD or YYYY-MM-DD
    m3 = re.search(r'(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})', s)
    if m3:
        year = int(m3.group(1))
        month = int(m3.group(2))
        day = int(m3.group(3))
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{day:02d}/{month:02d}/{year:04d}"

    # Try DD/MM/YYYY or D/M/YYYY or MM/DD/YYYY
    m4 = re.search(r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})', s)
    if m4:
        part1 = int(m4.group(1))
        part2 = int(m4.group(2))
        year_part = int(m4.group(3))

        # Handle 2-digit year
        if year_part < 100:
            year = 2000 + year_part
        else:
            year = year_part

        # Resolve day/month ambiguity:
        # Default to DD/MM/YYYY unless part1 > 12 (then it must be MM/DD/YYYY)
        # If part2 > 12 (then it must be DD/MM/YYYY)
        if part1 > 12 and part2 <= 12:
            day = part1
            month = part2
        elif part2 > 12 and part1 <= 12:
            day = part2
            month = part1
        else:
            day = part1
            month = part2

        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{day:02d}/{month:02d}/{year:04d}"

    return date_str


def parse_payment_terms_days(terms_str: Optional[str]) -> Optional[int]:
    if not terms_str:
        return None
    # match Net 30, 30 days, 30 day, etc.
    m = re.search(r'\b(?:Net\s*)?(\d+)\s*(?:days?|day)?\b', terms_str, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def _parse_known_date_formats(date_str: Optional[str]) -> Optional[datetime.date]:
    """Shared date-parsing helper. Previously this same strptime-loop was
    duplicated in resolve_due_date and resolve_payment_status; centralized
    here so a fix to date-format handling only needs to happen in one place."""
    if not date_str or date_str == "Not detected":
        return None
    for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d']:
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except Exception:
            continue
    return None


def resolve_due_date(due_date_str: Optional[str], payment_terms_str: Optional[str], invoice_date_str: Optional[str]) -> Optional[str]:
    # If due_date exists, use it.
    if due_date_str and due_date_str != "Not detected":
        return due_date_str

    if not invoice_date_str or invoice_date_str == "Not detected":
        return None

    # Parse invoice date
    parsed_invoice_date = _parse_known_date_formats(invoice_date_str)

    if not parsed_invoice_date:
        return None

    if payment_terms_str:
        terms_lower = payment_terms_str.lower()
        if "due on receipt" in terms_lower:
            return parsed_invoice_date.strftime('%d/%m/%Y')

        days = parse_payment_terms_days(payment_terms_str)
        if days is not None:
            calculated_date = parsed_invoice_date + datetime.timedelta(days=days)
            return calculated_date.strftime('%d/%m/%Y')

    return None


def resolve_payment_status(
    full_text: str,
    balance_due: Optional[float],
    amount_paid: Optional[float],
    total_amount: Optional[float],
    due_date_str: Optional[str]
) -> tuple[str, str]:
    """Determine payment status.

    IMPORTANT: numeric evidence (balance_due, amount_paid vs total_amount) is
    checked BEFORE any keyword text scanning. A previous version of this
    function did `"paid" in text` / `"unpaid" in text` as substring checks
    over the ENTIRE OCR text, which meant boilerplate prose like "please
    ensure this invoice is paid within 30 days" or "payment terms: to be
    paid on receipt" would force a status of PAID even when nothing had
    actually been paid. Loose keyword matching is now only used as a last
    resort, and only against explicit status stamps/labels rather than
    free-form sentences.
    """
    text = full_text.lower()

    # Cancellation is a strong, low-ambiguity signal — keep checking first.
    if any(kw in text for kw in ["cancelled", "void", "voided"]):
        return "CANCELLED", "Invoice contains cancellation or void status keywords."

    # --- 1. Numeric evidence first: most reliable indicator ---
    if balance_due is not None:
        try:
            bd = float(balance_due)
        except (TypeError, ValueError):
            bd = None
        if bd is not None:
            if bd <= 0.01:
                return "PAID", "Balance due is 0."
            elif bd > 0:
                due_date = _parse_known_date_formats(due_date_str)
                if due_date and due_date < datetime.date.today():
                    return "OVERDUE", f"Overdue: balance due ({bd}) > 0 and due date ({due_date_str}) passed."
                return "UNPAID", "Balance due > 0."

    if amount_paid is not None and total_amount is not None:
        try:
            paid = float(amount_paid)
            total = float(total_amount)
        except (TypeError, ValueError):
            paid = total = None
        if paid is not None and total is not None:
            if paid >= total - 0.01:
                return "PAID", "Amount paid >= total amount."
            elif paid > 0:
                return "PARTIALLY_PAID", "Amount paid is less than total amount."

    # --- 2. Explicit status stamps/labels only — NOT loose substring search
    #        over the full document text, which would catch ordinary prose. ---
    if re.search(r'\b(?:payment\s+status)\s*:?\s*cancelled\b', text):
        return "CANCELLED", "Explicit status stamp: cancelled."
    if re.search(r'\b(?:paid\s+in\s+full|payment\s+received\s+in\s+full|status\s*:\s*paid)\b', text):
        return "PAID", "Explicit 'paid' stamp found on document."
    if re.search(r'\b(?:status\s*:\s*unpaid|payment\s+status\s*:\s*unpaid)\b', text):
        return "UNPAID", "Explicit 'unpaid' stamp found on document."

    # --- 3. Due-date-only inference as last resort ---
    due_date = _parse_known_date_formats(due_date_str)
    if due_date:
        if due_date < datetime.date.today():
            return "OVERDUE", f"Overdue: due date ({due_date_str}) passed."
        return "UNPAID", f"Unpaid: due date ({due_date_str}) is in the future."

    return "UNKNOWN", "Payment status cannot be determined."

class SemanticEngine:
    """
    Advanced Invoice Intelligence Engine (Refactored to 13-Step Pipeline).
    """

    KEYS_CONFIG = [
        ('invoice_number', re.compile(r'(?<![a-zA-Z])(invoice\s*#?|inv\s*no\.?|bill\s*no\.?)(?![a-zA-Z])', re.IGNORECASE), 'invoice_number'),
        ('invoice_date', re.compile(r'(?<![a-zA-Z])(invoice\s*date|bill\s*date|issue\s*date|date|dated)(?![a-zA-Z])', re.IGNORECASE), 'date'),
        ('due_date', re.compile(r'(?<![a-zA-Z])(due\s*date|pay\s*by|expiry)(?![a-zA-Z])', re.IGNORECASE), 'date'),
        ('payment_terms', re.compile(r'(?<![a-zA-Z])(payment\s*terms|terms)(?![a-zA-Z])', re.IGNORECASE), 'text'),
        ('invoice_total', re.compile(r'(?<![a-zA-Z])(grand\s*total|total|total\s*due|net\s*payable|total\s*amount)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('balance_due', re.compile(r'(?<![a-zA-Z])(balance\s*due|amount\s*due|outstanding\s*amount|bal\s*due)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('amount_paid', re.compile(r'(?<![a-zA-Z])(amount\s*paid|paid\s*amount|paid|amt\s*paid)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('gst_number', re.compile(r'(?<![a-zA-Z])(gstin|gst\s*no\.?|gst\s*number)(?![a-zA-Z])', re.IGNORECASE), 'gst_number'),
        ('subtotal', re.compile(r'(?<![a-zA-Z])(subtotal|sub\s*total|taxable\s*amount|taxable\s*value|net\s*amount)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('cgst_amount', re.compile(r'(?<![a-zA-Z])(cgst)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('sgst_amount', re.compile(r'(?<![a-zA-Z])(sgst)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('igst_amount', re.compile(r'(?<![a-zA-Z])(igst)(?![a-zA-Z])', re.IGNORECASE), 'amount'),
        ('tax_amount', re.compile(r'(?<![a-zA-Z])(tax|gst|vat)(?![a-zA-Z])', re.IGNORECASE), 'amount')
    ]

    def __init__(self, image_shape: tuple):
        self.img_h, self.img_w = image_shape[:2]
        self.category_classifier = CategoryNLPClassifier()
        self.field_nlp_classifier = FieldNLPClassifier()

    def classify(self, ocr_results: List[OCRResult]) -> Dict[str, Any]:
        """
        Coordinates the 13-step intelligence process.
        """
        advanced_enabled = bool(ENABLE_ADVANCED_RANKING) and CandidateEngine is not None and RankingEngine is not None
        candidate_engine = CandidateEngine() if advanced_enabled else None

        # STEP 1: OCR LINE ANALYSIS
        # Sort and group OCR lines by y-coordinates
        grouped_rows = self._group_ocr_into_rows(ocr_results)

        # STEP 2: DOCUMENT TYPE DETECTION
        doc_type, doc_conf = self._detect_document_type(ocr_results)

        # First pass classification (single block match + spatial search)
        classified = {}
        amounts = []

        for result in ocr_results:
            if result.confidence < 0.4:
                continue
            text = result.text.strip()
            field, value, conf = self._classify_single(text, result)
            if field:
                if candidate_engine is not None:
                    candidate_engine.add_candidate(
                        field,
                        value,
                        source="regex",
                        confidence=float(conf),
                        raw_value=text,
                        ocr_confidence=float(result.confidence),
                        box=tuple(result.box),
                        page_hint=getattr(result, "yolo_hint", None),
                        enable_correction=True,
                    )
                new_conf = int(conf * 100)
                is_better = False
                if field not in classified:
                    is_better = True
                elif new_conf > classified[field]['confidence']:
                    is_better = True
                elif new_conf == classified[field]['confidence']:
                    if field == 'invoice_number':
                        new_has_digit = any(c.isdigit() for c in str(value))
                        curr_has_digit = any(c.isdigit() for c in str(classified[field]['value']))
                        if (new_has_digit and not curr_has_digit) or (len(str(value)) > len(str(classified[field]['value']))):
                            is_better = True

                if is_better:
                    classified[field] = {
                        'value': value,
                        'confidence': int(conf * 100),
                        'source_text': text,
                        'reason': 'Direct Regex Match'
                    }

            # Collect amounts
            amt = self._extract_amount(text)
            if amt and not 'gstin' in text.lower():
                is_quantity_row = False
                for row in grouped_rows:
                    if result in row:
                        row_text_lower = " ".join(r.text.lower() for r in row)
                        has_qty = any(q in row_text_lower for q in ['qty', 'quantity', 'item', 'piece', 'pcs', 'count', 'weight', 'wt'])
                        has_total = any(t in row_text_lower for t in ['total', 'payable', 'net amount', 'gross amount', 'amt.total'])
                        if has_qty and not has_total:
                            is_quantity_row = True
                        break
                if not is_quantity_row and not any(q in text.lower() for q in ['qty', 'quantity', 'item', 'piece', 'pcs', 'count', 'weight', 'wt']):
                    amounts.append((amt, result.box, result.confidence))

        # Spatial Proximity Pairing
        for result in ocr_results:
            if result.confidence < 0.4:
                continue
            text_lower = result.text.lower()
            text = result.text.strip()

            matched_field = None
            expected_type = None

            for field, pat, exp_type in self.KEYS_CONFIG:
                if pat.search(text_lower):
                    if field == 'invoice_date' and any(k in text_lower for k in ['due', 'expiry', 'pay by', 'ship', 'delivery']):
                        continue
                    # Skip tax/amount matching for registration/ID fields
                    if 'amount' in field or 'tax' in field:
                        if any(term in text_lower for term in ['registration', 'reg', 'no', 'number', 'id', 'code']):
                            continue
                    if field == 'invoice_total':
                        if _is_subtotal_label(text_lower):
                            continue
                        if any(q in text_lower for q in ['qty', 'quantity', 'item', 'piece', 'pcs', 'count', 'weight', 'wt']):
                            continue
                        if self._is_tax_or_discount_total(text_lower):
                            continue
                    if field in ['invoice_total', 'subtotal', 'tax_amount', 'balance_due', 'amount_paid']:
                        words = text_lower.split()
                        if len(words) > 5 and any(w in text_lower for w in ['days', 'fee', 'interest', 'within', 'subject', 'added', 'charge']):
                            continue
                        if any(phrase in text_lower for phrase in ['late fee', 'payment is due', 'due within', 'may be added', 'will be']):
                            continue
                    if candidate_engine is None and field in classified and classified[field]['confidence'] >= 85:
                        continue
                    matched_field = field
                    expected_type = exp_type
                    break

            # Fallback to NLP classification if the label consists of a few words
            if not matched_field:
                if len(result.text.split()) <= 4:
                    nlp_field = self.field_nlp_classifier.classify_label(result.text)
                    if nlp_field:
                        if 'amount' in nlp_field or 'tax' in nlp_field:
                            if any(term in text_lower for term in ['registration', 'reg', 'no', 'number', 'id', 'code']):
                                pass
                            else:
                                matched_field = nlp_field
                        elif nlp_field == 'invoice_total' and any(q in text_lower for q in ['qty', 'quantity', 'item', 'piece', 'pcs', 'count', 'weight', 'wt']):
                            pass
                        elif nlp_field in classified and classified[nlp_field]['confidence'] >= 80:
                            pass
                        else:
                            matched_field = nlp_field

                        if matched_field:
                            field_types = {
                                'invoice_number': 'invoice_number',
                                'invoice_date': 'date',
                                'due_date': 'date',
                                'payment_terms': 'text',
                                'balance_due': 'amount',
                                'amount_paid': 'amount',
                                'gst_number': 'gst_number',
                                'subtotal': 'amount',
                                'cgst_amount': 'amount',
                                'sgst_amount': 'amount',
                                'igst_amount': 'amount',
                                'tax_amount': 'amount',
                                'invoice_total': 'amount'
                            }
                            expected_type = field_types.get(matched_field)

            if matched_field and expected_type:
                # First check if the text itself already contains the expected value type
                val_self = None
                if expected_type == 'amount':
                    val_self = self._extract_amount(text)
                elif expected_type == 'date':
                    for pat in PATTERNS['date']:
                        m = pat.search(text)
                        if m:
                            val_self = normalize_date(m.group(1))
                            break
                elif expected_type == 'gst_number':
                    for pat in PATTERNS['gst_number']:
                        m = pat.search(text)
                        if m:
                            val_self = normalize_gstin(m.group(1))
                            break
                    if not val_self and ('gstin' in text_lower or 'gst number' in text_lower):
                        m = re.search(r'\b([A-Z0-9]{10,15})\b', text.upper())
                        if m:
                            val_self = normalize_gstin(m.group(1))
                elif expected_type == 'invoice_number':
                    for pat in PATTERNS['invoice_number']:
                        m = pat.search(text)
                        if m:
                            val_self = normalize_invoice_number(m.group(1))
                            break

                if val_self is not None:
                    match = (val_self, 0.90, result)
                else:
                    match = self._find_neighbor_value(result, ocr_results, expected_type, field=matched_field)

                if match:
                    val, conf, neighbor_result = match
                    is_nlp = not any(pat.search(text_lower) for field, pat, exp_type in self.KEYS_CONFIG if field == matched_field)
                    final_conf = int(conf * 100) if not is_nlp else 75

                    if candidate_engine is not None:
                        candidate_engine.add_candidate(
                            matched_field,
                            val,
                            source="spatial" if not is_nlp else "nlp",
                            confidence=float(final_conf) / 100.0,
                            raw_value=neighbor_result.text.strip(),
                            ocr_confidence=float(neighbor_result.confidence),
                            box=tuple(neighbor_result.box),
                            page_hint=getattr(neighbor_result, "yolo_hint", None),
                            enable_correction=True,
                        )

                    is_better = False
                    if matched_field not in classified:
                        is_better = True
                    elif final_conf > classified[matched_field]['confidence']:
                        is_better = True
                    if is_better:
                        classified[matched_field] = {
                            'value': val,
                            'confidence': final_conf,
                            'source_text': f"{result.text.strip()} -> {neighbor_result.text.strip()}",
                            'reason': f"Horizontal Spatial Match near '{result.text}'" + (" (NLP fallback)" if is_nlp else "")
                        }
                        if expected_type == 'amount':
                            amounts.append((val, neighbor_result.box, neighbor_result.confidence))



        # Table Column fallback extraction
        table_fields = self._extract_from_tables(ocr_results)
        for field, info in table_fields.items():
            if candidate_engine is not None:
                candidate_engine.add_candidate(
                    field,
                    info.get("value"),
                    source="table",
                    confidence=float(info.get("confidence", 0.0)),
                    raw_value=info.get("source_text"),
                    enable_correction=True,
                )
            is_better = False
            if field not in classified:
                is_better = True
            elif int(info['confidence'] * 100) > classified[field]['confidence']:
                is_better = True
            if is_better:
                classified[field] = {
                    'value': info['value'],
                    'confidence': int(info['confidence'] * 100),
                    'source_text': info['source_text'],
                    'reason': 'Table column extraction'
                }

        # STEP 3: VENDOR EXTRACTION
        vendor_name, vendor_conf, vendor_reason = self._extract_vendor_name(ocr_results)
        if candidate_engine is not None:
            candidate_engine.add_candidate(
                "vendor_name",
                vendor_name,
                source="vendor",
                confidence=float(vendor_conf),
                raw_value=str(vendor_name),
                enable_correction=False,
            )
        vendor_gstin = classified.get('gst_number', {}).get('value')
        # Simple vendor address extraction (look for lines containing city, road, pincode)
        vendor_address = None
        for res in ocr_results:
            if res.confidence >= 0.4 and any(kw in res.text.lower() for kw in ['street', 'road', 'nagar', 'floor', 'building', 'opposite']):
                if not any(kw in res.text.lower() for kw in ['bill to', 'ship to', 'buyer', 'customer']):
                    vendor_address = res.text.strip()
                    break

        # STEP 4: CUSTOMER EXTRACTION
        customer_info = self._extract_customer_info(ocr_results)

        # STEP 5: INVOICE DETAILS
        inv_no = classified.get('invoice_number', {}).get('value')
        inv_date = classified.get('invoice_date', {}).get('value')
        due_date = classified.get('due_date', {}).get('value')

        # STEP 6: TAX EXTRACTION
        cgst = classified.get('cgst_amount', {}).get('value')
        sgst = classified.get('sgst_amount', {}).get('value')
        igst = classified.get('igst_amount', {}).get('value')
        tax_amount = classified.get('tax_amount', {}).get('value')

        # Positional grand total check
        if amounts and 'invoice_total' not in classified:
            best = self._find_total_by_position(amounts, classified)
            if best:
                if candidate_engine is not None:
                    candidate_engine.add_candidate(
                        "invoice_total",
                        best[0],
                        source="positional",
                        confidence=0.75,
                        raw_value=str(best[0]),
                        ocr_confidence=float(best[2]) if best[2] is not None else None,
                        box=tuple(best[1]),
                        enable_correction=False,
                    )
                classified['invoice_total'] = {
                    'value': best[0],
                    'confidence': 75,
                    'source_text': f"Found {best[0]} near bottom of page",
                    'reason': 'Positional heuristic: bottom largest value'
                }

        # STEP 7: AMOUNT EXTRACTION
        subtotal = classified.get('subtotal', {}).get('value')
        grand_total = classified.get('invoice_total', {}).get('value')

        # STEP 8: PAYMENT INFORMATION
        payment_method, pay_conf, pay_reason = self._extract_payment_method(ocr_results)
        tx_id, tx_conf, tx_reason = self._extract_transaction_id(ocr_results)

        # STEP 9: PRODUCT TABLE EXTRACTION
        items = self._extract_product_table(ocr_results)
        if advanced_enabled and TableReconstructor is not None:
            try:
                recon = TableReconstructor(self.img_w, self.img_h)
                items = recon.reconstruct(items, ocr_results)
            except Exception:
                # Do not alter legacy behavior on reconstructor failure
                pass

        # Pre-compute line-items sum for advanced consistency checks.
        items_total = 0.0
        try:
            line_totals = []
            for it in items or []:
                lt = it.get("line_total", 0.0)
                try:
                    lt_f = float(lt)
                except Exception:
                    lt_f = 0.0
                line_totals.append(lt_f)
            items_total = float(sum(line_totals)) if line_totals else 0.0
        except Exception:
            items_total = 0.0

        # STEP 10: CATEGORY CLASSIFICATION
        category = self._classify_category(ocr_results)

        # STEP 11: BUSINESS VALIDATION & REPAIRS
        warnings = []
        # Support missing tax_amount if IGST or CGST/SGST exist
        if tax_amount is None:
            if igst is not None:
                tax_amount = igst
            elif cgst is not None and sgst is not None:
                tax_amount = cgst + sgst

        # GST Check: CGST + SGST = Tax Amount
        if cgst is not None and sgst is not None:
            calc_tax = cgst + sgst
            if tax_amount is not None:
                if abs(calc_tax - tax_amount) > 1.0:
                    warnings.append(f"Tax validation mismatch: CGST ({cgst}) + SGST ({sgst}) != Tax Amount ({tax_amount})")
            else:
                tax_amount = calc_tax
        elif tax_amount is not None and cgst is None and sgst is None and (igst is None or igst == 0.0):
            # Repair cgst/sgst as halves of tax_amount ONLY if IGST is not present
            cgst = sgst = tax_amount / 2.0

        # Subtotal + Tax = Grand Total check
        if subtotal is not None and tax_amount is not None and grand_total is not None:
            expected = subtotal + tax_amount
            if abs(expected - grand_total) > 2.0:
                warnings.append(f"Grand Total validation mismatch: Subtotal ({subtotal}) + Tax ({tax_amount}) != Total ({grand_total})")

        # Date validation check
        if inv_date:
            try:
                parsed_d = _parse_known_date_formats(inv_date)
                if parsed_d and parsed_d > datetime.date.today():
                    warnings.append(f"Invoice Date ({inv_date}) is in the future")
            except Exception:
                pass

        # Validate GSTIN format
        if vendor_gstin and len(vendor_gstin) != 15:
            warnings.append(f"GSTIN {vendor_gstin} has invalid length ({len(vendor_gstin)} instead of 15)")

        # STEP 12: CONFIDENCE SCORING
        # Generate confidence dictionary for fields
        confidence_dict = {
            "document_type": int(doc_conf * 100),
            "vendor_name": classified.get('vendor_name', {}).get('confidence', int(vendor_conf * 100)),
            "invoice_number": classified.get('invoice_number', {}).get('confidence', 0),
            "invoice_date": classified.get('invoice_date', {}).get('confidence', 0),
            "grand_total": classified.get('invoice_total', {}).get('confidence', 0)
        }

        # STEP 13: OUTPUT JSON FORMATTING
        def make_field(val, conf, src="", reas=""):
            return {
                "value": val,
                "confidence": conf if conf is not None else 0,
                "source_text": src,
                "reason": reas
            }

        # Advanced candidate ranking (must not affect legacy flow when disabled)
        if advanced_enabled and candidate_engine is not None:
            try:
                ranker = RankingEngine(self.img_w, self.img_h)
                ctx_vals = {
                    "invoice_total": grand_total,
                    "subtotal": subtotal,
                    "tax_amount": tax_amount,
                    "items_total": items_total,
                    "balance_due": classified.get('balance_due', {}).get('value'),
                }
                for fld, var_name in [
                    ("invoice_total", "grand_total"),
                    ("subtotal", "subtotal"),
                    ("tax_amount", "tax_amount"),
                    ("gst_number", "vendor_gstin"),
                    ("invoice_number", "inv_no"),
                    ("invoice_date", "inv_date"),
                    ("due_date", "due_date"),
                    ("vendor_name", "vendor_name"),
                ]:
                    cands = candidate_engine.bundle.get(fld)
                    if not cands:
                        continue
                    choice = ranker.rank_field(fld, cands, context_values=ctx_vals)
                    if not choice:
                        continue

                    # Update classified dict where applicable (keeping schema stable)
                    if fld in {"invoice_total", "subtotal", "tax_amount", "gst_number", "invoice_number", "invoice_date", "due_date"}:
                        classified[fld] = {
                            "value": choice.value,
                            "confidence": int(max(0.0, min(100.0, choice.score))),
                            "source_text": (choice.chosen_candidate.raw_value or "")[:250],
                            "reason": f"Advanced ranking ({choice.reason})"
                        }

                    # Update local variables used in final JSON
                    if fld == "invoice_total":
                        grand_total = choice.value
                        ctx_vals["invoice_total"] = grand_total
                    elif fld == "subtotal":
                        subtotal = choice.value
                        ctx_vals["subtotal"] = subtotal
                    elif fld == "tax_amount":
                        tax_amount = choice.value
                        ctx_vals["tax_amount"] = tax_amount
                    elif fld == "gst_number":
                        vendor_gstin = choice.value
                    elif fld == "invoice_number":
                        inv_no = choice.value
                    elif fld == "invoice_date":
                        inv_date = choice.value
                    elif fld == "due_date":
                        due_date = choice.value
                    elif fld == "vendor_name":
                        vendor_name = choice.value
            except Exception:
                # Ranking failures must never break legacy output
                pass

        # Resolve due date and payment status after candidate ranking (to use the best ranked fields)
        payment_terms = classified.get('payment_terms', {}).get('value')
        balance_due = classified.get('balance_due', {}).get('value')
        amount_paid = classified.get('amount_paid', {}).get('value')

        due_date = resolve_due_date(due_date, payment_terms, inv_date)

        subtotal, grand_total = _reconcile_amount_fields(
            subtotal, grand_total, balance_due, tax_amount
        )

        currency = _extract_currency_from_ocr(ocr_results)

        full_text = " ".join(r.text for r in ocr_results)
        payment_status, status_reason = resolve_payment_status(
            full_text=full_text,
            balance_due=balance_due,
            amount_paid=amount_paid,
            total_amount=grand_total,
            due_date_str=due_date
        )

        return {
            "document_type": doc_type,
            "vendor": {
                "vendor_name": make_field(vendor_name, confidence_dict.get("vendor_name"), "", vendor_reason),
                "vendor_address": make_field(vendor_address, 70 if vendor_address else 0, vendor_address or "", "Heuristic spatial lookup"),
                "vendor_gstin": make_field(vendor_gstin, classified.get('gst_number', {}).get('confidence'), vendor_gstin or "", "Pattern Match"),
                "vendor_email": make_field(classified.get('vendor_email', {}).get('value'), classified.get('vendor_email', {}).get('confidence'), "", "Pattern Match"),
                "vendor_phone": make_field(classified.get('vendor_phone', {}).get('value'), classified.get('vendor_phone', {}).get('confidence'), "", "Pattern Match")
            },
            "customer": {
                "customer_name": make_field(customer_info.get("customer_name"), 80 if customer_info.get("customer_name") else 0, "", "Near buyer headers"),
                "customer_company": make_field(customer_info.get("customer_company"), 80 if customer_info.get("customer_company") else 0, "", "Near buyer headers"),
                "customer_address": make_field(customer_info.get("customer_address"), 70 if customer_info.get("customer_address") else 0, "", "Near buyer headers"),
                "customer_gstin": make_field(customer_info.get("customer_gstin"), 90 if customer_info.get("customer_gstin") else 0, "", "Pattern Match under Customer section")
            },
            "invoice_details": {
                "invoice_number": make_field(inv_no, classified.get('invoice_number', {}).get('confidence'), "", "Alphanumeric text near Invoice ID keywords"),
                "invoice_date": make_field(inv_date, classified.get('invoice_date', {}).get('confidence'), "", "Date regex match"),
                "due_date": make_field(due_date, classified.get('due_date', {}).get('confidence') or 80, "", "Date regex match or payment terms calculation")
            },
            "amounts": {
                "subtotal": make_field(subtotal, classified.get('subtotal', {}).get('confidence'), "", "Numeric amount near Subtotal keywords"),
                "grand_total": make_field(grand_total, classified.get('invoice_total', {}).get('confidence'), "", "Largest bottom amount or matched label")
            },
            "taxes": {
                "cgst_amount": make_field(cgst, classified.get('cgst_amount', {}).get('confidence'), "", "Tax value near CGST keywords"),
                "sgst_amount": make_field(sgst, classified.get('sgst_amount', {}).get('confidence'), "", "Tax value near SGST keywords"),
                "igst_amount": make_field(igst, classified.get('igst_amount', {}).get('confidence'), "", "Tax value near IGST keywords"),
                "tax_amount": make_field(tax_amount, classified.get('tax_amount', {}).get('confidence'), "", "CGST+SGST or tax label sum")
            },
            "payment": {
                "payment_method": make_field(payment_method, pay_conf, "", pay_reason),
                "transaction_id": make_field(tx_id, tx_conf, "", tx_reason),
                "payment_terms": make_field(payment_terms, classified.get('payment_terms', {}).get('confidence'), "", "Terms text"),
                "balance_due": make_field(balance_due, classified.get('balance_due', {}).get('confidence'), "", "Outstanding amount due"),
                "amount_paid": make_field(amount_paid, classified.get('amount_paid', {}).get('confidence'), "", "Amount paid")
            },
            "payment_status": payment_status,
            "status_reason": status_reason,
            "items": items,
            "category": category,
            "currency": currency,
            "confidence": confidence_dict,
            "warnings": warnings
        }

    def _detect_document_type(self, ocr_results: List[OCRResult]) -> tuple:
        text_full = " ".join(r.text for r in ocr_results).lower()

        # Categorized keywords
        kw_map = {
            "GST Invoice": ["gstin", "gst invoice", "gst no", "gst number"],
            "Tax Invoice": ["tax invoice"],
            "Retail Receipt": ["retail receipt", "cashier", "change due", "store #", "receipt"],
            "Restaurant Bill": ["restaurant", "waiter", "food", "table #", "cafe", "menu"],
            "Fuel Receipt": ["fuel", "petrol", "diesel", "gas station", "nozzle"],
            "Medical Invoice": ["medical", "pharmacy", "hospital", "doctor", "rx", "medicine"],
            "Ecommerce Invoice": ["amazon", "flipkart", "order reference", "shipment"],
            "Utility Bill": ["utility", "electricity", "water bill", "power", "telecom", "broadband"],
            "Purchase Bill": ["purchase bill", "purchase order"],
            "Service Invoice": ["service invoice", "consulting", "hourly rate"]
        }

        for doc_type, kws in kw_map.items():
            if any(kw in text_full for kw in kws):
                return doc_type, 0.95

        return "Retail Receipt", 0.60

    def _extract_vendor_name(self, ocr_results: List[OCRResult]) -> tuple:
        top_results = [
            r for r in ocr_results
            if r.confidence >= 0.4 and (r.box[1] + r.box[3]) / 2.0 / self.img_h < 0.30
        ]
        top_results.sort(key=lambda r: (r.box[1], r.box[0]))

        for r in ocr_results:
            text_lower = r.text.lower()
            if any(term in text_lower for term in ["sold by", "supplier", "vendor", "merchant"]):
                match = self._find_neighbor_value(r, ocr_results, "text")
                if match and not _looks_like_address_line(match[0]):
                    return match[0], 0.95, f"Near '{r.text}' label"

        best_name = None
        best_score = -1.0
        for r in top_results:
            text = r.text.strip()
            score = _score_vendor_candidate(text)
            if score > best_score:
                best_score = score
                best_name = text

        if best_name and best_score > 0:
            return best_name, 0.85, "Best-scored top-region business name"

        return "Unknown Merchant", 0.40, "Fallback default"

    def _extract_customer_info(self, ocr_results: List[OCRResult]) -> dict:
        cust = {"customer_name": None, "customer_company": None, "customer_address": None, "customer_gstin": None}
        headers_pat = re.compile(r'\b(bill\s*to|ship\s*to|customer|buyer|buyer\s*details|client)\b', re.IGNORECASE)

        target_res = None
        for res in ocr_results:
            if headers_pat.search(res.text):
                target_res = res
                break

        if target_res:
            tx1, ty1, tx2, ty2 = target_res.box
            candidates = []
            for r in ocr_results:
                if r.confidence < 0.4 or r == target_res:
                    continue
                rx1, ry1, rx2, ry2 = r.box
                if ry1 > ty1 and ry1 < ty2 + 150 and abs((rx1+rx2)/2.0 - (tx1+tx2)/2.0) < 200:
                    candidates.append(r)
            candidates.sort(key=lambda r: r.box[1])

            address_lines = []
            for c in candidates:
                txt = c.text.strip()
                txt_lower = txt.lower()
                # Stop if we hit the table headers to avoid leakage
                if any(kw in txt_lower for kw in ['description', 'qty', 'oty', 'unit price', 'particulars', 'hsn', 'serial no', 's.no', 'tax type', 'tax rate']):
                    break
                if not cust["customer_name"] and any(x.isalpha() for x in txt) and not any(kw in txt_lower for kw in ["gstin", "gst no", "gst", "phone", "email"]):
                    cust["customer_name"] = txt
                    cust["customer_company"] = txt
                elif not cust["customer_gstin"] and any(kw in txt_lower for kw in ["gstin", "gst no", "gst"]):
                    m = re.search(r'\b([A-Z0-9]{15})\b', txt.upper())
                    if m:
                        cust["customer_gstin"] = normalize_gstin(m.group(1))
                else:
                    if len(txt) > 5 and not any(kw in txt_lower for kw in ["gstin", "gst no"]):
                        address_lines.append(txt)

            if address_lines:
                cust["customer_address"] = ", ".join(address_lines)

        return cust

    def _extract_payment_method(self, ocr_results: List[OCRResult]) -> tuple:
        # Define header keywords for payment/bank sections
        header_kws = ["payment information", "payment info", "payment details", "bank details", "bank info", "payment instructions", "bank transfer info", "bank credentials"]
        # Define explicit detail keywords
        detail_kws = [
            "account name", "a/c name", "account number", "account no", "account no.", "a/c no", "a/c no.",
            "bank name", "bank:", "ifsc", "iban", "swift", "routing number", "routing no", "sort code",
            "beneficiary", "pay to:", "payment to:", "deposit to:", "transfer to:"
        ]

        candidates = []

        # 1. Search for a payment section header
        header_res = None
        for r in ocr_results:
            if r.confidence < 0.4:
                continue
            txt_low = r.text.lower()
            if any(hk in txt_low for hk in header_kws) and not any(dk in txt_low for dk in ["account", "invoice", "date", "customer"]):
                header_res = r
                break

        if header_res:
            hx1, hy1, hx2, hy2 = header_res.box
            for r in ocr_results:
                if r == header_res or r.confidence < 0.4:
                    continue
                rx1, ry1, rx2, ry2 = r.box
                # If the line is vertically below the header and within 250px vertical distance
                if ry1 > hy1 - 10 and ry1 < hy2 + 250:
                    # Check horizontal alignment
                    is_aligned = False
                    if abs(rx1 - hx1) < 150:
                        is_aligned = True
                    elif rx1 >= hx1 - 50 and rx1 <= hx2 + 150:
                        is_aligned = True
                    elif min(rx2, hx2) - max(rx1, hx1) > -50:
                        is_aligned = True

                    if is_aligned:
                        txt_low = r.text.lower()
                        # Exclude unrelated terms to avoid capturing other sections or footers
                        if not any(w in txt_low for w in ["billed to", "ship to", "invoice no", "total", "subtotal", "tax", "gstin", "description", "qty", "amount"]):
                            if r not in candidates:
                                candidates.append(r)

        # 2. Add any lines that explicitly contain detail keywords
        for r in ocr_results:
            if r.confidence < 0.4:
                continue
            txt_low = r.text.lower()
            if any(dk in txt_low for dk in detail_kws):
                # Avoid false matches on invoice/phone numbers
                if not any(w in txt_low for w in ["invoice no", "phone no", "serial no", "s.no"]):
                    if r not in candidates:
                        candidates.append(r)

        # 3. Expand candidates: capture adjacent lines in the same block
        if candidates:
            min_y = min(c.box[1] for c in candidates)
            max_y = max(c.box[3] for c in candidates)
            avg_x1 = sum(c.box[0] for c in candidates) / len(candidates)

            additional = []
            for r in ocr_results:
                if r.confidence < 0.4 or r in candidates or r == header_res:
                    continue
                rx1, ry1, rx2, ry2 = r.box
                if ry1 > min_y - 45 and ry2 < max_y + 45:
                    if abs(rx1 - avg_x1) < 120:
                        txt_low = r.text.lower()
                        if not any(w in txt_low for w in ["billed to", "ship to", "invoice no", "total", "subtotal", "tax", "gstin", "description", "qty", "amount"]):
                            additional.append(r)
            for add_r in additional:
                if add_r not in candidates:
                    candidates.append(add_r)

        if candidates:
            # Sort candidates by vertical position, then by horizontal position
            sorted_candidates = sorted(candidates, key=lambda r: (r.box[1], r.box[0]))
            payment_info_str = ", ".join(c.text.strip() for c in sorted_candidates if c.text.strip())
            if payment_info_str:
                # Truncate to 250 characters to fit database columns safely
                if len(payment_info_str) > 250:
                    payment_info_str = payment_info_str[:247] + "..."
                return payment_info_str, 95, "Extracted payment/bank details from document"

        # 4. Fallback to keyword matching
        payment_kws = {
            "UPI": ["upi", "gpay", "phonepe", "paytm", "bhim"],
            "Card": ["card", "visa", "mastercard", "credit", "debit", "amex"],
            "Cash": ["cash", "tendered", "change due", "cashier"],
            "Net Banking": ["net banking", "bank transfer", "neft", "rtgs", "imps"],
            "Wallet": ["wallet", "mobikwik", "freecharge"]
        }
        for res in ocr_results:
            text_lower = res.text.lower()
            for method, kws in payment_kws.items():
                if any(kw in text_lower for kw in kws):
                    return method, 90, f"Matched keyword: '{res.text}'"
        return "Cash", 50, "Default fallback"

    def _extract_transaction_id(self, ocr_results: List[OCRResult]) -> tuple:
        tx_patterns = [
            re.compile(r'\b(?:tx|txn|transaction|ref|reference)\s*(?:id|no\.?|number)?\s*[:#-]?\s*([A-Za-z0-9]{8,20})\b', re.IGNORECASE),
            re.compile(r'\b(?:upi|ref)\s*no\.?\s*([0-9]{12})\b', re.IGNORECASE)
        ]
        for res in ocr_results:
            for pat in tx_patterns:
                m = pat.search(res.text)
                if m:
                    return m.group(1), 95, f"Pattern matched in: '{res.text}'"
        return None, 0, "Not found"

    def _extract_product_table(self, ocr_results: List[OCRResult]) -> List[Dict[str, Any]]:
        items = []
        rows = self._group_ocr_into_rows(ocr_results)

        item_headers = {
            'item_name': ['description', 'item', 'product', 'particulars'],
            'quantity': ['qty', 'quantity', 'qty.', 'qnty', 'count', 'nos', 'oty', 'qty/oty'],
            'unit_price': ['rate', 'unit price', 'price', 'unit_price', 'rate/unit'],
            'tax_rate': ['tax rate', 'tax%', 'gst%', 'rate%'],
            'tax_amount': ['tax amount', 'gst amount', 'tax amt', 'tax amoun', 'tax value', 'tax amt.', 'tax amt'],
            'line_total': ['total', 'amount', 'total amount', 'net amount', 'value', 'line total', 'amoun', 'amt']
        }

        # 1. Identify which rows are header candidates
        header_candidate_indices = []
        for r_idx, row in enumerate(rows):
            for cell in row:
                text_lower = cell.text.lower()
                matched_any = False
                for key, kws in item_headers.items():
                    # Safeguard: tax/gst columns should not match line_total or unit_price
                    if key in ['line_total', 'unit_price'] and any(t in text_lower for t in ['tax', 'gst', 'cgst', 'sgst', 'igst']):
                        continue
                    # Safeguard: description/item columns should not match quantities/amounts
                    if key in ['quantity', 'unit_price', 'tax_rate', 'tax_amount', 'line_total'] and any(t in text_lower for t in ['description', 'particulars', 'item', 'product']):
                        continue
                    if any(kw == text_lower or (len(kw) > 3 and kw in text_lower) for kw in kws):
                        matched_any = True
                        break
                if matched_any:
                    header_candidate_indices.append(r_idx)
                    break

        # Find main header row index containing item_name keywords
        main_header_idx = -1
        for r_idx in header_candidate_indices:
            row = rows[r_idx]
            if any(any(kw in cell.text.lower() for kw in ['description', 'particulars', 'item', 'product']) for cell in row):
                main_header_idx = r_idx
                break

        if main_header_idx == -1:
            return []

        # Collect all rows within 35px vertically of the main header row
        header_rows_idx = [main_header_idx]
        main_cy = sum((c.box[1]+c.box[3])/2.0 for c in rows[main_header_idx]) / len(rows[main_header_idx])

        for r_idx in header_candidate_indices:
            if r_idx == main_header_idx:
                continue
            cy = sum((c.box[1]+c.box[3])/2.0 for c in rows[r_idx]) / len(rows[r_idx])
            if abs(cy - main_cy) < 35:
                header_rows_idx.append(r_idx)

        # Merge vertically aligned cells in the header rows
        all_header_cells = []
        for r_idx in header_rows_idx:
            all_header_cells.extend(rows[r_idx])

        merged_header_cells = []
        used_cell_ids = set()
        for cell1 in sorted(all_header_cells, key=lambda c: c.box[1]):
            if cell1.region_id in used_cell_ids:
                continue
            best_cell2 = None
            min_dist = 9999.0
            cx1 = (cell1.box[0] + cell1.box[2]) / 2.0
            cy1 = (cell1.box[1] + cell1.box[3]) / 2.0
            for cell2 in all_header_cells:
                if cell2 == cell1 or cell2.region_id in used_cell_ids:
                    continue
                cx2 = (cell2.box[0] + cell2.box[2]) / 2.0
                cy2 = (cell2.box[1] + cell2.box[3]) / 2.0
                # Check alignment
                if abs(cx1 - cx2) < 25.0 and abs(cy1 - cy2) < 25.0:
                    if cell1.box[1] < cell2.box[1]: # cell1 is above cell2
                        dist = abs(cy1 - cy2)
                        if dist < min_dist:
                            min_dist = dist
                            best_cell2 = cell2
            if best_cell2:
                merged_text = cell1.text + " " + best_cell2.text
                merged_box = (
                    min(cell1.box[0], best_cell2.box[0]),
                    min(cell1.box[1], best_cell2.box[1]),
                    max(cell1.box[2], best_cell2.box[2]),
                    max(cell1.box[3], best_cell2.box[3])
                )
                merged_header_cells.append(OCRResult(cell1.region_id, merged_text, cell1.confidence, merged_box, 'merged_header'))
                used_cell_ids.add(cell1.region_id)
                used_cell_ids.add(best_cell2.region_id)
            else:
                merged_header_cells.append(cell1)
                used_cell_ids.add(cell1.region_id)

        # Now find matching column headers in merged_header_cells
        headers_found = {}
        for cell in merged_header_cells:
            text_lower = cell.text.lower()
            for key, kws in item_headers.items():
                # Safeguard: tax/gst columns should not match line_total or unit_price
                if key in ['line_total', 'unit_price'] and any(t in text_lower for t in ['tax', 'gst', 'cgst', 'sgst', 'igst']):
                    continue
                # Safeguard: description/item columns should not match quantities/amounts
                if key in ['quantity', 'unit_price', 'tax_rate', 'tax_amount', 'line_total'] and any(t in text_lower for t in ['description', 'particulars', 'item', 'product']):
                    continue
                if any(kw == text_lower or (len(kw) > 3 and kw in text_lower) for kw in kws):
                    headers_found[key] = {
                        'x1': cell.box[0],
                        'x2': cell.box[2],
                        'cx': (cell.box[0] + cell.box[2]) / 2.0
                    }

        # Check if valid
        if len(headers_found) < 2 or ('item_name' not in headers_found and 'line_total' not in headers_found):
            return []

        header_row_idx = max(header_rows_idx)

        if header_row_idx != -1:
            raw_items = []
            for r_idx in range(header_row_idx + 1, len(rows)):
                row = self._split_merged_cells(rows[r_idx])
                row_text = " ".join(c.text for c in row).lower()
                # Stop if we reach a summary/total row
                if any(term in row_text for term in ['subtotal', 'sub-total', 'amount in words', 'terms', 'conditions', 'authorized', 'signatory']):
                    break
                if 'total' in row_text:
                    # If it's a summary row and not a description/product line
                    if len(row) <= 3 and not any(kw in row_text for kw in ['qty', 'rate', 'price', 'description']):
                        break

                item = {}
                for col_name, col_meta in headers_found.items():
                    cx = col_meta['cx']
                    best_cell = None
                    min_dist = 9999.0
                    for cell in row:
                        ccx = (cell.box[0] + cell.box[2]) / 2.0
                        dist = abs(ccx - cx)
                        if dist < min_dist:
                            min_dist = dist
                            best_cell = cell

                    if best_cell and min_dist < 120.0:
                        txt = best_cell.text.strip()
                        if col_name == 'item_name':
                            item['item_name'] = txt
                        elif col_name == 'quantity':
                            nums = re.findall(r'\d+', txt)
                            item['quantity'] = int(nums[0]) if nums else 1
                        elif col_name == 'unit_price':
                            val = self._extract_amount(txt)
                            item['unit_price'] = val if val is not None else 0.0
                        elif col_name == 'tax_rate':
                            nums = re.findall(r'\d+(?:\.\d+)?', txt)
                            item['tax_rate'] = float(nums[0]) if nums else 0.0
                        elif col_name == 'tax_amount':
                            val = self._extract_amount(txt)
                            item['tax_amount'] = val if val is not None else 0.0
                        elif col_name == 'line_total':
                            val = self._extract_amount(txt)
                            item['line_total'] = val if val is not None else 0.0

                if item and ('item_name' in item or 'line_total' in item):
                    raw_items.append(item)

            # Merge multi-line item description anchors
            anchors = []
            current_desc_buffer = []
            for item in raw_items:
                has_price = 'line_total' in item or 'unit_price' in item
                if has_price:
                    desc = " ".join(current_desc_buffer)
                    name = item.get('item_name', '')
                    if desc:
                        item['item_name'] = (desc + " " + name).strip()
                    current_desc_buffer = []
                    anchors.append(item)
                else:
                    if anchors:
                        name = item.get('item_name', '')
                        if name:
                            existing_name = anchors[-1].get('item_name', '')
                            anchors[-1]['item_name'] = (existing_name + " " + name).strip()
                    else:
                        name = item.get('item_name', '')
                        if name:
                            current_desc_buffer.append(name)

            if current_desc_buffer and not anchors:
                anchors.append({'item_name': " ".join(current_desc_buffer)})

            # Populate fields
            for item in anchors:
                if 'item_name' not in item:
                    item['item_name'] = "Unknown Item"
                if 'quantity' not in item:
                    item['quantity'] = 1
                if 'unit_price' not in item and 'line_total' in item:
                    item['unit_price'] = item['line_total'] / item['quantity']
                if 'line_total' not in item and 'unit_price' in item:
                    item['line_total'] = item['unit_price'] * item['quantity']

                hsn_match = re.search(r'\b(?:hsn|sac)(?:\s*code)?\s*[:\-\s]?\s*([a-z0-9]{4,10})\b', item.get('item_name', '').lower())
                hsn = hsn_match.group(1).upper() if hsn_match else None

                items.append({
                    "item_name": item.get('item_name', 'Unknown Item'),
                    "item_description": item.get('item_name', ''),
                    "hsn_code": hsn,
                    "quantity": item.get('quantity', 1),
                    "unit_price": item.get('unit_price', 0.0),
                    "tax_rate": item.get('tax_rate', 0.0),
                    "tax_amount": item.get('tax_amount', 0.0),
                    "line_total": item.get('line_total', 0.0)
                })
        return items

    def _classify_category(self, ocr_results: List[OCRResult]) -> str:
        text_full = " ".join(r.text for r in ocr_results)
        return self.category_classifier.classify(text_full)

    def _find_matching_value_near(self, target_value: float, key_word: str, ocr_results: List[OCRResult]) -> Optional[float]:
        keywords_map = {
            'cgst': {'cgst', 'c.g.s.t', 'c-gst', 'c gst', 'ccst', 'c6st'},
            'sgst': {'sgst', 's.g.s.t', 's-gst', 's gst', 'scst', 's6st', 's6s1', 's.g.s.1'}
        }
        target_kws = keywords_map.get(key_word, {key_word})

        for res in ocr_results:
            text_lower = res.text.lower()
            if any(kw in text_lower for kw in target_kws):
                val = self._extract_amount(res.text)
                if val is not None and abs(val - target_value) < 0.01:
                    return val
                match = self._find_neighbor_value(res, ocr_results, 'amount')
                if match and abs(match[0] - target_value) < 0.01:
                    return match[0]

        for res in ocr_results:
            val = self._extract_amount(res.text)
            if val is not None and abs(val - target_value) < 0.01:
                return val
        return None

    def _classify_single(self, text: str, result: OCRResult):
        text_lower = text.lower()

        is_terms_sentence = False
        words = text_lower.split()
        if len(words) > 5 and any(w in text_lower for w in ['days', 'fee', 'interest', 'within', 'subject', 'added', 'charge']):
            is_terms_sentence = True
        if any(phrase in text_lower for phrase in ['late fee', 'payment is due', 'due within', 'may be added', 'will be']):
            is_terms_sentence = True

        # --- Invoice Number ---
        for pat in PATTERNS['invoice_number']:
            m = pat.search(text)
            if m:
                val = m.group(1)
                val_clean = val.strip()
                # If the value contains/is a date, or starts with 'date', skip it
                if any(d_pat.search(val_clean) for d_pat in PATTERNS['date']):
                    continue
                if val_clean.lower().startswith('date'):
                    continue
                if val_clean.lower() in ['date', 'bill', 'invoice', 'supply', 'memo', 'receipt', 'tax invoice']:
                    continue
                return 'invoice_number', normalize_invoice_number(val), 0.95

        # --- GST Number (high-confidence pattern & fallback) ---
        for pat in PATTERNS['gst_number']:
            m = pat.search(text)
            if m:
                return 'gst_number', normalize_gstin(m.group(1)), 0.98
        if 'gstin' in text_lower or 'gst number' in text_lower:
            m = re.search(r'\b([A-Z0-9]{10,15})\b', text.upper())
            if m:
                return 'gst_number', normalize_gstin(m.group(1)), 0.85

        # --- Date ---
        for pat in PATTERNS['date']:
            m = pat.search(text)
            if m:
                label = 'invoice_date'
                if any(k in text_lower for k in ['due', 'expiry', 'pay by']):
                    label = 'due_date'
                return label, normalize_date(m.group(1)), 0.90

        # --- Tax fields ---
        if any(k in text_lower for k in ['cgst', 'sgst', 'igst', 'gst']) and not 'gstin' in text_lower:
            if not any(term in text_lower for term in ['registration', 'reg', 'no', 'number', 'id', 'code']):
                amt = self._extract_amount(text)
                if amt:
                    label = 'tax_amount'
                    if 'cgst' in text_lower:
                        label = 'cgst_amount'
                    elif 'sgst' in text_lower:
                        label = 'sgst_amount'
                    elif 'igst' in text_lower:
                        label = 'igst_amount'
                    return label, amt, 0.88

        # --- Total (keyword-based) ---
        if not is_terms_sentence and any(k in text_lower for k in KEYWORDS['total']):
            if not _is_subtotal_label(text_lower):
                if not any(q in text_lower for q in ['qty', 'quantity', 'item', 'piece', 'pcs', 'count', 'weight', 'wt']):
                    amt = self._extract_amount(text)
                    if amt:
                        return 'invoice_total', amt, 0.92

        # --- Subtotal ---
        if not is_terms_sentence and any(k in text_lower for k in KEYWORDS['subtotal']):
            amt = self._extract_amount(text)
            if amt:
                return 'subtotal', amt, 0.88

        # --- Balance Due / Amount Paid ---
        if not is_terms_sentence and any(k in text_lower for k in ['balance due', 'outstanding amount', 'amount due', 'outstanding', 'balance', 'bal due']):
            amt = self._extract_amount(text)
            if amt is not None:
                return 'balance_due', amt, 0.90
        if not is_terms_sentence and any(k in text_lower for k in ['amount paid', 'paid amount', 'paid', 'amt paid']):
            if not any(tax_k in text_lower for tax_k in ['tax', 'gst', 'cgst', 'sgst', 'igst']):
                amt = self._extract_amount(text)
                if amt is not None:
                    return 'amount_paid', amt, 0.90

        # --- Payment Terms ---
        if any(k in text_lower for k in ['payment terms', 'terms']):
            m = re.search(r'(?:payment\s+)?terms\s*:?\s*(.*)', text, re.IGNORECASE)
            if m and m.group(1).strip():
                return 'payment_terms', m.group(1).strip(), 0.85

        # --- Email ---
        for pat in PATTERNS['email']:
            m = pat.search(text)
            if m:
                return 'vendor_email', m.group(1), 0.95

        # --- Phone ---
        for pat in PATTERNS['phone']:
            m = pat.search(text)
            if m:
                return 'vendor_phone', m.group(1).strip(), 0.88

        # --- Company Name (top region + business keywords) ---
        if self._is_top_region(result.box):
            if any(k in text_lower for k in KEYWORDS['company']):
                return 'vendor_name', text, 0.80

        # --- Fallback: NLP-based Semantic Classifier ---
        nlp_field = self.field_nlp_classifier.classify_label(text)
        if nlp_field:
            field_types = {
                'invoice_number': 'invoice_number',
                'invoice_date': 'date',
                'due_date': 'date',
                'gst_number': 'gst_number',
                'subtotal': 'amount',
                'cgst_amount': 'amount',
                'sgst_amount': 'amount',
                'igst_amount': 'amount',
                'tax_amount': 'amount',
                'invoice_total': 'amount'
            }
            exp_type = field_types.get(nlp_field)
            if exp_type == 'amount':
                amt = self._extract_amount(text)
                if amt:
                    return nlp_field, amt, 0.70
            elif exp_type == 'date':
                for pat in PATTERNS['date']:
                    m = pat.search(text)
                    if m:
                        return nlp_field, normalize_date(m.group(1)), 0.70
            elif exp_type == 'gst_number':
                for pat in PATTERNS['gst_number']:
                    m = pat.search(text)
                    if m:
                        return nlp_field, normalize_gstin(m.group(1)), 0.70
            elif exp_type == 'invoice_number':
                for pat in PATTERNS['invoice_number']:
                    m = pat.search(text)
                    if m:
                        val = m.group(1)
                        val_clean = val.strip()
                        if any(d_pat.search(val_clean) for d_pat in PATTERNS['date']):
                            continue
                        if val_clean.lower().startswith('date'):
                            continue
                        return nlp_field, normalize_invoice_number(val), 0.70

        return None, None, 0.0

    def _extract_amount(self, text: str) -> Optional[float]:
        # Preprocess text to separate keywords/symbols from digits (e.g., "Total1466.00" -> "Total 1466.00")
        cleaned = text
        for kw in ['total', 'subtotal', 'sub', 'cgst', 'sgst', 'igst', 'tax', 'gst', 'rs', 'inr']:
            cleaned = re.sub(rf'({kw})(?=\d)', r'\1 ', cleaned, flags=re.IGNORECASE)
        # Also separate currency symbols if they are attached to digits without space
        cleaned = re.sub(r'([₹$])(?=\d)', r'\1 ', cleaned)
        cleaned = re.sub(r'([a-zA-Z])(?=\d)', r'\1 ', cleaned)
        cleaned = re.sub(r'(\d)(?=[a-zA-Z])', r'\1 ', cleaned)

        cleaned = re.sub(r'\b\d+(?:\.\d+)?\s*%', '', cleaned)
        cleaned = re.sub(r'\(\s*\d+(?:\.\d+)?\s*%\s*\)', '', cleaned)

        for pat in PATTERNS['amount']:
            m = pat.search(cleaned)
            if m:
                try:
                    val_str = m.group(1)
                    if ',' in val_str and '.' in val_str:
                        comma_idx = val_str.rfind(',')
                        dot_idx = val_str.rfind('.')
                        if comma_idx > dot_idx:
                            val_str = val_str.replace('.', '').replace(',', '.')
                        else:
                            val_str = val_str.replace(',', '')
                    elif ',' in val_str and '.' not in val_str:
                        if len(val_str) - val_str.rfind(',') - 1 == 2:
                            val_str = val_str.replace(',', '.')
                        else:
                            val_str = val_str.replace(',', '')
                    elif '.' in val_str and ',' not in val_str:
                        # Standard decimal point, do not remove/replace the dot
                        pass
                    else:
                        val_str = val_str.replace(',', '')
                    return float(val_str)
                except ValueError:
                    continue
        return None

    def _is_tax_or_discount_total(self, text: str) -> bool:
        """
        FIXED (audit Bug #3/#5): this list previously only excluded
        tax/discount phrases containing the word "total". Retail and mall
        receipts routinely contain "Total Savings", "MRP Total", and
        "Round Off" lines that also contain "total" but are never the
        invoice's grand total — those were free to compete for the
        invoice_total slot. They are now excluded here too.
        """
        text_lower = text.lower()
        tax_phrases = [
            'total tax', 'tax total', 'total tax amount',
            'total cgst', 'cgst total',
            'total sgst', 'sgst total',
            'total igst', 'igst total',
            'total cess', 'cess total',
            'total discount', 'discount total',
            'total gst', 'gst total',
            'total savings', 'savings total', 'you saved', 'you save',
            'mrp total', 'total mrp', 'total items', 'item total',
            'round off', 'roundoff', 'total qty', 'total quantity',
        ]
        return any(p in text_lower for p in tax_phrases)

    def _is_top_region(self, box: tuple, threshold: float = 0.25) -> bool:
        _, y1, _, y2 = box
        center_y = (y1 + y2) / 2
        return (center_y / self.img_h) < threshold

    def _find_total_by_position(self, amounts, classified=None):
        # Filter out obvious non-total candidates like bank account numbers/phone numbers:
        # (e.g., integer >= 10000000)
        filtered_amounts = []
        for amt, box, conf in amounts:
            if amt >= 10000000 and float(amt).is_integer():
                continue
            filtered_amounts.append((amt, box, conf))

        if not filtered_amounts:
            filtered_amounts = amounts  # Fallback if we filtered everything

        # If we have subtotal and tax_amount in classified, we can use them to find the best matching total
        if classified and filtered_amounts:
            subtotal = classified.get('subtotal', {}).get('value')
            tax_amount = classified.get('tax_amount', {}).get('value')
            if subtotal is not None:
                expected = subtotal
                if tax_amount is not None:
                    expected += tax_amount
                # Find candidate closest to expected
                closest = min(filtered_amounts, key=lambda x: abs(x[0] - expected))
                # If the closest candidate is within 5% of expected, return it!
                if abs(closest[0] - expected) / max(1.0, expected) < 0.05:
                    return closest

        bottom_amounts = [
            a for a in filtered_amounts
            if (a[1][1] + a[1][3]) / 2 / self.img_h > 0.60
        ]
        if not bottom_amounts:
            # Filter out amounts in the top 25% of the page to avoid picking up addresses/dates/phone numbers as totals
            non_top_amounts = [
                a for a in filtered_amounts
                if (a[1][1] + a[1][3]) / 2 / self.img_h >= 0.25
            ]
            if non_top_amounts:
                return max(non_top_amounts, key=lambda x: x[0])
            return max(filtered_amounts, key=lambda x: x[0]) if filtered_amounts else None
        return max(bottom_amounts, key=lambda x: x[0])


    def _find_neighbor_value(self, key_result: OCRResult, all_results: List[OCRResult], expected_type: str, field: Optional[str] = None) -> Optional[tuple]:
        kx1, ky1, kx2, ky2 = key_result.box
        k_cy = (ky1 + ky2) / 2.0
        k_height = ky2 - ky1

        candidates = []
        max_horizontal_gap = 500

        for other in all_results:
            if other.region_id == key_result.region_id:
                continue

            ox1, oy1, ox2, oy2 = other.box
            o_cy = (oy1 + oy2) / 2.0
            o_height = oy2 - oy1

            vertical_dist = abs(k_cy - o_cy)
            max_allowed_vertical = max(k_height, o_height) * 1.5

            if vertical_dist > max_allowed_vertical:
                continue
            if ox1 < kx1 - 10:
                continue

            dist = ox1 - kx2
            if dist > max_horizontal_gap:
                continue

            val = None
            conf = 0.0
            text = other.text.strip()

            if expected_type == 'amount':
                val = self._extract_amount(text)
                conf = 0.85
            elif expected_type == 'date':
                for pat in PATTERNS['date']:
                    m = pat.search(text)
                    if m:
                        val = normalize_date(m.group(1))
                        conf = 0.88
                        break
            elif expected_type == 'gst_number':
                for pat in PATTERNS['gst_number']:
                    m = pat.search(text)
                    if m:
                        val = normalize_gstin(m.group(1))
                        conf = 0.90
                        break
                if not val and ('gstin' in text.lower() or 'gst number' in text.lower()):
                    m = re.search(r'\b([A-Z0-9]{10,15})\b', text.upper())
                    if m:
                        val = normalize_gstin(m.group(1))
                        conf = 0.80
            elif expected_type == 'invoice_number':
                for pat in PATTERNS['invoice_number']:
                    m = pat.search(text)
                    if m:
                        candidate_val = m.group(1)
                        val_clean = candidate_val.strip()
                        if any(d_pat.search(val_clean) for d_pat in PATTERNS['date']):
                            continue
                        if val_clean.lower().startswith('date'):
                            continue
                        val = normalize_invoice_number(candidate_val)
                        conf = 0.90
                        break
                if not val:
                    cleaned = re.sub(r'[^a-zA-Z0-9\-]', '', text)
                    if len(cleaned) >= 4 and any(c.isdigit() for c in cleaned):
                        # Verify fallback is not a date
                        if not any(d_pat.search(cleaned) for d_pat in PATTERNS['date']) and not cleaned.lower().startswith('date'):
                            val = cleaned
                            conf = 0.75
            elif expected_type == 'text':
                val = text
                conf = 0.80

            if val is not None:
                candidates.append((val, conf, other, dist, vertical_dist))

        if not candidates:
            return None

        if expected_type == 'amount' and field == 'invoice_total':
            candidates.sort(key=lambda x: (x[2].box[2], x[0]), reverse=True)
            return (candidates[0][0], candidates[0][1], candidates[0][2])

        # Sort primarily by absolute horizontal gap, and secondarily by vertical distance
        candidates.sort(key=lambda x: (abs(x[3]), x[4]))
        return (candidates[0][0], candidates[0][1], candidates[0][2])

    def _extract_from_tables(self, ocr_results: List[OCRResult]) -> Dict[str, Any]:
        table_fields = {}
        rows = self._group_ocr_into_rows(ocr_results)
        header_rows = self._find_table_header_rows(rows)

        for header_info in header_rows:
            parsed_rows = self._parse_table_rows(header_info, rows)
            if not parsed_rows:
                continue

            best_row_info = None
            for p_row in parsed_rows:
                r_idx = p_row['row_idx']
                row_cells = rows[r_idx]
                if any("total" in cell.text.lower() and not "subtotal" in cell.text.lower() for cell in row_cells):
                    best_row_info = p_row
                    break

            if not best_row_info:
                best_row_info = parsed_rows[-1]

            best_row = best_row_info['values']

            field_mapping = {
                'cgst': 'cgst_amount',
                'sgst': 'sgst_amount',
                'igst': 'igst_amount',
                'taxable': 'subtotal',
                'total': 'invoice_total'
            }

            for col_name, field_name in field_mapping.items():
                if col_name in best_row:
                    val = best_row[col_name]['value']
                    res = best_row[col_name]['res']
                    table_fields[field_name] = {
                        'value': val,
                        'confidence': 0.95,
                        'source_text': f"Table column '{col_name}' -> {val}"
                    }
        return table_fields

    def _group_ocr_into_rows(self, ocr_results: List[OCRResult], y_threshold: float = 12.0) -> List[List[OCRResult]]:
        valid_results = [r for r in ocr_results if r.confidence >= 0.4]
        if not valid_results:
            return []

        def get_y_center(res):
            return (res.box[1] + res.box[3]) / 2.0

        sorted_by_y = sorted(valid_results, key=get_y_center)
        rows = []
        for res in sorted_by_y:
            cy = get_y_center(res)
            placed = False
            for row in rows:
                first_cy = get_y_center(row[0])
                row_height = max(r.box[3] - r.box[1] for r in row)
                thresh = max(8.0, row_height * 0.35)
                if abs(cy - first_cy) < thresh:
                    row.append(res)
                    placed = True
                    break
            if not placed:
                rows.append([res])

        for row in rows:
            row.sort(key=lambda r: r.box[0])
        rows.sort(key=lambda row: sum(get_y_center(r) for r in row) / len(row))
        return rows

    def _find_table_header_rows(self, rows: List[List[OCRResult]]) -> List[dict]:
        header_rows = []
        header_keywords = {
            'cgst': ['cgst', 'c.g.s.t', 'c-gst', 'ccst'],
            'sgst': ['sgst', 's.g.s.t', 's-gst', 'scst', 's.g.s.1'],
            'igst': ['igst', 'i.g.s.t', 'i-gst'],
            'cess': ['cess'],
            'taxable': ['taxable', 'taxable value', 'taxable amount', 'net value', 'net amount'],
            'total': ['total amount', 'total', 'grand total', 'total value']
        }

        for row_idx, row in enumerate(rows):
            headers = {}
            for col_idx, res in enumerate(row):
                text_lower = res.text.lower()
                for key, kws in header_keywords.items():
                    if any(kw in text_lower for kw in kws):
                        headers[key] = {
                            'res': res,
                            'x1': res.box[0],
                            'x2': res.box[2],
                            'cx': (res.box[0] + res.box[2]) / 2.0
                        }
            has_tax_col = any(k in headers for k in ['cgst', 'sgst', 'igst', 'cess'])
            if has_tax_col and len(headers) >= 2:
                if len(set(h['res'].region_id for h in headers.values())) == len(headers):
                    header_rows.append({
                        'row_idx': row_idx,
                        'headers': headers,
                        'row': row
                    })
        return header_rows

    def _split_merged_cells(self, row: List[OCRResult]) -> List[OCRResult]:
        split_row = []
        for res in row:
            text = res.text.strip()
            tokens = text.split()
            if len(tokens) > 1 and any(self._extract_amount(t) is not None for t in tokens):
                rx1, ry1, rx2, ry2 = res.box
                width = rx2 - rx1
                total_chars = len(text)

                char_idx = 0
                for token in tokens:
                    token_len = len(token)
                    start_char = text.find(token, char_idx)
                    if start_char == -1:
                        start_char = char_idx
                    end_char = start_char + token_len
                    char_idx = end_char

                    if total_chars > 0:
                        tx1 = rx1 + (start_char / total_chars) * width
                        tx2 = rx1 + (end_char / total_chars) * width
                    else:
                        tx1, tx2 = rx1, rx2

                    virtual_box = [tx1, ry1, tx2, ry2]
                    split_row.append(OCRResult(
                        region_id=res.region_id,
                        text=token,
                        confidence=res.confidence,
                        box=virtual_box,
                        yolo_hint=res.yolo_hint,
                        raw_lines=res.raw_lines
                    ))
            else:
                split_row.append(res)
        return split_row

    def _parse_table_rows(self, header_info: dict, rows: List[List[OCRResult]]) -> List[dict]:
        header_idx = header_info['row_idx']
        headers = header_info['headers']
        parsed_data = []

        prev_y_center = sum((c.box[1] + c.box[3]) / 2.0 for c in rows[header_idx]) / len(rows[header_idx]) if rows[header_idx] else 0.0

        for r_idx in range(header_idx + 1, len(rows)):
            row = self._split_merged_cells(rows[r_idx])
            if not row:
                continue
            curr_y_center = sum((c.box[1] + c.box[3]) / 2.0 for c in row) / len(row)
            if prev_y_center > 0.0 and (curr_y_center - prev_y_center) > 120.0:
                break
            prev_y_center = curr_y_center

            row_text_combined = " ".join(res.text for res in row).lower()
            if any(term in row_text_combined for term in ['tender detail', 'payment method', 'authorized', 'signatory', 'terms', 'conditions']):
                break

            row_values = {}
            matched_cols = 0

            for col_name, col_meta in headers.items():
                cx = col_meta['cx']
                col_width = col_meta['x2'] - col_meta['x1']
                tolerance = max(50.0, col_width * 0.8)

                for res in row:
                    rx1, ry1, rx2, ry2 = res.box
                    rcx = (rx1 + rx2) / 2.0
                    overlap = max(0, min(rx2, col_meta['x2']) - max(rx1, col_meta['x1']))
                    is_aligned = False
                    if overlap > 0:
                        is_aligned = True
                    elif abs(rcx - cx) < tolerance:
                        is_aligned = True

                    if is_aligned:
                        val = self._extract_amount(res.text)
                        if val is not None:
                            row_values[col_name] = {
                                'value': val,
                                'res': res
                            }
                            matched_cols += 1
                            break

            if matched_cols >= 2:
                parsed_data.append({
                    'row_idx': r_idx,
                    'values': row_values
                })
        return parsed_data
