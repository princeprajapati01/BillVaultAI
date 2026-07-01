import re
from dataclasses import dataclass
from typing import Optional, Dict


@dataclass(frozen=True)
class CorrectionCandidate:
    raw_value: str
    corrected_value: str
    correction_score: float  # 0.0 - 1.0


class OCRCorrectionLayer:
    """
    Field-aware OCR correction layer.

    - Never mutates the OCRResult objects or raw OCR text.
    - Produces corrected candidates as a side-channel for ranking.
    """

    _DEFAULT_SUBS: Dict[str, str] = {
        "O": "0",
        "I": "1",
        "l": "1",
        "S": "5",
        "B": "8",
    }

    _GSTIN_RE = re.compile(r"^[0-9A-Z]{15}$")
    _DATE_RE = re.compile(r"^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$")

    def correct(self, field_name: str, raw_value: Optional[str]) -> Optional[CorrectionCandidate]:
        if not raw_value or not isinstance(raw_value, str):
            return None

        raw = raw_value.strip()
        if not raw:
            return None

        if field_name in {"gst_number", "vendor_gstin", "customer_gstin"}:
            return self._correct_gstin(raw)
        if field_name in {"invoice_number"}:
            return self._correct_invoice_number(raw)
        if field_name in {"invoice_date", "due_date"}:
            return self._correct_date(raw)
        if field_name in {"invoice_total", "subtotal", "cgst_amount", "sgst_amount", "igst_amount", "tax_amount"}:
            return self._correct_amount_like(raw)

        # Unknown/unsupported field: do nothing.
        return None

    def _apply_subs(self, s: str, subs: Dict[str, str]) -> str:
        return "".join(subs.get(ch, ch) for ch in s)

    def _correction_score(self, raw: str, corrected: str) -> float:
        if raw == corrected:
            return 0.0
        # Score by fraction changed, capped to [0,1].
        n = max(len(raw), 1)
        changed = sum(1 for a, b in zip(raw, corrected) if a != b) + abs(len(raw) - len(corrected))
        return max(0.0, min(1.0, changed / n))

    def _correct_gstin(self, raw: str) -> Optional[CorrectionCandidate]:
        raw_u = raw.upper()
        # Keep only GSTIN-like characters; do not remove internal structure beyond whitespace.
        compact = re.sub(r"\s+", "", raw_u)
        if len(compact) < 12:
            return None

        # Conservative correction: only apply to plausible GSTIN tokens.
        token = re.sub(r"[^0-9A-Z]", "", compact)
        if len(token) != 15:
            return None

        corrected = token
        # Field-aware position rules (same intent as existing normalize_gstin, without touching raw OCR):
        chars = list(corrected)
        # state code digits
        for i in (0, 1):
            if chars[i] == "O":
                chars[i] = "0"
            elif chars[i] in {"I", "L"}:
                chars[i] = "1"
        # PAN letters
        for i in (2, 3, 4, 5, 6):
            if chars[i] == "0":
                chars[i] = "O"
            elif chars[i] == "1":
                chars[i] = "I"
        # PAN digits
        for i in (7, 8, 9, 10):
            if chars[i] == "O":
                chars[i] = "0"
            elif chars[i] in {"I", "L"}:
                chars[i] = "1"
        # PAN letter
        if chars[11] == "0":
            chars[11] = "O"
        elif chars[11] == "1":
            chars[11] = "I"
        # Z at position 13
        if chars[13] in {"2", "S", "5"}:
            chars[13] = "Z"

        corrected = "".join(chars)
        if not self._GSTIN_RE.match(corrected):
            return None

        score = self._correction_score(token, corrected)
        return CorrectionCandidate(raw_value=raw, corrected_value=corrected, correction_score=score)

    def _correct_invoice_number(self, raw: str) -> Optional[CorrectionCandidate]:
        # Keep invoice numbers mostly intact; only fix common leading OCR mistakes around INV prefix.
        s = raw.strip()
        corrected = s

        # Fix 1NV / lNV to INV only when it is clearly a prefix.
        corrected2 = re.sub(r"^(?:1|l)\s*NV", "INV", corrected, flags=re.IGNORECASE)
        corrected2 = re.sub(r"^(?:1|l)\s*N\s*V", "INV", corrected2, flags=re.IGNORECASE)

        # Do NOT apply O->0 etc broadly to avoid changing valid alphanumerics.
        if corrected2 == s:
            return None

        return CorrectionCandidate(raw_value=raw, corrected_value=corrected2, correction_score=self._correction_score(s, corrected2))

    def _correct_date(self, raw: str) -> Optional[CorrectionCandidate]:
        s = raw.strip()
        # Dates should not be subjected to amount-like corrections; only very light cleanup.
        # Example: "1O/08/2025" -> "10/08/2025"
        corrected = self._apply_subs(s, {"O": "0", "I": "1", "l": "1"})
        corrected = re.sub(r"\s+", "", corrected)
        if corrected == s:
            return None
        if not self._DATE_RE.match(corrected):
            return None
        return CorrectionCandidate(raw_value=raw, corrected_value=corrected, correction_score=self._correction_score(s, corrected))

    def _correct_amount_like(self, raw: str) -> Optional[CorrectionCandidate]:
        s = raw.strip()
        # For amounts, allow common digit substitutions but keep separators and currency symbols.
        corrected = self._apply_subs(s, self._DEFAULT_SUBS)
        corrected = re.sub(r"\s+", "", corrected)
        if corrected == s:
            return None
        # Must still contain at least one digit to be useful.
        if not re.search(r"\d", corrected):
            return None
        return CorrectionCandidate(raw_value=raw, corrected_value=corrected, correction_score=self._correction_score(s, corrected))

