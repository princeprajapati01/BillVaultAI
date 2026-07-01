import os
from dataclasses import dataclass
from typing import List
from ultralytics import YOLO

@dataclass
class DetectedRegion:
    box: tuple          # (x1, y1, x2, y2)
    yolo_label: str     # WEAK HINT ONLY — not trusted
    yolo_conf: float
    region_id: int

class YOLODetector:
    def __init__(self, model_path: str, conf_threshold: float = 0.25):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model not found at {model_path}")
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold

    def detect(self, image_path: str) -> List[DetectedRegion]:
        results = self.model(image_path, conf=self.conf_threshold, verbose=False)[0]
        regions = []
        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            label = results.names[int(box.cls[0])]
            conf = float(box.conf[0])
            regions.append(DetectedRegion(
                box=(x1, y1, x2, y2),
                yolo_label=label,
                yolo_conf=conf,
                region_id=i
            ))
        # Sort by vertical position (top->bottom reading order)
        regions.sort(key=lambda r: r.box[1])
        return regions
