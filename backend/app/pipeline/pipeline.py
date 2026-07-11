import cv2
import logging
from typing import Dict, Any
from app.pipeline.detector import YOLODetector, DetectedRegion
from app.pipeline.ocr_engine import OCREngine
from app.pipeline.semantic_engine import SemanticEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IDPPipeline:
    def __init__(self, yolo_model_path: str):
        logger.info(f"Initializing YOLO Detector with {yolo_model_path}")
        self.detector = YOLODetector(yolo_model_path)
        logger.info("Initializing PaddleOCR Engine")
        self.ocr_engine = OCREngine(lang='en')

        # Warmup models to prevent first-request latency spikes in production
        try:
            logger.info("Warming up YOLO detector and PaddleOCR models...")
            import numpy as np
            import tempfile
            import os

            dummy_img = np.ones((100, 100, 3), dtype=np.uint8) * 255

            _ = self.ocr_engine.ocr.ocr(dummy_img)

            fd, temp_path = tempfile.mkstemp(suffix=".png")
            try:
                os.close(fd)
                cv2.imwrite(temp_path, dummy_img)
                _ = self.detector.detect(temp_path)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            logger.info("Warmup completed successfully. Ready for inference.")
        except Exception as e:
            logger.warning(f"Model warmup failed: {e}")

    def process(self, image_path: str) -> Dict[str, Any]:
        import os
        is_pdf = image_path.lower().endswith('.pdf')
        processing_path = image_path
        temp_preview_path = None

        if is_pdf:
            import fitz
            logger.info(f"Detected PDF input: {image_path}. Rendering first page to image...")
            try:
                doc = fitz.open(image_path)
                if len(doc) == 0:
                    raise ValueError("The uploaded PDF file has no pages.")
                page = doc.load_page(0)
                pix = page.get_pixmap(dpi=150)
                temp_preview_path = os.path.splitext(image_path)[0] + "_pipeline_preview.png"
                pix.save(temp_preview_path)
                processing_path = temp_preview_path
            except Exception as e:
                logger.error(f"Error rendering PDF page: {e}", exc_info=True)
                raise ValueError(f"Could not render PDF file: {str(e)}")

        try:
            image = cv2.imread(processing_path)
            if image is None:
                raise ValueError(f"Cannot load image from path: {processing_path}")

            # Downscale image if it is too large (speeds up OCR and YOLO significantly)
            h, w = image.shape[:2]
            max_dim = max(h, w)
            if max_dim > 1600:
                scale = 1600.0 / max_dim
                new_w = int(w * scale)
                new_h = int(h * scale)
                image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
                cv2.imwrite(processing_path, image)
                logger.info(f"Resized image from {w}x{h} to {new_w}x{new_h} for fast processing.")

            # Step 1: YOLO region detection
            regions = self.detector.detect(processing_path)
            logger.info(f"YOLO detector found {len(regions)} regions.")

            if not regions:
                logger.warning("No regions detected by YOLO — processing full image as fallback.")
                h, w = image.shape[:2]
                regions = [DetectedRegion(
                    box=(0, 0, w, h),
                    yolo_label='full_page',
                    yolo_conf=0.0,
                    region_id=0
                )]

            # Step 2: Run single-pass OCR. Each OCRResult is ONE real OCR
            # line with its own box — YOLO regions are attached only as
            # advisory metadata (yolo_hint), never used to merge multiple
            # lines' text together (see ocr_engine.py docstring / audit Bug #1).
            ocr_results = self.ocr_engine.extract_all_regions(image, regions)

            sorted_ocr = sorted(ocr_results, key=lambda r: (r.box[1], r.box[0]))
            raw_ocr_text = "\n".join([r.text for r in sorted_ocr if r.text.strip()])

            # Step 3: Extraction. Try the LLM path first (already applies
            # OCR-hint corrections internally, exactly once); fall back to
            # the rule-based SemanticEngine, which does NOT yet apply the
            # OCR-hint correction pass internally, so we apply it once here
            # only for that fallback path (audit Bug #8 — this used to run
            # twice for the LLM path).
            from app.pipeline.llm_engine import extract_with_huggingface, apply_ocr_corrections_to_fields

            classified_fields = extract_with_huggingface(processing_path, raw_ocr_text)
            used_fallback = classified_fields is None

            if used_fallback:
                logger.info("LLM extraction unavailable — using rule-based SemanticEngine classification.")
                engine = SemanticEngine(image.shape)
                classified_fields = engine.classify(ocr_results)
                # The SemanticEngine path does not call apply_ocr_corrections_to_fields
                # internally, unlike the LLM path (see llm_engine.map_llm_json_to_schema),
                # so it is applied exactly once here.
                classified_fields = apply_ocr_corrections_to_fields(classified_fields, raw_ocr_text)

            return {
                'status': 'success',
                'fields': classified_fields,
                'raw_ocr': raw_ocr_text,
                'engine_used': 'semantic_engine_fallback' if used_fallback else 'llm',
                'metadata': {
                    'regions_detected': len(regions),
                    'ocr_regions_used': len(ocr_results),
                    'image_size': {
                        'width': image.shape[1],
                        'height': image.shape[0]
                    }
                }
            }
        finally:
            if temp_preview_path and os.path.exists(temp_preview_path):
                try:
                    os.remove(temp_preview_path)
                    logger.info(f"Cleaned up temporary preview image: {temp_preview_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete temporary preview image {temp_preview_path}: {e}")
