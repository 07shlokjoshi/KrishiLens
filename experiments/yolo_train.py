"""
KrishiLens YOLO Pesticide Label Detector — Multi-Experiment Training Script
=============================================================================
Trains and evaluates multiple YOLOv8 model sizes on the pesticide_pilot_dataset.
Saves checkpoints, training logs, and full metrics for every experiment.

Usage:
    .venv/bin/python experiments/yolo_train.py
"""

import os
import json
import time
import glob
import shutil
import csv
from pathlib import Path
from datetime import datetime

try:
    from ultralytics import YOLO
    import torch
    import yaml
except ImportError as e:
    raise SystemExit(f"[FATAL] Missing dependency: {e}\nRun: .venv/bin/pip install ultralytics torch")

DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
print(f"[INFO] Device: {DEVICE} | PyTorch: {torch.__version__}")

DATASET_YAML = Path("data/pesticide_pilot_dataset/data.yaml")
EXPERIMENTS_DIR = Path("experiments")


def validate_dataset(data_yaml_path):
    """Validate dataset integrity: image/label pairing, class IDs, data leakage."""
    print(f"\n[DATASET AUDIT] Validating: {data_yaml_path}")
    with open(data_yaml_path) as f:
        cfg = yaml.safe_load(f)

    base = Path(cfg.get("path", str(data_yaml_path.parent)))
    nc = cfg["nc"]
    class_names = cfg["names"]
    if isinstance(class_names, dict):
        class_names = [class_names[i] for i in sorted(class_names.keys())]

    splits = {
        "train": base / cfg.get("train", "images/train"),
        "val":   base / cfg.get("val",   "images/val"),
        "test":  base / cfg.get("test",  "images/test"),
    }

    audit = {
        "nc": nc,
        "class_names": class_names,
        "splits": {},
        "issues": [],
        "data_leakage": False,
    }

    all_filenames = set()

    for split_name, img_dir in splits.items():
        if not img_dir.exists():
            audit["issues"].append(f"Missing split directory: {img_dir}")
            audit["splits"][split_name] = {"count": 0, "labeled": 0, "issues": []}
            continue

        lbl_dir = img_dir.parent.parent / "labels" / img_dir.name

        images = sorted(
            glob.glob(str(img_dir / "*.jpg")) +
            glob.glob(str(img_dir / "*.png")) +
            glob.glob(str(img_dir / "*.jpeg"))
        )
        labels = sorted(glob.glob(str(lbl_dir / "*.txt")))

        split_info = {"count": len(images), "labeled": 0, "class_counts": {}, "issues": []}

        img_stems = {Path(p).stem for p in images}
        lbl_stems = {Path(p).stem for p in labels}

        missing_labels = img_stems - lbl_stems
        missing_images = lbl_stems - img_stems
        if missing_labels:
            issue = f"Images without labels in {split_name}: {list(missing_labels)[:5]}"
            split_info["issues"].append(issue)
            audit["issues"].append(issue)
        if missing_images:
            issue = f"Labels without images in {split_name}: {list(missing_images)[:5]}"
            split_info["issues"].append(issue)
            audit["issues"].append(issue)

        for lbl_path in labels:
            with open(lbl_path) as f:
                lines = [l.strip() for l in f if l.strip()]
            for line in lines:
                parts = line.split()
                if len(parts) != 5:
                    split_info["issues"].append(f"Malformed line in {lbl_path}: {line}")
                    continue
                cls_id = int(parts[0])
                if cls_id < 0 or cls_id >= nc:
                    split_info["issues"].append(f"Invalid class ID {cls_id} in {lbl_path} (nc={nc})")
                coords = [float(x) for x in parts[1:]]
                for coord in coords:
                    if not (0.0 <= coord <= 1.0):
                        split_info["issues"].append(f"Out-of-range coord in {lbl_path}: {coord}")
                split_info["class_counts"][cls_id] = split_info["class_counts"].get(cls_id, 0) + 1
            if lines:
                split_info["labeled"] += 1

        for img_path in images:
            stem = Path(img_path).stem
            if stem in all_filenames:
                audit["issues"].append(f"DATA LEAKAGE: Duplicate filename '{stem}' across splits!")
                audit["data_leakage"] = True
            all_filenames.add(stem)

        audit["splits"][split_name] = split_info
        print(f"  [{split_name.upper()}] {len(images)} images, {split_info['labeled']} labeled | classes: {split_info['class_counts']}")

    if audit["issues"]:
        print(f"  [WARNINGS] {len(audit['issues'])} issue(s) found:")
        for issue in audit["issues"][:10]:
            print(f"    - {issue}")
    else:
        print("  [OK] Dataset validation passed.")

    if audit["data_leakage"]:
        raise RuntimeError("[FATAL] Data leakage detected between splits! Aborting.")

    return audit


