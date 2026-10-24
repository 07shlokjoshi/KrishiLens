#!/usr/bin/env python3
"""
End-to-End YOLO Pipeline Test
==============================
Tests:
1. Model checkpoint loads correctly
2. YOLO can run inference on a test image
3. Bounding boxes are properly formatted
4. Coordinates are correctly scaled
"""

import json
import base64
import sys
from pathlib import Path

try:
    from ultralytics import YOLO
    from PIL import Image
    import torch
except ImportError as e:
    print(f"[FATAL] Missing dependency: {e}")
    sys.exit(1)

CHECKPOINT = Path("experiments/detection/weights/best.pt")
TEST_IMAGE_DIR = Path("data/pesticide_pilot_dataset/images/test")
DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")


def test_model_loading():
    """Test 1: Model checkpoint loads correctly."""
    print(f"\n[TEST 1] Model Loading")
    print(f"{'='*70}")

    if not CHECKPOINT.exists():
        print(f"[FAIL] Checkpoint not found: {CHECKPOINT}")
        return False

    try:
        model = YOLO(str(CHECKPOINT))
        model.to(DEVICE)
        print(f"✓ Model loaded: {len(model.names)} classes")
        print(f"  Classes: {list(model.names.values())}")
        print(f"  Device: {DEVICE}")
        return True
    except Exception as e:
        print(f"[FAIL] {e}")
        return False


def test_inference():
    """Test 2: YOLO can run inference on a test image."""
    print(f"\n[TEST 2] Inference on Test Image")
    print(f"{'='*70}")

    # Find a test image
    test_images = list(TEST_IMAGE_DIR.glob("*.jpg")) + list(TEST_IMAGE_DIR.glob("*.png"))
    if not test_images:
        print(f"[SKIP] No test images found in {TEST_IMAGE_DIR}")
        return None

    test_image = test_images[0]
    print(f"Testing on: {test_image.name}")

    try:
        model = YOLO(str(CHECKPOINT))
        model.to(DEVICE)

        results = model.predict(
            source=str(test_image),
            conf=0.25,
            iou=0.45,
            device=DEVICE,
            verbose=False,
        )

        result = results[0]
        orig_w, orig_h = result.orig_shape[1], result.orig_shape[0]
        num_detections = len(result.boxes) if result.boxes is not None else 0

        print(f"✓ Inference completed")
        print(f"  Image size: {orig_w}x{orig_h}")
        print(f"  Detections: {num_detections}")

        if num_detections > 0:
            boxes_xywhn = result.boxes.xywhn.cpu().numpy()
            boxes_xyxy = result.boxes.xyxy.cpu().numpy()
            confs = result.boxes.conf.cpu().numpy()
            cls_ids = result.boxes.cls.cpu().numpy().astype(int)

            for i in range(min(3, num_detections)):
                cls_name = model.names[int(cls_ids[i])]
                conf = float(confs[i])
                print(f"    [{i+1}] {cls_name}: {conf:.4f} confidence")

        return True
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return False


