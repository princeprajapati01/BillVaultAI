from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from app.pipeline.ocr_engine import OCRResult


@dataclass
class TableReconstructionConfig:
    # Maximum vertical distance (in pixels) for considering a line as continuation of description
    description_merge_y_gap: int = 28


class TableReconstructor:
    """
    Post-OCR table reconstruction helper.

    Operates after OCR extraction and after the existing product table parser.
    Does not change the items schema shape; only repairs/merges values when safe.
    """

    def __init__(self, img_w: int, img_h: int, config: Optional[TableReconstructionConfig] = None) -> None:
        self.img_w = max(1, int(img_w))
        self.img_h = max(1, int(img_h))
        self.config = config or TableReconstructionConfig()

    def reconstruct(self, items: List[Dict[str, Any]], ocr_results: List[OCRResult]) -> List[Dict[str, Any]]:
        if not items:
            return items

        # 1) Merge multi-line descriptions already partially handled by existing parser; reinforce it:
        items = self._merge_multiline_item_names(items)

        # 2) Fill obvious missing numeric values using neighbors (very conservative):
        items = self._fill_missing_values(items)

        # 3) If descriptions are clearly split across adjacent OCR lines near the table area,
        # attempt to stitch them into the closest item_name (best-effort, non-destructive).
        items = self._stitch_from_ocr_lines(items, ocr_results)

        return items

    def _merge_multiline_item_names(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        buffer_desc: List[str] = []

        def has_money_fields(it: Dict[str, Any]) -> bool:
            return any(k in it and it.get(k) not in (None, "", 0, 0.0) for k in ("unit_price", "tax_amount", "line_total"))

        for it in items:
            name = str(it.get("item_name") or "").strip()
            if not name and buffer_desc:
                it["item_name"] = " ".join(buffer_desc).strip()
                buffer_desc = []
                out.append(it)
                continue

            if not has_money_fields(it) and name and len(name.split()) <= 4:
                # Likely a continuation row (broken row / merged OCR cell) — buffer it.
                buffer_desc.append(name)
                continue

            if buffer_desc:
                merged = (" ".join(buffer_desc) + " " + name).strip()
                it["item_name"] = merged
                buffer_desc = []

            out.append(it)

        # If buffer remains, append as a trailing item (do not drop data)
        if buffer_desc:
            out.append({"item_name": " ".join(buffer_desc).strip(), "quantity": 1, "unit_price": 0.0, "tax_rate": 0.0, "tax_amount": 0.0, "line_total": 0.0})

        return out

    def _fill_missing_values(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Only fill if it's clearly derivable and won't change existing non-zero values.
        for it in items:
            qty = it.get("quantity")
            try:
                qty_f = float(qty) if qty not in (None, "", 0) else 1.0
            except Exception:
                qty_f = 1.0
            if qty_f <= 0:
                qty_f = 1.0
            it["quantity"] = int(qty_f) if abs(qty_f - int(qty_f)) < 1e-6 else qty_f

            unit = it.get("unit_price")
            total = it.get("line_total")
            try:
                unit_f = float(unit) if unit not in (None, "", 0, 0.0) else 0.0
            except Exception:
                unit_f = 0.0
            try:
                total_f = float(total) if total not in (None, "", 0, 0.0) else 0.0
            except Exception:
                total_f = 0.0

            if unit_f == 0.0 and total_f > 0.0 and qty_f > 0:
                it["unit_price"] = total_f / qty_f
            if total_f == 0.0 and unit_f > 0.0 and qty_f > 0:
                it["line_total"] = unit_f * qty_f

            for k in ("tax_rate", "tax_amount"):
                if k not in it or it.get(k) in (None, ""):
                    it[k] = 0.0

        return items

    def _stitch_from_ocr_lines(self, items: List[Dict[str, Any]], ocr_results: List[OCRResult]) -> List[Dict[str, Any]]:
        # Best-effort: if there are consecutive OCR lines near the middle of the page
        # that look like descriptions (mostly letters) and items have short names, merge them.
        if not ocr_results:
            return items

        # Collect candidate description lines: high confidence, mostly alpha, not totals/summary.
        lines: List[Tuple[float, OCRResult]] = []
        for r in ocr_results:
            if r.confidence < 0.5:
                continue
            txt = (r.text or "").strip()
            if len(txt) < 3:
                continue
            low = txt.lower()
            if any(k in low for k in ("subtotal", "grand total", "total", "gstin", "cgst", "sgst", "igst", "tax")):
                continue
            alpha = sum(1 for ch in txt if ch.isalpha())
            digit = sum(1 for ch in txt if ch.isdigit())
            if alpha >= 3 and digit <= 2:
                cy = (r.box[1] + r.box[3]) / 2.0
                y_norm = cy / self.img_h
                # Focus on typical table band
                if 0.25 < y_norm < 0.85:
                    lines.append((cy, r))

        lines.sort(key=lambda x: (x[0], x[1].box[0]))
        if not lines:
            return items

        # If items have very short names, append nearby OCR description fragments.
        stitched = []
        for it in items:
            name = str(it.get("item_name") or "").strip()
            if not name:
                stitched.append(it)
                continue
            if len(name.split()) >= 4:
                stitched.append(it)
                continue

            # Find closest line by y distance to approximate row association.
            best = None
            best_d = 1e9
            for cy, r in lines[:200]:
                d = abs(cy - (r.box[1] + r.box[3]) / 2.0)
                if d < best_d:
                    best_d = d
                    best = r
            if best and best_d <= self.config.description_merge_y_gap:
                frag = best.text.strip()
                if frag and frag.lower() not in name.lower():
                    it["item_name"] = (name + " " + frag).strip()
            stitched.append(it)

        return stitched

