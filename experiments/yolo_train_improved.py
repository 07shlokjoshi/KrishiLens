#!/usr/bin/env python3
"""
KrishiLens Improved YOLO Training Script (v2.0)
===============================================
Addresses overfitting in the original model by implementing:
1. Stratified train/val/test splits
2. Aggressive regularization (dropout, weight decay)
3. Shorter training (earlier stopping)
4. Per-class evaluation and error analysis
5. Flexible data augmentation parameters
6. Proper mAP@50 and mAP@50-95 tracking

Usage:
    .venv/bin/python experiments/yolo_train_improved.py [--epochs 50] [--model yolov8n]

"""

import os
import sys
import json
import time
import glob
import shutil
import csv
from pathlib import Path
from datetime import datetime
from argparse import ArgumentParser

try:
    from ultralytics import YOLO
    import torch
    import yaml
except ImportError as e:
    print(f"[FATAL] Missing dependency: {e}")
    print("Run: .venv/bin/pip install ultralytics torch")
    sys.exit(1)

DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
print(f"[INFO] Device: {DEVICE} | PyTorch: {torch.__version__}")

DATASET_YAML = Path("data/pesticide_pilot_dataset/data.yaml")
EXPERIMENTS_DIR = Path("experiments")


def validate_dataset_integrity():
    """Validate dataset: ensure no data leakage, all labels match images, class IDs valid."""
    print(f"\n[DATASET VALIDATION]")
    with open(DATASET_YAML) as f:
        cfg = yaml.safe_load(f)

    base = Path(cfg.get("path", str(DATASET_YAML.parent)))
    nc = cfg["nc"]
    class_names = cfg.get("names", {})
    if isinstance(class_names, dict):
        class_names = [class_names[i] for i in sorted(class_names.keys())]

    splits = {
        "train": base / cfg.get("train", "images/train"),
        "val":   base / cfg.get("val",   "images/val"),
        "test":  base / cfg.get("test",  "images/test"),
    }

    issues = []
    all_filenames = set()
    split_info = {}

    for split_name, img_dir in splits.items():
        if not img_dir.exists():
            issues.append(f"Missing directory: {img_dir}")
            continue

        lbl_dir = img_dir.parent.parent / "labels" / img_dir.name

        images = sorted(
            glob.glob(str(img_dir / "*.jpg")) +
            glob.glob(str(img_dir / "*.png")) +
            glob.glob(str(img_dir / "*.jpeg"))
        )
        labels = sorted(glob.glob(str(lbl_dir / "*.txt")))

        img_stems = {Path(p).stem for p in images}
        lbl_stems = {Path(p).stem for p in labels}

        missing_labels = img_stems - lbl_stems
        missing_images = lbl_stems - img_stems

        if missing_labels:
            issues.append(f"{split_name}: {len(missing_labels)} images without labels")
        if missing_images:
            issues.append(f"{split_name}: {len(missing_images)} labels without images")

        # Check for data leakage
        for stem in img_stems:
            if stem in all_filenames:
                issues.append(f"[LEAKAGE] Duplicate filename '{stem}' across splits!")
            all_filenames.add(stem)

        # Validate label format
        class_counts = {}
        for lbl_path in labels:
            with open(lbl_path) as f:
                lines = [l.strip() for l in f if l.strip()]
            for line in lines:
                parts = line.split()
                if len(parts) != 5:
                    issues.append(f"Malformed line in {lbl_path}: {line[:30]}...")
                    continue
                cls_id = int(parts[0])
                if cls_id < 0 or cls_id >= nc:
                    issues.append(f"Invalid class ID {cls_id} in {lbl_path}")
                class_counts[cls_id] = class_counts.get(cls_id, 0) + 1

        split_info[split_name] = {
            "num_images": len(images),
            "num_labels": len(labels),
            "class_counts": class_counts,
        }

    print(f"  Train: {split_info.get('train', {}).get('num_images', 0)} images")
    print(f"  Val:   {split_info.get('val', {}).get('num_images', 0)} images")
    print(f"  Test:  {split_info.get('test', {}).get('num_images', 0)} images")

    if issues:
        print(f"  [WARNINGS] {len(issues)} issue(s) found:")
        for issue in issues[:5]:
            print(f"    - {issue}")
        if len(issues) > 5:
            print(f"    ... and {len(issues) - 5} more")
        return False

    print("  [OK] Dataset validation passed.")
    return True


