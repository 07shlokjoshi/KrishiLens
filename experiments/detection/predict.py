import os
import sys
import json
from ultralytics import YOLO
from PIL import Image

CLASS_NAMES = {
    0: "pesticide_package",
    1: "cibrc_label",
    2: "toxicity_triangle",
    3: "cibrc_reg_stamp"
}

def predict_objects(image_path, weights_path=None, conf_threshold=0.35, iou_threshold=0.45):
    if weights_path is None:
        weights_path = os.path.join(os.path.dirname(__file__), "weights", "best.pt")

    if not os.path.exists(weights_path):
        return {
            "success": False,
            "error": f"Model weights not found at {weights_path}",
            "detections": []
        }

    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"Image file not found at {image_path}",
            "detections": []
        }

    with Image.open(image_path) as im:
        img_w, img_h = im.size

    model = YOLO(weights_path)
    results = model.predict(
        image_path,
        conf=conf_threshold,
        iou=iou_threshold,
        device="cpu", # safe for concurrent backend calls
        verbose=False
    )[0]

    detections = []
    for box in results.boxes:
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        x1_n, y1_n, x2_n, y2_n = box.xyxyn[0].tolist()
        w_n = max(0.001, x2_n - x1_n)
        h_n = max(0.001, y2_n - y1_n)

        # Pixel coords
        x1_p, y1_p, x2_p, y2_p = box.xyxy[0].tolist()

        detections.append({
            "class_id": cls_id,
            "class_name": CLASS_NAMES.get(cls_id, f"class_{cls_id}"),
            "confidence": round(conf, 4),
            "confidence_pct": round(conf * 100, 1),
            "bbox_normalized": [round(x1_n, 4), round(y1_n, 4), round(w_n, 4), round(h_n, 4)],
            "bbox_pixels": [int(x1_p), int(y1_p), int(x2_p - x1_p), int(y2_p - y1_p)]
        })

    # Sort by confidence descending
    detections.sort(key=lambda d: d["confidence"], reverse=True)

    return {
        "success": True,
        "image_dimensions": {"width": img_w, "height": img_h},
        "model_version": "YOLOv8n-KrishiLens-v1.0",
        "conf_threshold": conf_threshold,
        "detection_count": len(detections),
        "detections": detections
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path> [conf_threshold]")
        sys.exit(1)

    img_arg = sys.argv[1]
    conf_arg = float(sys.argv[2]) if len(sys.argv) > 2 else 0.35
    output = predict_objects(img_arg, conf_threshold=conf_arg)
    print(json.dumps(output, indent=2))
