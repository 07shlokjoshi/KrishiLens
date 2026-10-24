"""
KrishiLens YOLO Inference Server (FastAPI/Uvicorn)
===================================================
Runs as a sidecar process alongside the Node.js backend.
Accepts base64-encoded images, returns genuine YOLO predictions:
  - Bounding boxes in [x_center, y_center, width, height] normalized form
  - Plus pixel coords for the original image dimensions
  - Class labels and actual confidence scores
  - Per-class mAP metrics from model manifest

Start: .venv/bin/python src/services/yoloServer.py
Port: 5001 (configured via YOLO_PORT env var)
"""

import os
import sys
import json
import base64
import io
import time
from pathlib import Path

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
    from ultralytics import YOLO
    from PIL import Image
    import numpy as np
    import torch
except ImportError as e:
    print(f"[FATAL] Missing dependency: {e}")
    print("Run: .venv/bin/pip install fastapi uvicorn ultralytics pillow numpy")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
PORT = int(os.environ.get("YOLO_PORT", 5001))
CHECKPOINT = os.environ.get(
    "YOLO_CHECKPOINT",
    "experiments/detection/weights/best.pt"
)
DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
CONF_THRESHOLD = float(os.environ.get("YOLO_CONF", 0.25))
IOU_THRESHOLD  = float(os.environ.get("YOLO_IOU",  0.45))

CLASS_NAMES = ["pesticide_package", "cibrc_label", "toxicity_triangle", "cibrc_reg_stamp"]
CLASS_COLORS = {
    "pesticide_package":  "#10b981",
    "cibrc_label":        "#3b82f6",
    "toxicity_triangle":  "#ef4444",
    "cibrc_reg_stamp":    "#f59e0b",
}

