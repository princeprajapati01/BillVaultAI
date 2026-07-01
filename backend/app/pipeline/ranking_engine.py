from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import re

from app.pipeline.candidate_engine import Candidate


@dataclass
class RankedChoice:
    value: Any
    score: float  # 0-100
    reason: str
    chosen_candidate: Candidate


class RankingEngine:
    """
    Lightweight ranking engine that scores candidates without changing existing schemas.
    """

    def __init__(self, img_w: int, img_h: int) -> None:
        self.img_w = max(1, int(img_w))
        self.img_h = max(1, int(img_h))

    def rank_field(
        self,
        field_name: str,
        candidates: List[Candidate],
        *,
        context_values: Optional[Dict[str, Any]] = None,
    ) -> Optional[RankedChoice]:
        if not candidates:
            return None

        context_values = context_values or {}
        scored: List[Tuple[float, Candidate, str]] = []
        for c in candidates:
            s, reason = self._score_candidate(field_name, c, context_values)
            scored.append((s, c, reason))

        # Outlier penalty for invoice totals:
        # OCR/ranking sometimes picks a single extremely large numeric value due to digit-level errors.
        # We penalize candidates that are far from the median magnitude of all invoice_total candidates.
        if field_name == "invoice_total":
            float_vals: List[float] = []
            cand_by_idx: List[int] = []
            for idx, (_s, c, _r) in enumerate(scored):
                try:
                    v = float(c.value)
                    if v > 0:
                        float_vals.append(v)
                        cand_by_idx.append(idx)
                except Exception:
                    continue

            if len(float_vals) >= 2:
                import statistics

                logs = [math.log10(v) for v in float_vals if v > 0]
                if logs:
                    median_log = statistics.median(logs)

                    adjusted: List[Tuple[float, Candidate, str]] = []
                    for s, c, reason in scored:
                        try:
                            v = float(c.value)
                            if v <= 0:
                                adjusted.append((s, c, reason))
                                continue
                            logv = math.log10(v)
                            diff = abs(logv - median_log)
                            # If diff is large (e.g., 1e3 vs 1e7), apply a strong penalty.
                            penalty = 0.0
                            if diff > 1.0:
                                # piecewise-ish curve
                                penalty = min(70.0, 35.0 * (diff - 1.0))
                            if penalty > 0:
                                s2 = max(0.0, s - penalty)
                                reason2 = reason + f"+Outlier(-{penalty:.0f})"
                                adjusted.append((s2, c, reason2))
                            else:
                                adjusted.append((s, c, reason))
                        except Exception:
                            adjusted.append((s, c, reason))

                    scored = adjusted

        scored.sort(key=lambda x: x[0], reverse=True)
        best_s, best_c, best_r = scored[0]
        return RankedChoice(value=best_c.value, score=best_s, reason=best_r, chosen_candidate=best_c)

    def _score_candidate(self, field_name: str, c: Candidate, ctx: Dict[str, Any]) -> Tuple[float, str]:
        score = 0.0
        parts: List[str] = []

        # 1) OCR confidence
        if c.ocr_confidence is not None:
            score += 15.0 * max(0.0, min(1.0, float(c.ocr_confidence)))
            parts.append("OCR")

        # 2) extractor confidence (regex/spatial/table etc)
        score += 25.0 * max(0.0, min(1.0, float(c.confidence)))
        parts.append("Extract")

        # 3) keyword proximity (approximated via "source" and optional keyword)
        if c.source in {"regex", "spatial"}:
            score += 10.0
            parts.append("Keyword")

        # 4) page position heuristics
        if c.box is not None and isinstance(c.box, (tuple, list)) and len(c.box) == 4:
            x1, y1, x2, y2 = c.box
            cy = (float(y1) + float(y2)) / 2.0
            cx = (float(x1) + float(x2)) / 2.0
            y_norm = cy / self.img_h
            x_norm = cx / self.img_w

            if field_name in {"invoice_total", "tax_amount"}:
                # totals tend to be lower on page
                score += 20.0 * y_norm
                parts.append("Bottom")
            elif field_name in {"invoice_number", "invoice_date", "gst_number"}:
                # header fields tend to be higher
                score += 10.0 * (1.0 - y_norm)
                parts.append("Top")

            # Right alignment hint for amounts
            if field_name in {"invoice_total", "subtotal", "cgst_amount", "sgst_amount", "igst_amount", "tax_amount"}:
                score += 10.0 * x_norm
                parts.append("Right")

        # 5) OCR correction candidate (side-channel): prefer corrected when plausible
        if c.correction is not None:
            # Smaller correction_score implies fewer edits; reward conservative correction slightly.
            score += 5.0 * (1.0 - max(0.0, min(1.0, float(c.correction.correction_score))))
            parts.append("Corr")

        # 6) Business validation
        score += self._business_validation_bonus(field_name, c, ctx, parts)

        # 7) Invoice consistency validation (cross-field)
        score += self._consistency_bonus(field_name, c, ctx, parts)

        score = max(0.0, min(100.0, score))
        return score, "+".join(parts)

    def _business_validation_bonus(self, field_name: str, c: Candidate, ctx: Dict[str, Any], parts: List[str]) -> float:
        bonus = 0.0

        if field_name in {"gst_number"}:
            v = str(c.value or "").strip().upper()
            if len(v) == 15 and v.isalnum():
                bonus += 15.0
                parts.append("GST15")

        if field_name in {"invoice_number"}:
            v = str(c.value or "").strip()
            v_u = v.upper()

            # Penalize state-code-like tokens that often get mis-tagged as invoice numbers
            # Examples: "IN-GJ", "IN-MH", "GJ", "MH" etc.
            if re.fullmatch(r"[A-Z]{2}-[A-Z]{2}", v_u) or re.fullmatch(r"IN-[A-Z]{2}", v_u):
                bonus -= 30.0
                parts.append("StateCode")
            elif re.fullmatch(r"[A-Z]{2}", v_u):
                bonus -= 15.0
                parts.append("State2")

            # Reward invoice-number-like structure: contains digits, reasonable length
            digit_count = sum(1 for ch in v_u if ch.isdigit())
            if digit_count >= 3:
                bonus += 12.0
                parts.append("HasDigits")
            if len(v_u) >= 8:
                bonus += 8.0
                parts.append("Len8")

            # Strong reward if original OCR line (raw_value) contains invoice keywords
            raw = (c.raw_value or "").lower()
            if any(k in raw for k in ("invoice", "inv", "tax invoice")) and not any(k in raw for k in ("state code", "place of supply")):
                bonus += 10.0
                parts.append("InvKW")

        if field_name in {"invoice_total"}:
            # Key bugfix: prefer "Grand Total" over other totals (e.g., taxable value, gross, discount).
            raw = (c.raw_value or "").lower()
            if "grand total" in raw:
                bonus += 25.0
                parts.append("GrandKW")
            if any(k in raw for k in ("taxable value", "taxable amount", "gross amount", "discount")):
                bonus -= 20.0
                parts.append("NotGrand")
            # Generic "total" gets a small positive (still weaker than Grand Total).
            if "total" in raw and "grand total" not in raw:
                bonus += 5.0
                parts.append("TotalKW")

        if field_name in {"invoice_total", "subtotal", "tax_amount"}:
            try:
                v = float(c.value)
                if v > 0:
                    bonus += 5.0
                    parts.append("PosAmt")
            except Exception:
                return bonus

        if field_name == "invoice_total":
            # Extra guard: taxes should be a meaningful fraction of total.
            # If invoice_total is hugely larger than extracted tax_amount, it's likely an OCR outlier (e.g., HSN code leakage).
            try:
                tax = ctx.get("tax_amount")
                if tax is not None:
                    tax_f = float(tax)
                    total_f = float(c.value)
                    if tax_f > 0 and total_f > 0:
                        ratio = tax_f / total_f
                        raw = (c.raw_value or "").lower()
                        if "hsn" in raw or "sac" in raw:
                            bonus -= 60.0
                            parts.append("HSNLeak")
                        # Very small ratio indicates likely wrong (tax value present but total is far too large).
                        if ratio < 0.001:
                            bonus -= 60.0
                            parts.append("TaxTooSmallRatio")
                        elif ratio > 0.5:
                            bonus -= 40.0
                            parts.append("TaxTooLargeRatio")
            except Exception:
                pass

        if field_name == "subtotal":
            # Extra guard: subtotal (taxable value) should be in same magnitude as total-minus-tax.
            try:
                tax = ctx.get("tax_amount")
                if tax is not None:
                    tax_f = float(tax)
                    sub_f = float(c.value)
                    if tax_f > 0 and sub_f > 0:
                        ratio = tax_f / sub_f
                        raw = (c.raw_value or "").lower()
                        if "hsn" in raw or "sac" in raw:
                            bonus -= 50.0
                            parts.append("HSNLeak")
                        if ratio < 0.001:
                            bonus -= 50.0
                            parts.append("TaxTooSmallRatio")
            except Exception:
                pass

        if field_name in {"invoice_date", "due_date"}:
            # very light plausibility check: contains 2 separators and digits
            s = str(c.value or "")
            if sum(1 for ch in s if ch in "/-.") >= 2 and any(ch.isdigit() for ch in s):
                bonus += 5.0
                parts.append("DateFmt")

        return bonus

    def _consistency_bonus(self, field_name: str, c: Candidate, ctx: Dict[str, Any], parts: List[str]) -> float:
        bonus = 0.0

        # Use parsed line-item totals as a strong signal for invoice_total/subtotal where available.
        # This helps prevent extreme OCR outliers from being selected.
        items_total = ctx.get("items_total")
        if items_total is not None and field_name in {"invoice_total", "subtotal"}:
            try:
                items_total_f = float(items_total)
                cand_f = float(c.value)
                if items_total_f > 0 and cand_f > 0:
                    rel_err = abs(items_total_f - cand_f) / max(1.0, abs(items_total_f))
                    if rel_err < 0.01:
                        bonus += 35.0
                        parts.append("ItemsMatch")
                    elif rel_err < 0.03:
                        bonus += 15.0
                        parts.append("ItemsClose")
                    else:
                        # Strong penalty for far-off magnitude.
                        if rel_err > 0.10:
                            bonus -= min(60.0, 50.0 * rel_err)
                            parts.append("ItemsFar")
            except Exception:
                pass

        # subtotal + tax ~= total
        if field_name in {"invoice_total"}:
            try:
                total = float(c.value)
                sub = ctx.get("subtotal")
                tax = ctx.get("tax_amount")
                if sub is not None and tax is not None:
                    sub_f = float(sub)
                    tax_f = float(tax)
                    expected = sub_f + tax_f
                    if expected > 0:
                        rel_err = abs(expected - total) / max(1.0, expected)
                        if rel_err < 0.02:
                            bonus += 20.0
                            parts.append("SumOK")
                        elif rel_err < 0.05:
                            bonus += 10.0
                            parts.append("SumClose")
            except Exception:
                pass

        # grand_total - tax_amount ~= subtotal
        if field_name == "subtotal":
            try:
                total = ctx.get("invoice_total")
                tax = ctx.get("tax_amount")
                if total is not None and tax is not None:
                    expected = float(total) - float(tax)
                    sub = float(c.value)
                    if expected != 0:
                        rel_err = abs(expected - sub) / max(1.0, abs(expected))
                        if rel_err < 0.002:
                            bonus += 25.0
                            parts.append("SubFromTotal")
                        elif rel_err < 0.01:
                            bonus += 12.0
                            parts.append("SubClose")
            except Exception:
                pass

        # prefer larger totals among amount candidates (helps avoid picking smaller intermediate values)
        if field_name in {"invoice_total"}:
            try:
                total = float(c.value)
                bonus += 5.0 * (1.0 - math.exp(-total / 5000.0))
                parts.append("Large")
            except Exception:
                pass

        return bonus