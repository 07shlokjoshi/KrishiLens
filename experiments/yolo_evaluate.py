"""
KrishiLens YOLO Model Evaluation & Error Analysis (v2.0)
=========================================================
Comprehensive evaluation of trained YOLO models with:
- Per-class precision, recall, F1-score
- Confidence score distribution analysis
- False positive/negative breakdown
- Overfitting detection (mAP@50 vs mAP@50-95 ratio)

Usage:
    .venv/bin/python experiments/yolo_evaluate.py
    .venv/bin/python experiments/yolo_evaluate.py --checkpoint experiments/detection/weights/best.pt
    .venv/bin/python experiments/yolo_evaluate.py --split val --output results.json
"""

import argparse
import json
import sys
import time
import glob
from pathlib import Path
from datetime import datetime

try:
    from ultralytics import YOLO
    import torch
    import yaml
except ImportError as e:
    raise SystemExit(f"[FATAL] {e}. Run: .venv/bin/pip install ultralytics")

DATASET_YAML = Path("data/pesticide_pilot_dataset/data.yaml")
DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
CLASS_NAMES = ["pesticide_package", "cibrc_label", "toxicity_triangle", "cibrc_reg_stamp"]


def evaluate_checkpoint(checkpoint_path: str, split: str = "test") -> dict:
    """Run full evaluation of a YOLO checkpoint on a dataset split."""
    cp = Path(checkpoint_path)
    if not cp.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    print(f"\n{'='*80}")
    print(f"[EVAL] Checkpoint: {checkpoint_path}")
    print(f"[EVAL] Split:      {split}")
    print(f"[EVAL] Dataset:    {DATASET_YAML}")
    print(f"[EVAL] Device:     {DEVICE}")
    print(f"{'='*80}")

    model = YOLO(str(cp))

    # Run validation
    t0 = time.time()
    val_result = model.val(
        data=str(DATASET_YAML.resolve()),
        split=split,
        device=DEVICE,
        verbose=True,
        plots=True,
        save_json=True,
        conf=0.25,
        iou=0.45,
    )
    elapsed = time.time() - t0

    # ── Extract metrics ──
    mp  = float(val_result.box.mp)    # Mean Precision
    mr  = float(val_result.box.mr)    # Mean Recall
    m50 = float(val_result.box.map50) # mAP@50
    m95 = float(val_result.box.map)   # mAP@50-95
    f1  = 2 * mp * mr / (mp + mr) if (mp + mr) > 0 else 0.0

    maps_per_class = [float(x) for x in val_result.box.maps]

    # Overfitting detection
    ratio = m50 / max(m95, 0.001)
    overfitting = "HIGH ⚠️" if ratio > 1.5 else ("MODERATE" if ratio > 1.2 else "LOW")

    print(f"\n{'='*80}")
    print(f"  METRIC SUMMARY — {split.upper()} SET")
    print(f"{'='*80}")
    print(f"  Precision (mean):   {mp:.4f}  ({mp*100:.2f}%)")
    print(f"  Recall (mean):      {mr:.4f}  ({mr*100:.2f}%)")
    print(f"  F1 Score:           {f1:.4f}  ({f1*100:.2f}%)")
    print(f"  mAP@50:             {m50:.4f}  ({m50*100:.2f}%)")
    print(f"  mAP@50-95:          {m95:.4f}  ({m95*100:.2f}%)")
    print(f"  Ratio (mAP50/50-95): {ratio:.2f}  [Overfitting: {overfitting}]")
    print(f"{'='*80}")
    print(f"\n  PER-CLASS mAP@50:")
    for i, v in enumerate(maps_per_class):
        cls = CLASS_NAMES[i] if i < len(CLASS_NAMES) else f"class_{i}"
        bar = "█" * int(v * 20) + "░" * (20 - int(v * 20))
        print(f"    {cls:<22} {bar}  {v*100:.1f}%")
    print(f"\n  Evaluation time: {elapsed:.1f}s")

    # ── Per-image prediction analysis ──
    print(f"\n  PER-IMAGE ANALYSIS:")
    img_dir = DATASET_YAML.parent / "images" / split
    lbl_dir = DATASET_YAML.parent / "labels" / split
    images = sorted(
        glob.glob(str(img_dir / "*.jpg")) +
        glob.glob(str(img_dir / "*.png")) +
        glob.glob(str(img_dir / "*.jpeg"))
    )

    per_image_results = []
    for img_path in images:
        stem = Path(img_path).stem
        lbl_path = lbl_dir / f"{stem}.txt"

        # Ground truth
        gt_count = 0
        if lbl_path.exists():
            with open(lbl_path) as f:
                gt_lines = [l.strip() for l in f if l.strip()]
            gt_count = len(gt_lines)

        # Run prediction
        pred_result = model.predict(
            source=img_path,
            conf=0.25,
            iou=0.45,
            device=DEVICE,
            verbose=False,
        )
        preds = pred_result[0].boxes
        pred_count = len(preds) if preds is not None else 0

        det_list = []
        if preds is not None and len(preds) > 0:
            for j in range(len(preds)):
                cls_id = int(preds.cls[j].item())
                conf   = float(preds.conf[j].item())
                xywhn  = preds.xywhn[j].tolist()
                det_list.append({
                    "class_id":   cls_id,
                    "class_name": CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else f"class_{cls_id}",
                    "confidence": round(conf, 4),
                    "bbox_norm":  [round(x, 4) for x in xywhn],
                })

        # Error category
        if gt_count == 0 and pred_count == 0:
            error_type = "TRUE_NEGATIVE"
        elif gt_count > 0 and pred_count > 0:
            error_type = "TRUE_POSITIVE"
        elif gt_count > 0 and pred_count == 0:
            error_type = "FALSE_NEGATIVE"
        else:
            error_type = "FALSE_POSITIVE"

        row = {
            "image": stem,
            "gt_boxes": gt_count,
            "pred_boxes": pred_count,
            "error_type": error_type,
            "detections": det_list,
        }
        per_image_results.append(row)
        marker = {"TRUE_NEGATIVE": "✓TN", "TRUE_POSITIVE": "✓TP", "FALSE_NEGATIVE": "✗FN", "FALSE_POSITIVE": "✗FP"}[error_type]
        print(f"    [{marker}] {stem:<42} GT={gt_count} Pred={pred_count}")

    # ── Error analysis summary ──
    err_counts = {k: 0 for k in ["TRUE_POSITIVE", "TRUE_NEGATIVE", "FALSE_POSITIVE", "FALSE_NEGATIVE"]}
    for r in per_image_results:
        err_counts[r["error_type"]] += 1

    print(f"\n  ERROR ANALYSIS:")
    print(f"    True Positives:  {err_counts['TRUE_POSITIVE']}")
    print(f"    True Negatives:  {err_counts['TRUE_NEGATIVE']}")
    print(f"    False Positives: {err_counts['FALSE_POSITIVE']} ← model detects objects that don't exist")
    print(f"    False Negatives: {err_counts['FALSE_NEGATIVE']} ← model misses real objects")

    # ── Build result dict ──
    result = {
        "evaluation_timestamp": datetime.utcnow().isoformat() + "Z",
        "checkpoint": checkpoint_path,
        "split": split,
        "device": DEVICE,
        "dataset": str(DATASET_YAML),
        "num_images": len(images),
        "metrics": {
            "precision": round(mp, 6),
            "recall":    round(mr, 6),
            "f1_score":  round(f1, 6),
            "mAP50":     round(m50, 6),
            "mAP50_95":  round(m95, 6),
        },
        "overfitting_analysis": {
            "ratio_mAP50_to_mAP50-95": round(ratio, 2),
            "indicator": overfitting,
            "note": "Healthy: 1.0-1.2 | Moderate: 1.2-1.5 | High: >1.5"
        },
        "per_class_mAP50": {
            CLASS_NAMES[i] if i < len(CLASS_NAMES) else f"class_{i}": round(v, 6)
            for i, v in enumerate(maps_per_class)
        },
        "error_analysis": err_counts,
        "per_image_results": per_image_results,
        "evaluation_time_sec": round(elapsed, 2),
    }

    return result