app = FastAPI(title="KrishiLens YOLO Server", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Loading ─────────────────────────────────────────────────────────────
model = None
manifest = {}

def load_model():
    global model, manifest
    checkpoint_path = Path(CHECKPOINT)
    if not checkpoint_path.exists():
        print(f"[WARN] Checkpoint not found: {CHECKPOINT}")
        print("[WARN] Using pretrained yolov8n.pt as fallback (untrained on pesticide data)")
        checkpoint_path = Path("yolov8n.pt")
    
    print(f"[INFO] Loading YOLO model: {checkpoint_path}")
    model = YOLO(str(checkpoint_path))
    model.to(DEVICE)
    
    # Load model manifest if available
    manifest_path = Path("experiments/detection/model_manifest.json")
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
        print(f"[INFO] Model manifest loaded: {manifest.get('winning_experiment', 'unknown')}")
    
    print(f"[INFO] YOLO server ready on port {PORT} | Device: {DEVICE}")
    print(f"[INFO] Classes: {model.names}")
    return model

# ── Request/Response Models ────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    image: str          # base64 data URI or raw base64
    conf: float = CONF_THRESHOLD
    iou:  float = IOU_THRESHOLD

class BoundingBox(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    color: str
    # Normalized coordinates (0.0 to 1.0), cx/cy/w/h format from YOLO
    bbox_norm: list      # [x_center, y_center, width, height]
    # Pixel coordinates for the original image
    bbox_pixels: dict    # {x1, y1, x2, y2, width, height} in original image pixels

class PredictResponse(BaseModel):
    model_source: str
    device: str
    image_width: int
    image_height: int
    num_detections: int
    detections: list
    latency_ms: float
    conf_threshold: float
    iou_threshold: float
    model_metrics: dict

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "checkpoint": CHECKPOINT,
        "device": DEVICE,
        "class_names": CLASS_NAMES,
        "manifest": manifest.get("winning_experiment", "none"),
    }

@app.get("/model-info")
def model_info():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {
        "checkpoint": CHECKPOINT,
        "device": DEVICE,
        "class_names": list(model.names.values()) if model.names else CLASS_NAMES,
        "manifest": manifest,
        "conf_threshold": CONF_THRESHOLD,
        "iou_threshold": IOU_THRESHOLD,
    }

@app.post("/predict")
def predict(req: PredictRequest):
    t0 = time.time()
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    # ── Decode image ──────────────────────────────────────────────────────────
    try:
        img_data = req.image
        if img_data.startswith("data:"):
            # Strip data URI header
            header, img_data = img_data.split(",", 1)
        img_bytes = base64.b64decode(img_data)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        orig_w, orig_h = pil_img.size
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")
    
    # ── Run YOLO inference ────────────────────────────────────────────────────
    try:
        results = model.predict(
            source=pil_img,
            conf=req.conf,
            iou=req.iou,
            device=DEVICE,
            verbose=False,
            imgsz=640,
            agnostic_nms=False,
            max_det=20,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"YOLO inference failed: {e}")
    
    # ── Parse detections ──────────────────────────────────────────────────────
    detections = []
    result = results[0]
    
    if result.boxes is not None and len(result.boxes) > 0:
        boxes_xywhn = result.boxes.xywhn.cpu().numpy()   # normalized cx,cy,w,h
        boxes_xyxy  = result.boxes.xyxy.cpu().numpy()    # pixel x1,y1,x2,y2
        confs       = result.boxes.conf.cpu().numpy()
        cls_ids     = result.boxes.cls.cpu().numpy().astype(int)
        
        for i in range(len(boxes_xywhn)):
            cls_id = int(cls_ids[i])
            cls_name = model.names.get(cls_id, f"class_{cls_id}")
            conf = float(confs[i])
            
            # Normalized bbox (cx, cy, w, h)
            cx, cy, bw, bh = boxes_xywhn[i].tolist()
            
            # Pixel bbox (x1, y1, x2, y2) in original image
            x1_px, y1_px, x2_px, y2_px = boxes_xyxy[i].tolist()
            # Scale to original image size (YOLO may have resized to 640)
            scale_x = orig_w / result.orig_shape[1]
            scale_y = orig_h / result.orig_shape[0]
            x1_orig = x1_px * scale_x
            y1_orig = y1_px * scale_y
            x2_orig = x2_px * scale_x
            y2_orig = y2_px * scale_y
            
            detections.append({
                "class_id":   cls_id,
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "color": CLASS_COLORS.get(cls_name, "#ffffff"),
                "bbox_norm": [round(cx, 6), round(cy, 6), round(bw, 6), round(bh, 6)],
                "bbox_pixels": {
                    "x1": round(x1_orig, 1),
                    "y1": round(y1_orig, 1),
                    "x2": round(x2_orig, 1),
                    "y2": round(y2_orig, 1),
                    "width":  round(x2_orig - x1_orig, 1),
                    "height": round(y2_orig - y1_orig, 1),
                },
            })
    
    # Sort by confidence desc
    detections.sort(key=lambda d: d["confidence"], reverse=True)
    
    latency_ms = round((time.time() - t0) * 1000, 1)
    
    return {
        "model_source": CHECKPOINT,
        "device": DEVICE,
        "image_width": orig_w,
        "image_height": orig_h,
        "num_detections": len(detections),
        "detections": detections,
        "latency_ms": latency_ms,
        "conf_threshold": req.conf,
        "iou_threshold": req.iou,
        "model_metrics": {
            "val_mAP50":    manifest.get("val_metrics", {}).get("val_mAP50", None),
            "val_mAP50_95": manifest.get("val_metrics", {}).get("val_mAP50_95", None),
            "val_precision": manifest.get("val_metrics", {}).get("val_precision", None),
            "val_recall":   manifest.get("val_metrics", {}).get("val_recall", None),
            "per_class_mAP50": manifest.get("per_class_val_mAP50", {}),
            "winning_experiment": manifest.get("winning_experiment", "baseline"),
        },
    }

@app.on_event("startup")
async def startup():
    load_model()

if __name__ == "__main__":
    uvicorn.run("yoloServer:app", host="0.0.0.0", port=PORT, reload=False)
