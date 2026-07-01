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
            
            # Create a tiny dummy image (100x100 white block)
            dummy_img = np.ones((100, 100, 3), dtype=np.uint8) * 255
            
            # Run OCR warmup to trigger graph compilation
            _ = self.ocr_engine.ocr.ocr(dummy_img)
            
            # Run YOLO warmup
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
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Cannot load image from path: {image_path}")

        # Downscale image if it is too large (speeds up OCR and YOLO significantly)
        h, w = image.shape[:2]
        max_dim = max(h, w)
        if max_dim > 1600:
            scale = 1600.0 / max_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
            cv2.imwrite(image_path, image)
            logger.info(f"Resized image from {w}x{h} to {new_w}x{new_h} for fast processing.")

        # Step 1: YOLO region detection
        regions = self.detector.detect(image_path)
        logger.info(f"YOLO detector found {len(regions)} regions.")

        # Fallback: if YOLO found absolutely nothing, treat full image as single region
        if not regions:
            logger.warning("No regions detected by YOLO — processing full image as fallback.")
            h, w = image.shape[:2]
            from app.pipeline.detector import DetectedRegion
            regions = [DetectedRegion(
                box=(0, 0, w, h),
                yolo_label='full_page',
                yolo_conf=0.0,
                region_id=0
            )]

        # Step 2: Run single-pass OCR with spatial mapping
        ocr_results = self.ocr_engine.extract_all_regions(image, regions)

        # Concatenate raw OCR results for preview
        sorted_ocr = sorted(ocr_results, key=lambda r: (r.box[1], r.box[0]))
        raw_ocr_text = "\n".join([r.text for r in sorted_ocr if r.text.strip()])

        # Step 3: Semantic Engine classification
        engine = SemanticEngine(image.shape)
        classified_fields = engine.classify(ocr_results)

        return {
            'status': 'success',
            'fields': classified_fields,
            'raw_ocr': raw_ocr_text,
            'metadata': {
                'regions_detected': len(regions),
                'ocr_regions_used': len(ocr_results),
                'image_size': {
                    'width': image.shape[1],
                    'height': image.shape[0]
                }
            }
        }