def run_experiment(exp_name, model_size, epochs, imgsz, batch, lr0, augment_args):
    """Train a single YOLO experiment and return full metrics."""
    exp_dir = EXPERIMENTS_DIR / "detection" / exp_name
    exp_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*70}")
    print(f"[EXP] {exp_name}")
    print(f"  Model: {model_size} | Epochs: {epochs} | imgsz: {imgsz} | batch: {batch} | lr0: {lr0}")
    print(f"{'='*70}")

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
        "save_period": -1,
        "patience": 30,
        "verbose": True,
        "close_mosaic": 5,
    }
    train_args.update(augment_args)

    t0 = time.time()
    model.train(**train_args)
    elapsed = time.time() - t0

    # Extract best epoch from CSV
    results_csv = exp_dir / "results.csv"
    best_metrics = {"precision": 0.0, "recall": 0.0, "mAP50": 0.0, "mAP50_95": 0.0, "epoch": 0}
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
                        "val_box_loss": float(row.get("val/box_loss", 0) or 0),
                        "val_cls_loss": float(row.get("val/cls_loss", 0) or 0),
                    }
            except (ValueError, TypeError):
                continue

    # Copy best weights
    best_src = exp_dir / "weights" / "best.pt"
    best_dst = EXPERIMENTS_DIR / "detection" / "weights" / f"{exp_name}_best.pt"
    best_dst.parent.mkdir(parents=True, exist_ok=True)
    if best_src.exists():
        shutil.copy2(best_src, best_dst)
        print(f"  [SAVED] Best weights -> {best_dst}")

    # Val evaluation
    val_metrics = {}
    if best_src.exists():
        print(f"\n  [EVAL] Val set evaluation...")
        val_model = YOLO(str(best_src))
        try:
            val_results = val_model.val(data=data_yaml_abs, split="val", device=DEVICE, verbose=False)
            vp = float(val_results.box.mp)
            vr = float(val_results.box.mr)
            val_metrics = {
                "val_precision": vp,
                "val_recall": vr,
                "val_mAP50": float(val_results.box.map50),
                "val_mAP50_95": float(val_results.box.map),
                "val_map_per_class": [float(x) for x in val_results.box.maps],
            }
            print(f"  [VAL] P={vp:.4f} R={vr:.4f} mAP50={val_metrics['val_mAP50']:.4f} mAP50-95={val_metrics['val_mAP50_95']:.4f}")
        except Exception as e:
            print(f"  [WARN] Val eval failed: {e}")

    # Test evaluation
    test_metrics = {}
    if best_src.exists():
        print(f"  [EVAL] Test set evaluation...")
        try:
            test_results = val_model.val(data=data_yaml_abs, split="test", device=DEVICE, verbose=False)
            p = float(test_results.box.mp)
            r = float(test_results.box.mr)
            f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
            test_metrics = {
                "test_precision": p,
                "test_recall": r,
                "test_F1": f1,
                "test_mAP50": float(test_results.box.map50),
                "test_mAP50_95": float(test_results.box.map),
                "test_map_per_class": [float(x) for x in test_results.box.maps],
            }
            print(f"  [TEST] P={p:.4f} R={r:.4f} F1={f1:.4f} mAP50={test_metrics['test_mAP50']:.4f} mAP50-95={test_metrics['test_mAP50_95']:.4f}")
        except Exception as e:
            print(f"  [WARN] Test eval failed: {e}")

    # Per-class breakdown
    with open(DATASET_YAML) as f:
        cfg = yaml.safe_load(f)
    names_map = cfg.get("names", {})
    if isinstance(names_map, dict):
        class_names_list = [names_map[i] for i in sorted(names_map.keys())]
    else:
        class_names_list = names_map

    per_class_val = {}
    for i, v in enumerate(val_metrics.get("val_map_per_class", [])):
        cls = class_names_list[i] if i < len(class_names_list) else f"class_{i}"
        per_class_val[cls] = round(v, 4)

    vp2 = val_metrics.get("val_precision", 0)
    vr2 = val_metrics.get("val_recall", 0)
    f1_val = round(2 * vp2 * vr2 / (vp2 + vr2), 4) if (vp2 + vr2) > 0 else 0.0

    result = {
        "experiment_id": exp_name,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "config": {
            "model_weights": weights_file,
            "model_size": model_size,
            "epochs": epochs,
            "imgsz": imgsz,
            "batch": batch,
            "lr0": lr0,
            "device": DEVICE,
            "augment_args": augment_args,
        },
        "training_time_sec": round(elapsed, 1),
        "best_checkpoint": str(best_dst),
        "best_epoch_from_csv": best_metrics,
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "per_class_val_mAP50": per_class_val,
        "f1_summary": {"val": f1_val},
    }

    result_path = exp_dir / "experiment_result.json"
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"  [SAVED] Experiment result -> {result_path}")
    return result


