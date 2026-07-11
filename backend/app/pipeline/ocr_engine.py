import os
# Fix PaddlePaddle oneDNN issue on Windows
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"

import logging
import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Any, Tuple
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    """
    Represents ONE OCR text line and its own bounding box.

    IMPORTANT (fixed): earlier versions of this pipeline merged every OCR
    line whose center fell inside a single YOLO-detected region into ONE
    OCRResult sharing ONE bounding box (the region's box). That destroyed
    per-line granularity: a YOLO box spanning a totals block (Subtotal /
    CGST / SGST / Grand Total on separate visual lines) collapsed into a
    single text blob, and every downstream regex/keyword match then had no
    way to tell which number belonged to which label. That was the single
    largest source of "sometimes right, sometimes wrong" field extraction
    across invoice types, since it depended entirely on how tightly YOLO's
    box happened to fit that specific image.

    Fix: OCRResult ALWAYS represents one real OCR line with its own box.
    `yolo_hint` is attached as metadata (which YOLO region, if any, this
    line's center falls inside) but lines are never concatenated together.
    """
    region_id: int
    text: str
    confidence: float
    box: tuple
    yolo_hint: str
    raw_lines: List[dict] = field(default_factory=list)


class OCREngine:
    def __init__(self, lang: str = 'en'):
        self.ocr = PaddleOCR(
            lang=lang,
            enable_mkldnn=False,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            ocr_version='PP-OCRv4',
            cpu_threads=4
        )
        self._debug_dump_lines = os.getenv("OCR_DEBUG_DUMP_LINES", "false").strip().lower() in {"1", "true", "yes", "y", "on"}

    # ------------------------------------------------------------------
    # Single-region OCR (kept for callers that still want a per-region crop)
    # ------------------------------------------------------------------
    def extract_from_region(self, image: np.ndarray, region, full_image_shape) -> OCRResult:
        """
        Runs OCR on a single cropped region and returns ONE OCRResult whose
        text is the (space-joined) content of that crop. This is intended
        for genuinely small, single-line crops (e.g. a specific field crop
        requested explicitly by a caller) — NOT for whole-page processing.
        Whole-page processing should use `extract_all_regions`, which keeps
        every OCR line separate.
        """
        x1, y1, x2, y2 = region.box
        pad = 5
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(full_image_shape[1], x2 + pad), min(full_image_shape[0], y2 + pad)
        crop = image[y1:y2, x1:x2]

        if crop.size == 0:
            return OCRResult(
                region_id=region.region_id,
                text="",
                confidence=0.0,
                box=region.box,
                yolo_hint=region.yolo_label
            )

        result = self.ocr.ocr(crop)
        lines, confidences = [], []

        if result and len(result) > 0:
            first_res = result[0]
            if hasattr(first_res, 'get') and ('rec_texts' in first_res or 'rec_scores' in first_res):
                rec_texts = first_res.get('rec_texts', [])
                rec_scores = first_res.get('rec_scores', [])
                for text_part, conf in zip(rec_texts, rec_scores):
                    lines.append(text_part)
                    confidences.append(conf)
            elif hasattr(first_res, 'rec_texts') and hasattr(first_res, 'rec_scores'):
                rec_texts = getattr(first_res, 'rec_texts', [])
                rec_scores = getattr(first_res, 'rec_scores', [])
                for text_part, conf in zip(rec_texts, rec_scores):
                    lines.append(text_part)
                    confidences.append(conf)
            elif isinstance(first_res, list):
                for line in first_res:
                    if isinstance(line, list) and len(line) >= 2:
                        text_part = line[1][0]
                        conf = line[1][1]
                        lines.append(text_part)
                        confidences.append(conf)

        full_text = ' '.join(lines).strip()
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        return OCRResult(
            region_id=region.region_id,
            text=full_text,
            confidence=avg_conf,
            box=region.box,
            yolo_hint=region.yolo_label,
            raw_lines=[{'text': l, 'conf': c} for l, c in zip(lines, confidences)]
        )

    # ------------------------------------------------------------------
    # Whole-page OCR — the path actually used by the pipeline
    # ------------------------------------------------------------------
    def _run_full_page_ocr(self, image: np.ndarray) -> List[dict]:
        """Runs PaddleOCR once on the full image and returns a flat list of
        {text, confidence, box} dicts — one entry per real OCR line."""
        result = self.ocr.ocr(image)
        raw_ocr_lines: List[dict] = []

        if not result or len(result) == 0:
            return raw_ocr_lines

        page_result = result[0]

        if isinstance(page_result, list):
            for line in page_result:
                if isinstance(line, list) and len(line) >= 2:
                    box_coords = line[0]
                    text, conf = line[1][0], line[1][1]
                    xs = [pt[0] for pt in box_coords]
                    ys = [pt[1] for pt in box_coords]
                    ox1, oy1, ox2, oy2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                    raw_ocr_lines.append({'text': text, 'confidence': conf, 'box': (ox1, oy1, ox2, oy2)})
        elif hasattr(page_result, 'get') or hasattr(page_result, 'rec_texts'):
            if hasattr(page_result, 'get'):
                rec_texts = page_result.get('rec_texts', [])
                rec_scores = page_result.get('rec_scores', [])
                boxes = page_result.get('boxes', page_result.get('dt_polys', []))
            else:
                rec_texts = getattr(page_result, 'rec_texts', [])
                rec_scores = getattr(page_result, 'rec_scores', [])
                boxes = getattr(page_result, 'boxes', getattr(page_result, 'dt_polys', []))

            for text_part, conf, box_coords in zip(rec_texts, rec_scores, boxes):
                if isinstance(box_coords, (list, np.ndarray)) and len(box_coords) > 0:
                    xs = [pt[0] for pt in box_coords]
                    ys = [pt[1] for pt in box_coords]
                    ox1, oy1, ox2, oy2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                else:
                    ox1, oy1, ox2, oy2 = 0, 0, 0, 0
                raw_ocr_lines.append({'text': text_part, 'confidence': conf, 'box': (ox1, oy1, ox2, oy2)})

        if self._debug_dump_lines:
            logger.debug("Raw OCR extracted %d lines", len(raw_ocr_lines))
            for idx, line in enumerate(raw_ocr_lines):
                logger.debug("Line %d: %r @ %s", idx, line.get("text", ""), line.get("box"))

        return raw_ocr_lines

    @staticmethod
    def _get_overlap_ratio(bbox1: Tuple[int, int, int, int], bbox2: Tuple[int, int, int, int]) -> float:
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2

        ix1 = max(x1_1, x1_2)
        iy1 = max(y1_1, y1_2)
        ix2 = min(x2_1, x2_2)
        iy2 = min(y2_1, y2_2)

        if ix1 >= ix2 or iy1 >= iy2:
            return 0.0

        intersection = (ix2 - ix1) * (iy2 - iy1)
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        min_area = min(area1, area2)
        if min_area <= 0:
            return 0.0
        return intersection / min_area

    def _assign_yolo_hint(self, line_box: Tuple[int, int, int, int], regions: List[Any]) -> str:
        """Return the yolo_label of whichever region this line's center falls
        inside (or has strong overlap with), or 'unmapped_ocr' if none.
        This is METADATA ONLY — it never causes lines to be merged."""
        ox1, oy1, ox2, oy2 = line_box
        o_cx = (ox1 + ox2) / 2.0
        o_cy = (oy1 + oy2) / 2.0

        best_label = 'unmapped_ocr'
        best_overlap = 0.0
        for r in regions:
            rx1, ry1, rx2, ry2 = r.box
            center_inside = (rx1 <= o_cx <= rx2) and (ry1 <= o_cy <= ry2)
            overlap = self._get_overlap_ratio(line_box, r.box)
            if center_inside and overlap >= best_overlap:
                best_overlap = overlap
                best_label = r.yolo_label
            elif overlap > 0.4 and overlap > best_overlap:
                best_overlap = overlap
                best_label = r.yolo_label
        return best_label

    def extract_all_regions(self, image: np.ndarray, regions: List[Any]) -> List[OCRResult]:
        """
        Runs PaddleOCR once on the full image and returns ONE OCRResult per
        real OCR line (never merged). Each line's `yolo_hint` records which
        YOLO region (if any) it falls inside, purely as advisory metadata
        that downstream heuristics MAY use for extra context — it is never
        used to combine multiple lines' text or boxes together.
        """
        raw_ocr_lines = self._run_full_page_ocr(image)

        mapped_results: List[OCRResult] = []
        for idx, line in enumerate(raw_ocr_lines):
            yolo_hint = self._assign_yolo_hint(line['box'], regions) if regions else 'unmapped_ocr'
            mapped_results.append(OCRResult(
                region_id=idx,
                text=line['text'].strip(),
                confidence=line['confidence'],
                box=line['box'],
                yolo_hint=yolo_hint,
                raw_lines=[{'text': line['text'], 'conf': line['confidence']}]
            ))

        return mapped_results
