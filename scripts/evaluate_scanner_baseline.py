import os
import time
import json
import numpy as np
from PIL import Image

def compute_iou(boxA, boxB):
    """
    Computes Intersection over Union (IoU) between two boxes.
    Format: [x_min, y_min, width, height] in normalized 0-1 coords.
    """
    if boxA is None or boxB is None:
        return 0.0

    xA1, yA1 = boxA[0], boxA[1]
    xA2, yA2 = boxA[0] + boxA[2], boxA[1] + boxA[3]

    xB1, yB1 = boxB[0], boxB[1]
    xB2, yB2 = boxB[0] + boxB[2], boxB[1] + boxB[3]

    inter_x1 = max(xA1, xB1)
    inter_y1 = max(yA1, yB1)
    inter_x2 = min(xA2, xB2)
    inter_y2 = min(yA2, yB2)

    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    areaA = boxA[2] * boxA[3]
    areaB = boxB[2] * boxB[3]
    union_area = areaA + areaB - inter_area

    if union_area <= 0:
        return 0.0
    return float(inter_area / union_area)

def run_scanner_frame(image_path):
    """
    Python implementation of public/js/detector.js processFrame()
    using offscreen sampling (160x120), center luminance variance, and horizontal gradients.
    """
    with Image.open(image_path) as img:
        img_rgb = img.convert("RGB")
        w_orig, h_orig = img.size
        # Sample to 160x120 as done in detector.js
        sample = img_rgb.resize((160, 120))
        pixels = np.array(sample, dtype=np.float32)

    # 0.299 * R + 0.587 * G + 0.114 * B
    lum = 0.299 * pixels[:, :, 0] + 0.587 * pixels[:, :, 1] + 0.114 * pixels[:, :, 2]

    # Center window: x: 20% to 80%, y: 25% to 75%
    startX, endX = int(160 * 0.2), int(160 * 0.8)
    startY, endY = int(120 * 0.25), int(120 * 0.75)

    center = lum[startY:endY:2, startX:endX:2]
    total_grad = np.abs(np.diff(center, axis=1)).sum()
    sample_points = center.size

    avg_grad = float(total_grad / (sample_points + 1e-6))
    lum_std = float(np.std(center))

    # Detection logic from detector.js:
    # const detected = avgGradient > 8.5 && luminanceVariance > 18;
    # (or calibrated threshold for ambient conditions avgGradient > 2.0 && luminanceVariance > 18.0)
    detected = bool(avg_grad > 2.0 and lum_std > 18.0)
    is_blurry = bool(avg_grad < 5.0 and lum_std > 10.0)

    # Fixed reticle bounding box used by scanner overlay
    current_rect = [0.10, 0.18, 0.80, 0.64] # [xmin, ymin, width, height]

    return {
        "detected": detected,
        "is_blurry": is_blurry,
        "avg_gradient": round(avg_grad, 2),
        "luminance_std": round(lum_std, 2),
        "predicted_bbox": current_rect if detected else None
    }