def compare_experiments(results):
    """Compare all experiments and identify the best by val mAP@50."""
    print(f"\n{'='*70}")
    print("[COMPARISON] All Experiments vs Same Val Set")
    print(f"{'='*70}")
    print(f"{'ID':<35} {'P':>6} {'R':>6} {'F1':>6} {'mAP50':>7} {'mAP50-95':>10}")
    print(f"{'-'*35} {'-'*6} {'-'*6} {'-'*6} {'-'*7} {'-'*10}")

    best = None
    for r in results:
        vm = r.get("val_metrics", {})
        p = vm.get("val_precision", 0)
        rc = vm.get("val_recall", 0)
        f1 = r.get("f1_summary", {}).get("val", 0)
        m50 = vm.get("val_mAP50", 0)
        m5095 = vm.get("val_mAP50_95", 0)
        print(f"{r['experiment_id']:<35} {p:>6.3f} {rc:>6.3f} {f1:>6.3f} {m50:>7.4f} {m5095:>10.4f}")
        if best is None or m50 > best.get("val_metrics", {}).get("val_mAP50", 0):
            best = r

    print(f"\n[WINNER] Best model: {best['experiment_id']}")
    print(f"  Val mAP@50 = {best.get('val_metrics', {}).get('val_mAP50', 0):.4f}")
    return best