def test_bbox_format():
    """Test 3: Bounding boxes are properly formatted for frontend."""
    print(f"\n[TEST 3] Bounding Box Format")
    print(f"{'='*70}")

    test_images = list(TEST_IMAGE_DIR.glob("*.jpg")) + list(TEST_IMAGE_DIR.glob("*.png"))
    if not test_images:
        print(f"[SKIP] No test images found")
        return None

    test_image = test_images[0]

    try:
        model = YOLO(str(CHECKPOINT))
        model.to(DEVICE)

        # Load and convert image to base64 (like frontend does)
        pil_img = Image.open(test_image).convert("RGB")
        orig_w, orig_h = pil_img.size

        results = model.predict(
            source=pil_img,
            conf=0.25,
            iou=0.45,
            device=DEVICE,
            verbose=False,
        )

        result = results[0]
        detections = []

        if result.boxes is not None and len(result.boxes) > 0:
            boxes_xywhn = result.boxes.xywhn.cpu().numpy()
            boxes_xyxy = result.boxes.xyxy.cpu().numpy()
            confs = result.boxes.conf.cpu().numpy()
            cls_ids = result.boxes.cls.cpu().numpy().astype(int)

            for i in range(len(boxes_xywhn)):
                cls_id = int(cls_ids[i])
                cls_name = model.names.get(cls_id, f"class_{cls_id}")
                conf = float(confs[i])

                # Normalized bbox (cx, cy, w, h)
                cx, cy, bw, bh = boxes_xywhn[i].tolist()

                # Pixel bbox in YOLO model space
                x1_px, y1_px, x2_px, y2_px = boxes_xyxy[i].tolist()

                # Scale to original image size
                scale_x = orig_w / result.orig_shape[1]
                scale_y = orig_h / result.orig_shape[0]
                x1_orig = x1_px * scale_x
                y1_orig = y1_px * scale_y
                x2_orig = x2_px * scale_x
                y2_orig = y2_px * scale_y

                detection = {
                    "class_id": cls_id,
                    "class_name": cls_name,
                    "confidence": round(conf, 4),
                    "bbox_norm": [round(cx, 6), round(cy, 6), round(bw, 6), round(bh, 6)],
                    "bbox_pixels": {
                        "x1": round(x1_orig, 1),
                        "y1": round(y1_orig, 1),
                        "x2": round(x2_orig, 1),
                        "y2": round(y2_orig, 1),
                        "width": round(x2_orig - x1_orig, 1),
                        "height": round(y2_orig - y1_orig, 1),
                    }
                }
                detections.append(detection)

        print(f"✓ BBox format validation")
        print(f"  Original image: {orig_w}x{orig_h}")
        print(f"  Model input: {result.orig_shape[1]}x{result.orig_shape[0]}")
        print(f"  Detections: {len(detections)}")

        if detections:
            det = detections[0]
            print(f"\n  Sample detection (first object):")
            print(f"    Class: {det['class_name']}")
            print(f"    Confidence: {det['confidence']}")
            print(f"    Normalized bbox: {det['bbox_norm']}")
            print(f"    Pixel bbox: x1={det['bbox_pixels']['x1']} y1={det['bbox_pixels']['y1']} "
                  f"x2={det['bbox_pixels']['x2']} y2={det['bbox_pixels']['y2']}")
            print(f"    Dimensions: {det['bbox_pixels']['width']}x{det['bbox_pixels']['height']}")

            # Validate bbox values
            cx, cy, bw, bh = det['bbox_norm']
            if not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 <= bw <= 1 and 0 <= bh <= 1):
                print(f"[WARN] Normalized bbox out of range!")
                return False

            x1, y1, x2, y2 = det['bbox_pixels']['x1'], det['bbox_pixels']['y1'], \
                             det['bbox_pixels']['x2'], det['bbox_pixels']['y2']
            if not (0 <= x1 <= orig_w and 0 <= x2 <= orig_w and 0 <= y1 <= orig_h and 0 <= y2 <= orig_h):
                print(f"[WARN] Pixel bbox out of image bounds!")
                return False

        return True
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "="*70)
    print("KrishiLens YOLO End-to-End Pipeline Test")
    print("="*70)

    results = {
        "model_loading": test_model_loading(),
        "inference": test_inference(),
        "bbox_format": test_bbox_format(),
    }

    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    for test_name, result in results.items():
        status = "✓ PASS" if result else ("✗ FAIL" if result is False else "⊘ SKIP")
        print(f"  {test_name:<30} {status}")

    all_passed = all(v for v in results.values() if v is not None)
    if all_passed:
        print(f"\n✓ All tests passed! YOLO pipeline is ready for production.")
        return 0
    else:
        print(f"\n✗ Some tests failed. Fix issues before deploying.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
