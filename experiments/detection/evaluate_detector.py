import os
import json
import time
from ultralytics import YOLO
from PIL import Image

def compute_box_iou(boxA, boxB):
    """
    Computes Intersection over Union (IoU) between two boxes in normalized [xmin, ymin, width, height].
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

def load_ground_truth(lbl_path):
    """Returns list of [cls_id, xmin, ymin, width, height] normalized."""
    boxes = []
    if not os.path.exists(lbl_path):
        return boxes
    with open(lbl_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) == 5:
                cls_id = int(parts[0])
                xc, yc, w, h = map(float, parts[1:])
                boxes.append([cls_id, xc - w/2, yc - h/2, w, h])
    return boxes

def main():
    print("=================================================================")
    print("🔬 EVALUATING TRAINED PESTICIDE DETECTOR (HELD-OUT TEST SET)")
    print("=================================================================\n")

    weights_path = "experiments/detection/weights/best.pt"
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Model weights not found at {weights_path}")

    model = YOLO(weights_path)
    class_names = {
        0: "pesticide_package",
        1: "cibrc_label",
        2: "toxicity_triangle",
        3: "cibrc_reg_stamp"
    }

    test_img_dir = "data/pesticide_pilot_dataset/images/test"
    test_lbl_dir = "data/pesticide_pilot_dataset/labels/test"

    test_images = sorted(os.listdir(test_img_dir))
    results = []
    latencies = []

    for img_name in test_images:
        if not img_name.endswith((".png", ".jpg")):
            continue

        img_path = os.path.join(test_img_dir, img_name)
        base = os.path.splitext(img_name)[0]
        lbl_path = os.path.join(test_lbl_dir, base + ".txt")

        gt_boxes = load_ground_truth(lbl_path)
        is_pesticide = len(gt_boxes) > 0

        # Run inference and measure latency
        t0 = time.perf_counter()
        preds = model.predict(img_path, conf=0.25, verbose=False)[0]
        lat_ms = (time.perf_counter() - t0) * 1000.0
        latencies.append(lat_ms)

        det_boxes = []
        for box in preds.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            # xyxy normalized: box.xyxyn[0]
            x1, y1, x2, y2 = box.xyxyn[0].tolist()
            w = x2 - x1
            h = y2 - y1
            det_boxes.append({
                "class_id": cls_id,
                "class_name": class_names.get(cls_id, f"class_{cls_id}"),
                "confidence": round(conf, 4),
                "bbox_normalized": [round(x1, 4), round(y1, 4), round(w, 4), round(h, 4)]
            })

        has_detection = len(det_boxes) > 0
        correct_decision = (has_detection == is_pesticide)

        # Match IoU for cibrc_label or pesticide_package
        ious = []
        for gt in gt_boxes:
            gt_cls = gt[0]
            gt_box = gt[1:]
            for det in det_boxes:
                if det["class_id"] == gt_cls:
                    iou = compute_box_iou(det["bbox_normalized"], gt_box)
                    ious.append(iou)

        best_iou = max(ious) if ious else (1.0 if not is_pesticide and not has_detection else 0.0)

        results.append({
            "image": img_name,
            "is_pesticide_ground_truth": is_pesticide,
            "detector_found_objects": has_detection,
            "is_decision_correct": correct_decision,
            "detections": det_boxes,
            "ground_truth_box_count": len(gt_boxes),
            "max_class_iou": round(best_iou, 4),
            "latency_ms": round(lat_ms, 2)
        })

        icon = "✅" if correct_decision else "❌"
        print(f"{icon} {img_name:32s} | Detected: {len(det_boxes)} box(es) | GT: {len(gt_boxes)} | Max IoU: {best_iou:.3f} | Latency: {lat_ms:.2f}ms")
        for d in det_boxes:
            print(f"    - {d['class_name']} ({d['confidence']*100:.1f}%) box: {d['bbox_normalized']}")

    # Calculate overall metrics
    tp = sum(1 for r in results if r["is_pesticide_ground_truth"] and r["detector_found_objects"])
    fp = sum(1 for r in results if not r["is_pesticide_ground_truth"] and r["detector_found_objects"])
    tn = sum(1 for r in results if not r["is_pesticide_ground_truth"] and not r["detector_found_objects"])
    fn = sum(1 for r in results if r["is_pesticide_ground_truth"] and not r["detector_found_objects"])

    acc = (tp + tn) / len(results) * 100.0 if results else 0.0
    prec = (tp / (tp + fp)) * 100.0 if (tp + fp) > 0 else 0.0
    rec = (tp / (tp + fn)) * 100.0 if (tp + fn) > 0 else 0.0
    f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
    avg_iou = sum(r["max_class_iou"] for r in results if r["is_pesticide_ground_truth"]) / max(1, sum(1 for r in results if r["is_pesticide_ground_truth"]))
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

    print("\n=================================================================")
    print("📊 TEST SET EVALUATION SUMMARY (TRAINED YOLOv8n)")
    print("=================================================================")
    print(f"Test Accuracy:         {acc:.2f}% ({tp+tn}/{len(results)})")
    print(f"Precision:             {prec:.2f}%")
    print(f"Recall:                {rec:.2f}%")
    print(f"F1 Score:              {f1:.2f}%")
    print(f"Mean IoU on Labels:    {avg_iou:.4f} (Baseline heuristic was 0.4854)")
    print(f"Average Frame Latency: {avg_latency:.2f} ms")
    print("=================================================================\n")

    summary = {
        "model": "YOLOv8n Pesticide Label Detector",
        "weights_path": weights_path,
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": {
            "test_accuracy_pct": round(acc, 2),
            "precision_pct": round(prec, 2),
            "recall_pct": round(rec, 2),
            "f1_score_pct": round(f1, 2),
            "mean_iou_on_labels": round(avg_iou, 4),
            "mean_latency_ms": round(avg_latency, 2),
            "fps_throughput": round(1000.0 / max(1.0, avg_latency), 1)
        },
        "baseline_comparison": {
            "baseline_heuristic_accuracy_pct": 50.0,
            "trained_yolo_accuracy_pct": round(acc, 2),
            "baseline_heuristic_mean_iou": 0.4854,
            "trained_yolo_mean_iou": round(avg_iou, 4),
            "improvement_factor_iou": round(avg_iou / 0.4854, 2)
        },
        "results": results
    }

    report_path = "experiments/detection/reports/evaluation_report.json"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Report saved to {report_path}")

if __name__ == "__main__":
    main()