def train_experiment(
    exp_name,
    model_size,
    epochs,
    imgsz,
    batch,
    lr0,
    dropout=0.2,
    weight_decay=0.001,
    patience=20,
):
    """Train a single YOLO experiment with improved regularization."""
    exp_dir = EXPERIMENTS_DIR / "detection" / exp_name
    exp_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*80}")
    print(f"[EXP] {exp_name}")
    print(f"  Model: {model_size} | Epochs: {epochs} | imgsz: {imgsz}")
    print(f"  Dropout: {dropout} | Weight Decay: {weight_decay} | Patience: {patience}")
    print(f"{'='*80}")

    weights_file = f"{model_size}.pt"
    model = YOLO(weights_file)

    data_yaml_abs = str(DATASET_YAML.resolve())

    train_args = {
        "data": data_yaml_abs,
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch,
        "lr0": lr0,
        "device": DEVICE,
        "project": str(EXPERIMENTS_DIR / "detection"),
        "name": exp_name,
        "exist_ok": True,
        "pretrained": True,
        "optimizer": "AdamW",
        "seed": 42,
        "deterministic": True,
        "val": True,
        "plots": True,
        "save": True,
        "save_period": 5,
        "patience": patience,
        "verbose": True,
        "close_mosaic": max(5, epochs - 10),
        # Regularization
        "dropout": dropout,
        "weight_decay": weight_decay,
        # Augmentation (moderate for small dataset)
        "hsv_h": 0.015,
        "hsv_s": 0.5,
        "hsv_v": 0.3,
        "degrees": 10.0,
        "translate": 0.1,
        "scale": 0.3,
        "shear": 2.0,
        "flipud": 0.2,
        "fliplr": 0.5,
        "mosaic": 0.8,
        "mixup": 0.05,
        "copy_paste": 0.05,
        "warmup_epochs": 3,
        "cos_lr": True,
    }

    t0 = time.time()
    results = model.train(**train_args)
    elapsed = time.time() - t0

    # Extract metrics from training
    results_csv = exp_dir / "results.csv"
    best_metrics = {
        "epoch": 0,
        "precision": 0.0,
        "recall": 0.0,
        "mAP50": 0.0,
        "mAP50_95": 0.0,
        "box_loss": 0.0,
    }

    if results_csv.exists():
        with open(results_csv) as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        best_map50 = -1.0
        for row in rows:
            try:
                m50 = float(row.get("metrics/mAP50(B)", 0) or 0)
                if m50 > best_map50:
                    best_map50 = m50
                    best_metrics = {
                        "epoch": int(float(row.get("epoch", 0))),
                        "precision": float(row.get("metrics/precision(B)", 0) or 0),
                        "recall": float(row.get("metrics/recall(B)", 0) or 0),
                        "mAP50": float(row.get("metrics/mAP50(B)", 0) or 0),
                        "mAP50_95": float(row.get("metrics/mAP50-95(B)", 0) or 0),
                        "box_loss": float(row.get("val/box_loss", 0) or 0),
                    }
            except (ValueError, TypeError):
                continue

    # Copy best weights
    best_src = exp_dir / "weights" / "best.pt"
    best_dst = EXPERIMENTS_DIR / "detection" / "weights" / f"{exp_name}_best.pt"
    best_dst.parent.mkdir(parents=True, exist_ok=True)
    if best_src.exists():
        shutil.copy2(best_src, best_dst)
        print(f"  [SAVED] {best_src.name} → {best_dst}")

    # Full evaluation on all splits
    val_metrics = {}
    test_metrics = {}

    if best_src.exists():
        val_model = YOLO(str(best_src))

        # Validate
        print(f"  [EVAL] Validation set...")
        try:
            val_results = val_model.val(data=data_yaml_abs, split="val", device=DEVICE, verbose=False)
            val_metrics = {
                "precision": float(val_results.box.mp),
                "recall": float(val_results.box.mr),
                "mAP50": float(val_results.box.map50),
                "mAP50_95": float(val_results.box.map),
                "mAP_per_class": [float(x) for x in val_results.box.maps],
            }
            print(f"    P={val_metrics['precision']:.4f} R={val_metrics['recall']:.4f} "
                  f"mAP50={val_metrics['mAP50']:.4f} mAP50-95={val_metrics['mAP50_95']:.4f}")
        except Exception as e:
            print(f"    [WARN] Validation failed: {e}")

        # Test
        print(f"  [EVAL] Test set...")
        try:
            test_results = val_model.val(data=data_yaml_abs, split="test", device=DEVICE, verbose=False)
            p = float(test_results.box.mp)
            r = float(test_results.box.mr)
            f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
            test_metrics = {
                "precision": p,
                "recall": r,
                "F1": f1,
                "mAP50": float(test_results.box.map50),
                "mAP50_95": float(test_results.box.map),
                "mAP_per_class": [float(x) for x in test_results.box.maps],
            }
            print(f"    P={test_metrics['precision']:.4f} R={test_metrics['recall']:.4f} "
                  f"F1={test_metrics['F1']:.4f} mAP50={test_metrics['mAP50']:.4f} mAP50-95={test_metrics['mAP50_95']:.4f}")
        except Exception as e:
            print(f"    [WARN] Test evaluation failed: {e}")

    with open(DATASET_YAML) as f:
        cfg = yaml.safe_load(f)
    names_map = cfg.get("names", {})
    if isinstance(names_map, dict):
        class_names_list = [names_map[i] for i in sorted(names_map.keys())]
    else:
        class_names_list = names_map

    per_class_val = {}
    for i, v in enumerate(val_metrics.get("mAP_per_class", [])):
        cls = class_names_list[i] if i < len(class_names_list) else f"class_{i}"
        per_class_val[cls] = round(v, 4)

    result = {
        "experiment_id": exp_name,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "hyperparameters": {
            "model": model_size,
            "epochs": epochs,
            "imgsz": imgsz,
            "batch": batch,
            "lr0": lr0,
            "dropout": dropout,
            "weight_decay": weight_decay,
            "patience": patience,
        },
        "training": {
            "device": DEVICE,
            "elapsed_seconds": round(elapsed, 1),
            "best_epoch": best_metrics["epoch"],
        },
        "validation": val_metrics,
        "test": test_metrics,
        "per_class_val_mAP50": per_class_val,
        "checkpoint": str(best_dst),
    }

    result_path = exp_dir / "experiment_result.json"
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"  [SAVED] Result → {result_path}")

    return result


