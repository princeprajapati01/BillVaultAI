import os
import cv2
import numpy as np
import logging
from app.pipeline.pipeline import IDPPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_synthetic_invoice(output_path: str):
    # Create a white image representing an invoice (800 width, 1000 height)
    img = np.ones((1000, 800, 3), dtype=np.uint8) * 255

    # Draw text helper
    def draw_text(text, position, font_scale=0.7, thickness=2):
        cv2.putText(img, text, position, cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness, cv2.LINE_AA)

    # Add vendor details
    draw_text("Acme Enterprises Pvt Ltd", (50, 80), font_scale=1.0, thickness=2)
    draw_text("123 Business Road, Tech City", (50, 110), font_scale=0.5, thickness=1)
    draw_text("Email: billing@acme.com  Phone: +91-9876543210", (50, 130), font_scale=0.5, thickness=1)

    # Add invoice metadata
    draw_text("Tax Invoice", (550, 80), font_scale=1.0, thickness=2)
    draw_text("Invoice No: INV-2026-00451", (50, 200))
    draw_text("Date: 24/05/2026", (50, 230))
    draw_text("GSTIN: 29ABCDE1234F1Z5", (50, 260))

    # Add line items table header
    draw_text("Description", (50, 350))
    draw_text("Amount", (600, 350))
    cv2.line(img, (50, 370), (750, 370), (0, 0, 0), 2)

    # Add items
    draw_text("Intelligent IDP Software License", (50, 420))
    draw_text("Rs 12,000.00", (600, 420))

    # Add totals
    draw_text("Subtotal:", (450, 600))
    draw_text("Rs 12,000.00", (600, 600))

    draw_text("CGST (9%):", (450, 640))
    draw_text("Rs 1,080.00", (600, 640))

    draw_text("SGST (9%):", (450, 680))
    draw_text("Rs 1,080.00", (600, 680))

    cv2.line(img, (450, 710), (750, 710), (0, 0, 0), 1)

    draw_text("Grand Total:", (450, 750), font_scale=0.8, thickness=2)
    draw_text("Rs 14,160.00", (600, 750), font_scale=0.8, thickness=2)

    # Save image
    cv2.imwrite(output_path, img)
    logger.info(f"Synthetic invoice image saved to {output_path}")

def run_test():
    yolo_model = "best.pt"
    test_img_path = "test_synthetic_invoice.png"

    # 1. Create synthetic invoice image
    create_synthetic_invoice(test_img_path)

    # 2. Instantiate and run pipeline
    try:
        pipeline = IDPPipeline(yolo_model_path=yolo_model)
        logger.info("Pipeline loaded successfully.")
        
        logger.info(f"Processing image: {test_img_path}")
        
        # We will manually run detector & OCR to print raw values
        image = cv2.imread(test_img_path)
        regions = pipeline.detector.detect(test_img_path)
        print("\n=== RAW OCR RESULTS ===")
        ocr_results = pipeline.ocr_engine.extract_all_regions(image, regions)
        for res in ocr_results:
            print(f"Region {res.region_id} (YOLO: {res.yolo_hint}): '{res.text}' (conf: {res.confidence:.2f})")

        
        # Apply semantic engine
        from app.pipeline.semantic_engine import SemanticEngine
        engine = SemanticEngine(image.shape)
        classified = engine.classify(ocr_results)
        
        # Print parsed output
        import json
        print("\n=== PIPELINE EXTRACTED FIELDS ===")
        print(json.dumps({
            'status': 'success',
            'fields': classified,
            'metadata': {
                'regions_detected': len(regions),
                'ocr_regions_used': len(ocr_results)
            }
        }, indent=2))
        
    except Exception as e:
        logger.error("Pipeline test failed with error:", exc_info=True)
    finally:
        # Cleanup
        if os.path.exists(test_img_path):
            os.remove(test_img_path)

if __name__ == "__main__":
    run_test()