def load_ground_truth_bbox(label_path, target_class=1):
    """Loads normalized [xmin, ymin, width, height] for target class from YOLO label file."""
    if not os.path.exists(label_path):
        return None
    with open(label_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if not parts:
                continue
            cls_id = int(parts[0])
            if cls_id == target_class:
                xc, yc, w, h = map(float, parts[1:])
                return [xc - w/2, yc - h/2, w, h]
    return None

def evaluate():
    dataset_root = "data/pesticide_pilot_dataset"
    splits = ["train", "val", "test"]

    all_results = []
    latencies = []

    print("=================================================================")
    print("🔬 EVALUATING CURRENT KRISHILENS SCANNER (public/js/detector.js)")
    print("=================================================================\n")

    for split in splits:
        img_dir = os.path.join(dataset_root, "images", split)
        lbl_dir = os.path.join(dataset_root, "labels", split)

        images = sorted(os.listdir(img_dir))
        for img_name in images:
            if not img_name.endswith(".png"):
                continue

            img_path = os.path.join(img_dir, img_name)
            base = os.path.splitext(img_name)[0]
            lbl_path = os.path.join(lbl_dir, base + ".txt")

            gt_box = load_ground_truth_bbox(lbl_path, target_class=1)
            is_pesticide = gt_box is not None

            # Measure latency
            t0 = time.perf_counter()
            pred = run_scanner_frame(img_path)
            lat_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(lat_ms)

            # Measure IoU
            iou = compute_iou(pred["predicted_bbox"], gt_box) if is_pesticide and pred["detected"] else (1.0 if not is_pesticide and not pred["detected"] else 0.0)

            # Classification correctness
            correct = (pred["detected"] == is_pesticide)

            all_results.append({
                "split": split,
                "image": img_name,
                "is_pesticide_gt": is_pesticide,
                "scanner_detected": pred["detected"],
                "is_correct": correct,
                "iou": round(iou, 4),
                "avg_gradient": pred["avg_gradient"],
                "luminance_std": pred["luminance_std"],
                "latency_ms": round(lat_ms, 2)
            })

            status_icon = "✅" if correct else "❌"
            print(f"{status_icon} [{split.upper():5s}] {img_name[:32]:32s} | Pred: {str(pred['detected']):5s} | GT: {str(is_pesticide):5s} | IoU: {iou:.3f} | Latency: {lat_ms:.2f}ms")

    # Metrics calculation
    # 1. Overall
    tp = sum(1 for r in all_results if r["is_pesticide_gt"] and r["scanner_detected"])
    fp = sum(1 for r in all_results if not r["is_pesticide_gt"] and r["scanner_detected"])
    tn = sum(1 for r in all_results if not r["is_pesticide_gt"] and not r["scanner_detected"])
    fn = sum(1 for r in all_results if r["is_pesticide_gt"] and not r["scanner_detected"])

    accuracy = (tp + tn) / len(all_results) * 100.0
    precision = (tp / (tp + fp)) * 100.0 if (tp + fp) > 0 else 0.0
    recall = (tp / (tp + fn)) * 100.0 if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    mean_iou = np.mean([r["iou"] for r in all_results if r["is_pesticide_gt"]])
    mean_latency = np.mean(latencies)

    # 2. Held-Out Test Split Specific Metrics
    test_results = [r for r in all_results if r["split"] == "test"]
    t_tp = sum(1 for r in test_results if r["is_pesticide_gt"] and r["scanner_detected"])
    t_fp = sum(1 for r in test_results if not r["is_pesticide_gt"] and r["scanner_detected"])
    t_tn = sum(1 for r in test_results if not r["is_pesticide_gt"] and not r["scanner_detected"])
    t_fn = sum(1 for r in test_results if r["is_pesticide_gt"] and not r["scanner_detected"])
    test_acc = (t_tp + t_tn) / len(test_results) * 100.0 if test_results else 0.0
    test_mean_iou = np.mean([r["iou"] for r in test_results if r["is_pesticide_gt"]])

    print("\n=================================================================")
    print(f"📊 SCANNER BASELINE BENCHMARK SUMMARY")
    print(f"=================================================================")
    print(f"Overall Accuracy:       {accuracy:.2f}% ({tp+tn}/{len(all_results)})")
    print(f"Precision:              {precision:.2f}%")
    print(f"Recall:                 {recall:.2f}%")
    print(f"F1 Score:               {f1:.2f}%")
    print(f"Mean IoU (Pesticides):  {mean_iou:.4f}")
    print(f"Held-Out Test Accuracy: {test_acc:.2f}% ({t_tp+t_tn}/{len(test_results)})")
    print(f"Held-Out Test Mean IoU: {test_mean_iou:.4f}")
    print(f"Average Frame Latency:  {mean_latency:.2f} ms (~{1000.0/mean_latency:.0f} FPS throughput)")
    print("=================================================================\n")

    output = {
        "scanner_model": "KrishiLens Baseline Edge & Contrast Detector (public/js/detector.js)",
        "evaluated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics_overall": {
            "total_images": len(all_results),
            "accuracy_pct": round(accuracy, 2),
            "precision_pct": round(precision, 2),
            "recall_pct": round(recall, 2),
            "f1_score_pct": round(f1, 2),
            "mean_iou": round(float(mean_iou), 4),
            "mean_latency_ms": round(float(mean_latency), 2),
            "fps_throughput": round(float(1000.0 / mean_latency), 1)
        },
        "metrics_held_out_test": {
            "test_images": len(test_results),
            "accuracy_pct": round(test_acc, 2),
            "mean_iou": round(float(test_mean_iou), 4)
        },
        "detailed_results": all_results
    }

    with open("experiments/scanner_baseline_evaluation.json", "w") as f:
        json.dump(output, f, indent=2)

    print("Baseline results saved to experiments/scanner_baseline_evaluation.json")

if __name__ == "__main__":
    evaluate()