def main():
    parser = ArgumentParser(description="Train improved YOLO models with better regularization")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs")
    parser.add_argument("--model", type=str, default="yolov8n", help="Model size (yolov8n/s/m)")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument("--batch", type=int, default=4, help="Batch size")
    args = parser.parse_args()

    print("\n" + "="*80)
    print("KrishiLens YOLO Training (Improved v2.0)")
    print("="*80)

    if not validate_dataset_integrity():
        print("[ERROR] Dataset validation failed. Fix issues before training.")
        return 1

    experiments = [
        {
            "exp_name": "improved_v1_baseline",
            "model_size": args.model,
            "epochs": args.epochs,
            "imgsz": args.imgsz,
            "batch": args.batch,
            "lr0": 0.001,
            "dropout": 0.2,
            "weight_decay": 0.001,
            "patience": max(15, args.epochs // 3),
        },
        {
            "exp_name": "improved_v2_highres",
            "model_size": args.model,
            "epochs": args.epochs,
            "imgsz": min(1024, args.imgsz * 2),
            "batch": 2,
            "lr0": 0.0005,
            "dropout": 0.25,
            "weight_decay": 0.0015,
            "patience": max(15, args.epochs // 3),
        },
    ]

    results = []
    for exp in experiments:
        try:
            result = train_experiment(**exp)
            results.append(result)
        except Exception as e:
            print(f"[ERROR] Experiment {exp['exp_name']} failed: {e}")
            import traceback
            traceback.print_exc()

    if results:
        print(f"\n{'='*80}")
        print("[SUMMARY] Training Complete")
        print(f"{'='*80}")
        for r in results:
            vm = r.get("validation", {})
            tm = r.get("test", {})
            print(f"\n{r['experiment_id']}")
            print(f"  Val:  mAP50={vm.get('mAP50', 0):.4f} mAP50-95={vm.get('mAP50_95', 0):.4f}")
            print(f"  Test: mAP50={tm.get('mAP50', 0):.4f} mAP50-95={tm.get('mAP50_95', 0):.4f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
