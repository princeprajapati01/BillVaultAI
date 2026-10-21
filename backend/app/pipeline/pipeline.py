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
            import numpy as np
            logger.info(f"Detected PDF input: {image_path}. Rendering pages to image...")
            try:
                doc = fitz.open(image_path)
                num_pages = len(doc)
                if num_pages == 0:
                    raise ValueError("The uploaded PDF file has no pages.")

                # Render up to 3 pages (standard invoice length) and stitch vertically
                max_pages_to_render = min(num_pages, 3)
                page_images = []
                for p_no in range(max_pages_to_render):
                    page = doc.load_page(p_no)
                    pix = page.get_pixmap(dpi=150)
                    img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                    if pix.n == 4:
                        img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGBA2BGR)
                    elif pix.n == 3:
                        img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
                    else:
                        img_bgr = cv2.cvtColor(img_data, cv2.COLOR_GRAY2BGR)
                    page_images.append(img_bgr)

                if len(page_images) == 1:
                    stitched = page_images[0]
                else:
                    target_w = max(p.shape[1] for p in page_images)
                    resized_pages = []
                    for p in page_images:
                        if p.shape[1] != target_w:
                            scale = target_w / p.shape[1]
                            resized_pages.append(cv2.resize(p, (target_w, int(p.shape[0] * scale)), interpolation=cv2.INTER_AREA))
                        else:
                            resized_pages.append(p)
                    stitched = np.vstack(resized_pages)

                temp_preview_path = os.path.splitext(image_path)[0] + "_pipeline_preview.png"
                cv2.imwrite(temp_preview_path, stitched)
                processing_path = temp_preview_path
                logger.info(f"Rendered {max_pages_to_render}/{num_pages} pages from PDF.")
            except Exception as e:
                logger.error(f"Error rendering PDF pages: {e}", exc_info=True)
                raise ValueError(f"Could not render PDF file: {str(e)}")

        try:
            import numpy as np
            image = None
            try:
                with open(processing_path, "rb") as f:
                    file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
                image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            except Exception:
                image = None

            if image is None:
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
                try:
                    is_ok, buf = cv2.imencode(".png", image)
                    if is_ok:
                        with open(processing_path, "wb") as f:
                            f.write(buf)
                except Exception:
                    cv2.imwrite(processing_path, image)
                logger.info(f"Resized image from {w}x{h} to {new_w}x{new_h} for fast processing.")

            # Step 1: YOLO region detection
            try:
                regions = self.detector.detect(processing_path)
                logger.info(f"YOLO detector found {len(regions)} regions.")
            except Exception as det_err:
                logger.warning(f"YOLO detection failed: {det_err} — using full image fallback.")
                regions = []

            if not regions:
                logger.warning("No regions detected by YOLO — processing full image as fallback.")
                h, w = image.shape[:2]
                regions = [DetectedRegion(
                    box=(0, 0, w, h),
                    yolo_label='full_page',
                    yolo_conf=0.0,
                    region_id=0
                )]

            # Step 2: Run single-pass OCR.
            ocr_results = self.ocr_engine.extract_all_regions(image, regions)

            sorted_ocr = sorted(ocr_results, key=lambda r: (r.box[1], r.box[0]))
            raw_ocr_text = "\n".join([r.text for r in sorted_ocr if r.text.strip()])

            # Step 3: Extraction with robust fallback tiers
            from app.pipeline.llm_engine import extract_with_huggingface, apply_ocr_corrections_to_fields

            classified_fields = None
            try:
                classified_fields = extract_with_huggingface(processing_path, raw_ocr_text)
            except Exception as llm_err:
                logger.warning(f"LLM extraction error: {llm_err}, proceeding to SemanticEngine fallback.")
                classified_fields = None

            used_fallback = classified_fields is None

            if used_fallback:
                logger.info("LLM extraction unavailable — using rule-based SemanticEngine classification.")
                try:
                    engine = SemanticEngine(image.shape)
                    classified_fields = engine.classify(ocr_results)
                    classified_fields = apply_ocr_corrections_to_fields(classified_fields, raw_ocr_text)
                except Exception as sem_err:
                    logger.error(f"SemanticEngine classification error: {sem_err}", exc_info=True)
                    # Safe fallback fields structure
                    classified_fields = {
                        "document_type": "invoice",
                        "vendor": {
                            "vendor_name": {"value": "Unknown Merchant", "confidence": 0},
                            "vendor_address": {"value": None, "confidence": 0},
                            "vendor_gstin": {"value": None, "confidence": 0},
                        },
                        "customer": {
                            "customer_name": {"value": None, "confidence": 0},
                        },
                        "invoice_details": {
                            "invoice_number": {"value": "Not detected", "confidence": 0},
                            "invoice_date": {"value": "Not detected", "confidence": 0},
                            "due_date": {"value": None, "confidence": 0},
                        },
                        "amounts": {
                            "subtotal": {"value": 0.0, "confidence": 0},
                            "grand_total": {"value": 0.0, "confidence": 0},
                        },
                        "taxes": {
                            "tax_amount": {"value": 0.0, "confidence": 0},
                            "cgst_amount": {"value": 0.0, "confidence": 0},
                            "sgst_amount": {"value": 0.0, "confidence": 0},
                            "igst_amount": {"value": 0.0, "confidence": 0},
                        },
                        "payment": {
                            "payment_method": {"value": None},
                            "transaction_id": {"value": None},
                            "balance_due": {"value": 0.0},
                            "amount_paid": {"value": 0.0},
                        },
                        "category": "Office",
                        "payment_status": "UNKNOWN",
                        "status_reason": f"Fallback: extraction degraded gracefully ({str(sem_err)[:100]})",
                        "confidence": {"overall": 10}
                    }

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
