import cv2
import json
from app.pipeline.pipeline import IDPPipeline
from app.pipeline.semantic_engine import SemanticEngine

def run_diagnostic():
    img_path = "uploads/b8817946-df33-444f-b7a4-b3900ddc6a01.png"
    pipeline = IDPPipeline(yolo_model_path="best.pt")
    image = cv2.imread(img_path)
    regions = pipeline.detector.detect(img_path)
    ocr_results = pipeline.ocr_engine.extract_all_regions(image, regions)
    
    engine = SemanticEngine(image.shape)
    classified = engine.classify(ocr_results)
    
    print("\n=== CLASSIFIED FIELDS ===")
    print(json.dumps(classified, indent=2))

if __name__ == "__main__":
    run_diagnostic()