def compare_checkpoints(checkpoints: list, split: str = "test") -> list:
    """Evaluate multiple checkpoints on the same split and print comparison table."""
    results = []
    for cp in checkpoints:
        if not Path(cp).exists():
            print(f"[SKIP] Not found: {cp}")
            continue
        r = evaluate_checkpoint(cp, split=split)
        results.append(r)

    if len(results) > 1:
        print(f"\n{'='*65}")
        print("CHECKPOINT COMPARISON TABLE")
        print(f"{'='*65}")
        print(f"{'Checkpoint':<40} {'P':>6} {'R':>6} {'F1':>6} {'mAP50':>7} {'mAP50-95':>10}")
        print(f"{'-'*40} {'-'*6} {'-'*6} {'-'*6} {'-'*7} {'-'*10}")
        for r in results:
            cp_name = Path(r["checkpoint"]).parent.parent.name
            m = r["metrics"]
            print(f"{cp_name:<40} {m['precision']:>6.3f} {m['recall']:>6.3f} {m['f1_score']:>6.3f} {m['mAP50']:>7.4f} {m['mAP50_95']:>10.4f}")

    return results


def main():
    parser = argparse.ArgumentParser(description="KrishiLens YOLO Evaluation Script")
    parser.add_argument(
        "--checkpoint", "-c",
        default="experiments/detection/weights/best.pt",
        help="Path to YOLO .pt checkpoint (default: production best.pt)"
    )
    parser.add_argument(
        "--split", "-s",
        default="test",
        choices=["train", "val", "test"],
        help="Dataset split to evaluate on (default: test)"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Evaluate all experiment checkpoints and compare"
    )
    args = parser.parse_args()

    if args.all:
        # Find all experiment best.pt files
        exp_checkpoints = sorted(glob.glob("experiments/detection/exp*/weights/best.pt"))
        exp_checkpoints.append("experiments/detection/weights/best.pt")
        print(f"[INFO] Evaluating {len(exp_checkpoints)} checkpoints on {args.split} split")
        results = compare_checkpoints(exp_checkpoints, split=args.split)
    else:
        results = [evaluate_checkpoint(args.checkpoint, split=args.split)]

    # Save results
    out_dir = Path("experiments/detection")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"eval_{args.split}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_path, "w") as f:
        json.dump(results if len(results) > 1 else results[0], f, indent=2)
    print(f"\n[SAVED] Evaluation results → {out_path}")


if __name__ == "__main__":
    main()
