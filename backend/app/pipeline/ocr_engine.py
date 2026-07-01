import os
# Fix PaddlePaddle oneDNN issue on Windows
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"

import logging
import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Any
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)

@dataclass
class OCRResult:
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

    def extract_from_region(self, image: np.ndarray, region, full_image_shape) -> OCRResult:
        x1, y1, x2, y2 = region.box
        # Add padding to avoid edge cutoffs
        pad = 5
        x1, y1 = max(0, x1-pad), max(0, y1-pad)
        x2, y2 = min(full_image_shape[1], x2+pad), min(full_image_shape[0], y2+pad)
        crop = image[y1:y2, x1:x2]

        if crop.size == 0:
            return OCRResult(
                region_id=region.region_id,
                text="",
                confidence=0.0,
                box=region.box,
                yolo_hint=region.yolo_label
            )

        # Call PaddleOCR
        result = self.ocr.ocr(crop)
        lines, confidences = [], []

        if result and len(result) > 0:
            first_res = result[0]
            # Handle new PaddleOCR 3.x dict-like format
            if hasattr(first_res, 'get') and ('rec_texts' in first_res or 'rec_scores' in first_res):
                rec_texts = first_res.get('rec_texts', [])
                rec_scores = first_res.get('rec_scores', [])
                for text_part, conf in zip(rec_texts, rec_scores):
                    lines.append(text_part)
                    confidences.append(conf)
            # Handle new PaddleOCR 3.x attribute-based format
            elif hasattr(first_res, 'rec_texts') and hasattr(first_res, 'rec_scores'):
                rec_texts = getattr(first_res, 'rec_texts', [])
                rec_scores = getattr(first_res, 'rec_scores', [])
                for text_part, conf in zip(rec_texts, rec_scores):
                    lines.append(text_part)
                    confidences.append(conf)
            # Handle legacy format: list of [box, (text, conf)]
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

    def extract_all_regions(self, image: np.ndarray, regions: List[Any]) -> List[OCRResult]:
        # Run PaddleOCR on the full image exactly once
        result = self.ocr.ocr(image)
        
        # Parse the raw OCR lines from PaddleOCR output
        raw_ocr_lines = []
        if result and len(result) > 0:
            page_result = result[0]
            if isinstance(page_result, list):
                for line in page_result:
                    if isinstance(line, list) and len(line) >= 2:
                        box_coords = line[0]
                        text, conf = line[1][0], line[1][1]
                        
                        xs = [pt[0] for pt in box_coords]
                        ys = [pt[1] for pt in box_coords]
                        ox1, oy1, ox2, oy2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                        
                        raw_ocr_lines.append({
                            'text': text,
                            'confidence': conf,
                            'box': (ox1, oy1, ox2, oy2)
                        })
            elif hasattr(page_result, 'get') or hasattr(page_result, 'rec_texts'):
                rec_texts = []
                rec_scores = []
                boxes = []
                
                if hasattr(page_result, 'get'):
                    rec_texts = page_result.get('rec_texts', [])
                    rec_scores = page_result.get('rec_scores', [])
                    boxes = page_result.get('boxes', page_result.get('dt_polys', []))
                else:
                    rec_texts = getattr(page_result, 'rec_texts', [])
                    rec_scores = getattr(page_result, 'rec_scores', [])
                    boxes = getattr(page_result, 'boxes', getattr(page_result, 'dt_polys', []))
                    
                for text_part, conf, box_coords in zip(rec_texts, rec_scores, boxes):
                    if isinstance(box_coords, (list, np.ndarray)):
                        xs = [pt[0] for pt in box_coords]
                        ys = [pt[1] for pt in box_coords]
                        ox1, oy1, ox2, oy2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                    else:
                        ox1, oy1, ox2, oy2 = 0, 0, 0, 0
                        
                    raw_ocr_lines.append({
                        'text': text_part,
                        'confidence': conf,
                        'box': (ox1, oy1, ox2, oy2)
                    })
                    
        if self._debug_dump_lines:
            logger.debug("Raw OCR extracted %d lines", len(raw_ocr_lines))
            for idx, line in enumerate(raw_ocr_lines):
                logger.debug("Line %d: %r @ %s", idx, line.get("text", ""), line.get("box"))

        # Map raw OCR lines to YOLO region boxes
        mapped_results = []
        
        def get_overlap_ratio(bbox1, bbox2):
            x1_1, y1_1, x2_1, y2_1 = bbox1
            x1_2, y1_2, x2_2, y2_2 = bbox2
            
            # Intersection
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

        mapped_line_indices = set()
        for r in regions:
            rx1, ry1, rx2, ry2 = r.box
            region_lines = []
            
            for idx, line in enumerate(raw_ocr_lines):
                ox1, oy1, ox2, oy2 = line['box']
                o_cx = (ox1 + ox2) / 2.0
                o_cy = (oy1 + oy2) / 2.0
                
                # Check if center of OCR text box falls within the YOLO region box
                center_inside = (rx1 <= o_cx <= rx2) and (ry1 <= o_cy <= ry2)
                
                # Check if there is significant bounding box overlap
                overlap = get_overlap_ratio(line['box'], r.box)
                
                if center_inside or overlap > 0.4:
                    region_lines.append(line)
                    mapped_line_indices.add(idx)
            
            # Sort region lines: top-to-bottom, left-to-right
            region_lines.sort(key=lambda l: (l['box'][1] // 10, l['box'][0]))
            
            full_text = ' '.join(l['text'] for l in region_lines).strip()
            avg_conf = sum(l['confidence'] for l in region_lines) / len(region_lines) if region_lines else 0.0
            
            mapped_results.append(OCRResult(
                region_id=r.region_id,
                text=full_text,
                confidence=avg_conf,
                box=r.box,
                yolo_hint=r.yolo_label,
                raw_lines=[{'text': l['text'], 'conf': l['confidence']} for l in region_lines]
            ))
            
        # Add unmapped lines as separate standalone OCRResult objects
        unmapped_id = 1000
        for idx, line in enumerate(raw_ocr_lines):
            if idx not in mapped_line_indices:
                mapped_results.append(OCRResult(
                    region_id=unmapped_id,
                    text=line['text'].strip(),
                    confidence=line['confidence'],
                    box=line['box'],
                    yolo_hint='unmapped_ocr',
                    raw_lines=[{'text': line['text'], 'conf': line['confidence']}]
                ))
                unmapped_id += 1
                
        return mapped_results