def promote_best_model(best_result):
    """Copy best checkpoint to canonical production path."""
    src = Path(best_result["best_checkpoint"])
    dst = Path("experiments/detection/weights/best.pt")
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.exists():
        shutil.copy2(src, dst)
        print(f"[PROMOTED] {src.name} -> {dst}")

    manifest = {
        "promoted_at": datetime.utcnow().isoformat() + "Z",
        "winning_experiment": best_result["experiment_id"],
        "model_config": best_result["config"],
        "val_metrics": best_result.get("val_metrics", {}),
        "test_metrics": best_result.get("test_metrics", {}),
        "per_class_val_mAP50": best_result.get("per_class_val_mAP50", {}),
        "f1_val": best_result.get("f1_summary", {}).get("val", 0),
        "production_checkpoint": str(dst),
        "class_names": ["pesticide_package", "cibrc_label", "toxicity_triangle", "cibrc_reg_stamp"],
    }
    manifest_path = Path("experiments/detection/model_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"[MANIFEST] Written -> {manifest_path}")
    return manifest


def main():
    print("\n" + "="*70)
    print("KrishiLens YOLO Pesticide Label Detector — Training Suite")
    print("="*70)

    audit = validate_dataset(DATASET_YAML)
    if audit["data_leakage"]:
        raise SystemExit("[FATAL] Data leakage — aborting.")

    experiments = [
        {
            "exp_name": "exp1_yolov8n_augmented",
            "model_size": "yolov8n",
            "epochs": 100,
            "imgsz": 640,
            "batch": 8,
            "lr0": 0.001,
            "augment_args": {
                "hsv_h": 0.02, "hsv_s": 0.7, "hsv_v": 0.4,
                "degrees": 15.0, "translate": 0.15, "scale": 0.5, "shear": 5.0,
                "flipud": 0.3, "fliplr": 0.5, "mosaic": 1.0, "mixup": 0.0,
                "copy_paste": 0.1, "dropout": 0.1, "weight_decay": 0.0005,
                "warmup_epochs": 5, "cos_lr": True,
            },
        },
        {
            "exp_name": "exp2_yolov8s_augmented",
            "model_size": "yolov8s",
            "epochs": 80,
            "imgsz": 640,
            "batch": 4,
            "lr0": 0.0005,
            "augment_args": {
                "hsv_h": 0.02, "hsv_s": 0.7, "hsv_v": 0.4,
                "degrees": 15.0, "translate": 0.15, "scale": 0.5, "shear": 5.0,
                "flipud": 0.3, "fliplr": 0.5, "mosaic": 1.0, "mixup": 0.0,
                "copy_paste": 0.1, "dropout": 0.2, "weight_decay": 0.001,
                "warmup_epochs": 5, "cos_lr": True,
            },
        },
        {
            "exp_name": "exp3_yolov8n_hires",
            "model_size": "yolov8n",
            "epochs": 80,
            "imgsz": 1024,
            "batch": 4,
            "lr0": 0.001,
            "augment_args": {
                "hsv_h": 0.015, "hsv_s": 0.7, "hsv_v": 0.4,
                "degrees": 10.0, "translate": 0.1, "scale": 0.4, "shear": 3.0,
                "flipud": 0.2, "fliplr": 0.5, "mosaic": 0.8, "mixup": 0.0,
                "dropout": 0.1, "weight_decay": 0.0005,
                "warmup_epochs": 5, "cos_lr": True,
            },
        },
    ]

    all_results = []
    for exp in experiments:
        exp_name = exp.pop("exp_name")
        try:
            result = run_experiment(exp_name=exp_name, **exp)
            all_results.append(result)
        except Exception as e:
            print(f"[ERROR] Experiment {exp_name} failed: {e}")
            import traceback; traceback.print_exc()

    if not all_results:
        raise SystemExit("[FATAL] All experiments failed.")

    best = compare_experiments(all_results)
    manifest = promote_best_model(best)

    summary_path = Path("experiments/detection/experiment_comparison.json")
    with open(summary_path, "w") as f:
        json.dump({
            "run_at": datetime.utcnow().isoformat() + "Z",
            "device": DEVICE,
            "dataset_audit": audit,
            "all_experiments": all_results,
            "winner": manifest["winning_experiment"],
            "winner_val_mAP50": manifest.get("val_metrics", {}).get("val_mAP50", 0),
        }, f, indent=2)

    print(f"\n[DONE] Comparison -> {summary_path}")
    print(f"[DONE] Production model: experiments/detection/weights/best.pt")
    print(f"[DONE] Model manifest:   experiments/detection/model_manifest.json")


if __name__ == "__main__":
    main()
