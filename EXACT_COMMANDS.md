# KrishiLens Dataset Validation & Training — Exact Commands

Copy-paste these commands exactly as shown. Change file paths only where noted.

---

## ✅ Validate Current Dataset (Already Passing)

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Validate current 33-image dataset
.venv/bin/python scripts/validate_dataset.py data/pesticide_pilot_dataset
```

**Expected output:**
```
✅ VALIDATION PASSED - Dataset is ready for training
```

---

## After Collecting & Annotating New Images

### Step 1: Validate Annotated Images

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# CHANGE THIS: Replace 'batch_001_2026-10-25' with your batch name
BATCH_NAME="batch_001_2026-10-25"

# Validate annotations
.venv/bin/python scripts/validate_dataset.py data/incoming/$BATCH_NAME
```

**Expected output:**
```
✅ VALIDATION PASSED - Dataset is ready for merging
```

**If validation fails:** Fix annotation issues and re-run until passing.

---

### Step 2: Move to Reviewed Folder

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# CHANGE THIS: Replace 'batch_001_2026-10-25' with your batch name
BATCH_NAME="batch_001_2026-10-25"

# Move all files from incoming to reviewed
mv data/incoming/$BATCH_NAME/* data/reviewed/
```

---

### Step 3: Merge Datasets

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Merge current dataset with new annotated images
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged \
  --new-source "batch_001_pesticides_2026-10-25" \
  --new-license "CC-BY-4.0"
```

**Expected output:**
```
✅ Merged dataset saved to: data/pesticide_merged
✅ Ready for training with: data.yaml at data/pesticide_merged/data.yaml
```

---

### Step 4: Validate Merged Dataset

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# CRITICAL: Validate merged dataset before training
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged
```

**Expected output:**
```
✅ VALIDATION PASSED - Dataset is ready for training
```

**If validation fails:** Do NOT proceed to training. Fix errors and retry.

---

### Step 5: Train New Model

**ONLY run this if Step 4 validation PASSED ✅**

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Train YOLOv8n with merged dataset
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60 \
  --model yolov8n \
  --imgsz 640 \
  --batch 16 \
  --patience 10
```

**This command:**
- Loads `data.yaml` from merged dataset
- Trains for 60 epochs
- Uses YOLOv8 nano model (lightweight, fast)
- 640×640 image resolution
- Batch size 16
- Early stopping with patience 10

**Training output location:** `experiments/detection/improved_v1_baseline/`

**Expected output:**
```
Training on YOLO format dataset
Epoch 1/60: loss=... | val_loss=...
...
Epoch 60/60: loss=... | val_loss=...
✅ Training complete. Best model saved.
```

**Training time:** ~3-4 hours on Apple Silicon

---

### Step 6: Evaluate New Model

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Evaluate on test set
.venv/bin/python experiments/yolo_evaluate.py \
  --split test \
  --checkpoint experiments/detection/improved_v1_baseline/weights/best.pt
```

**Current baseline metrics (need to beat):**
```
mAP@50: 99.50% (misleading)
mAP@50-95: 59.70% ← PRIMARY METRIC (target: >65%)
Overfitting ratio: 1.67× ← CRITICAL (target: <1.3×)
False positives: 6 on non-pesticide image
```

**Expected output if improved:**
```
✅ mAP@50-95: 72.3% (improved from 59.7%)
✅ Overfitting ratio: 1.15× (improved from 1.67×)
✅ False positives: 2 on test set (improved from 6)
```

---

### Step 7: Compare Against Baseline (Optional)

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Compare all model checkpoints
.venv/bin/python experiments/yolo_evaluate.py \
  --all \
  --split test
```

**Output shows:**
- Current best.pt (baseline)
- New improved_v1_baseline/best.pt (new model)
- Side-by-side comparison

---

### Step 8: Deploy New Model (Only If Metrics Improved)

**ONLY run if Step 6 shows:**
- ✅ mAP@50-95 > 65%
- ✅ Overfitting ratio < 1.3×
- ✅ False positive rate < 5%

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Backup current model
cp experiments/detection/weights/best.pt \
   experiments/detection/weights/best.pt.backup_2026-10-25

# Deploy new model
cp experiments/detection/improved_v1_baseline/weights/best.pt \
   experiments/detection/weights/best.pt

# Restart YOLO server
pkill -f yoloServer.py
sleep 2
.venv/bin/python src/services/yoloServer.py &

# Wait for server startup
sleep 5

# Test inference
.venv/bin/python test_e2e_yolo.py
```

**Expected output:**
```
✅ Model loads: experiments/detection/weights/best.pt (6.3 MB)
✅ Inference: ~113ms per image
✅ Predictions: Real confidence scores, no fabrication
✅ All tests PASS
```

---

## If You Need To Revert

```bash
cd /Users/shlokjoshi/Desktop/KrishiLens

# Restore previous model
cp experiments/detection/weights/best.pt.backup_2026-10-25 \
   experiments/detection/weights/best.pt

# Restart server
pkill -f yoloServer.py
sleep 2
.venv/bin/python src/services/yoloServer.py &

echo "✅ Reverted to previous model"
```

---

## Complete One-Shot Workflow

**If you've already annotated and validated images:**

```bash
#!/bin/bash
cd /Users/shlokjoshi/Desktop/KrishiLens

BATCH_NAME="batch_001_2026-10-25"

echo "Step 1: Moving files..."
mv data/incoming/$BATCH_NAME/* data/reviewed/

echo "Step 2: Merging datasets..."
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged \
  --new-source "$BATCH_NAME" \
  --new-license "CC-BY-4.0"

echo "Step 3: Validating merged dataset..."
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged
if [ $? -ne 0 ]; then 
  echo "❌ Validation failed. Fix errors and retry."
  exit 1
fi

echo "Step 4: Training model..."
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60

echo "Step 5: Evaluating..."
.venv/bin/python experiments/yolo_evaluate.py --split test

echo "✅ Complete! Check metrics above."
echo "If metrics improved, run deployment step."
```

---

## Common Edits

### Change Batch Name
Replace every occurrence of:
```bash
BATCH_NAME="batch_001_2026-10-25"
```
with your batch folder name, e.g.:
```bash
BATCH_NAME="pesticides_from_market_2026-10-26"
```

### Change Training Epochs
In training command, change:
```bash
--epochs 60
```
to your preferred number, e.g.:
```bash
--epochs 100
```

### Change Model Size
In training command, change:
```bash
--model yolov8n
```
to:
- `yolov8s` (small, slower but more accurate)
- `yolov8m` (medium, requires more GPU)

### Change Image Resolution
In training command, change:
```bash
--imgsz 640
```
to:
- `512` (smaller, faster training)
- `768` (larger, better accuracy)

### Change Batch Size (If GPU Out of Memory)
In training command, change:
```bash
--batch 16
```
to:
- `8` (smaller batch, less memory)
- `4` (smallest, minimum memory)

---

## Checking Status Without Running

```bash
# Check if scripts exist
ls -la scripts/validate_dataset.py scripts/merge_datasets.py

# Check current dataset
ls -la data/pesticide_pilot_dataset/images/{train,val,test} | wc -l

# Check merged dataset (if it exists)
ls -la data/pesticide_merged/images/{train,val,test} | wc -l

# Check model checkpoint
ls -lh experiments/detection/weights/best.pt

# Check Python environment
.venv/bin/python --version
.venv/bin/python -c "from ultralytics import YOLO; print('✓ YOLO installed')"
```

---

## Quick Diagnostic

```bash
# Run this if something fails

cd /Users/shlokjoshi/Desktop/KrishiLens

echo "=== System Check ==="
.venv/bin/python --version
.venv/bin/python -c "import torch; print(f'PyTorch: {torch.__version__}')"
.venv/bin/python -c "from ultralytics import YOLO; print('✓ YOLO OK')"
.venv/bin/python -c "from PIL import Image; print('✓ Pillow OK')"

echo -e "\n=== Dataset Check ==="
echo "Current dataset:"
find data/pesticide_pilot_dataset/images -type f | wc -l
find data/pesticide_pilot_dataset/labels -type f | wc -l

echo -e "\n=== Scripts Check ==="
ls -la scripts/validate_dataset.py
ls -la scripts/merge_datasets.py
ls -la experiments/yolo_train_improved.py
ls -la experiments/yolo_evaluate.py

echo -e "\n=== Model Check ==="
ls -lh experiments/detection/weights/best.pt
```

---

## Support

**If validation fails:**
1. Check error message carefully
2. Re-run validation with more verbose output
3. See "Troubleshooting" in [DATASET_WORKFLOW.md](DATASET_WORKFLOW.md)

**If training fails:**
1. Ensure validation passed first
2. Check GPU memory (reduce batch size if needed)
3. Check that data.yaml path is correct

**If evaluation shows no improvement:**
1. Increase image diversity (more pesticide types)
2. Collect more images (target: 200-500)
3. Try `--epochs 100` for longer training

