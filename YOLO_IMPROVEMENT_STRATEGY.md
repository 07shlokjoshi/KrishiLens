# KrishiLens YOLO Model — Improvement Strategy & Implementation Guide

**Last Updated:** 2026-10-25  
**Status:** Ready for implementation  
**Priority:** CRITICAL — Current model overfits severely

---

## Current Baseline Performance

### Test Set Metrics (exp3_yolov8n_hires)
```
Precision:      72.53%
Recall:         100.00%
F1-score:       84.08%
mAP@50:         99.50%
mAP@50-95:      59.70%
Overfitting:    HIGH (ratio 1.67)
```

### Error Analysis
- **True Positives:** 1/2 test images correctly detected all objects
- **False Positives:** 1 (model hallucinated 6 detections on control image)
- **False Negatives:** 0 (no missed detections)

**Diagnosis:** Model has memorized the ~7 unique training source images and performs well on exact duplicates but fails on novel images (false positives on non-pesticide control).

---

## The Overfitting Problem Explained

### Metric Gap Analysis

| Metric | Meaning | Current | Healthy Range |
|--------|---------|---------|---|
| **mAP@50** | "Loose" IoU threshold (boxes just need 50% overlap) | 0.9950 | — |
| **mAP@50-95** | "Strict" IoU thresholds (50-95% overlap required) | 0.5970 | — |
| **Ratio** | How much performance degrades under strict grading | 1.67× | <1.2× |

**What This Means:**
- Model is great at rough box placement (50% overlap) → 99.5% mAP
- But struggles with precise placement (strict 90%+ overlap) → 59.7% mAP
- Gap of 1.67× indicates the model:
  - Has learned specific pixel patterns from training images
  - Doesn't generalize the concept of "pesticide package" or "label"
  - Will fail on real-world images it hasn't seen

### Why 33 Images Isn't Enough

```
Typical object detection needs:
├── Small dataset (not recommended): 100-500 images
├── Medium dataset (acceptable):      500-2,000 images
├── Large dataset (recommended):      2,000-10,000 images
├── Production dataset (ideal):       10,000+ images
└── Our dataset: 33 images total
    └── With ~7 unique sources
        └── Rest are augmentations of the same samples
```

**Solution:** Need 500+ real, diverse pesticide images minimum.

---

## Data Strategy: Immediate Actions (Week 1)

### Step 1: Find Real Pesticide Image Datasets

**Search Locations:**
1. **Roboflow** (roboflow.com/search)
   - Search: "pesticide detection", "label detection", "package detection"
   - Filter by license: CC-BY-4.0 or MIT
   - Expected: 100-500 images per dataset

2. **Kaggle** (kaggle.com/datasets)
   - Search: "pesticide", "chemical detection", "bottle detection"
   - Look for YOLO or COCO format annotations
   - Check license: "Open License" or "CC" variants

3. **GitHub** (github.com)
   - Search: "pesticide detection dataset" + "github"
   - Look for papers with supplementary datasets
   - Check if annotations are available

4. **Academic Papers** (arxiv.org)
   - Search: "pesticide label detection", "agricultural packaging"
   - Check "Supplementary Materials" or GitHub links
   - Verify dataset size and annotation quality

**Evaluation Criteria for Each Dataset:**
```json
{
  "name": "dataset_name",
  "num_images": 500,
  "has_bounding_boxes": true,
  "annotation_format": "YOLO or COCO",
  "class_coverage": ["bottles", "labels", "text"],
  "image_diversity": {
    "lighting_conditions": ["indoor", "outdoor", "low_light"],
    "angles": ["frontal", "45_degrees", "profile"],
    "backgrounds": ["white", "natural", "clutter"],
    "pesticide_types": ["insecticides", "fungicides", "herbicides"]
  },
  "license": "CC-BY-4.0 or MIT",
  "source_url": "https://...",
  "notes": ""
}
```

### Step 2: Download & Validate Candidate Datasets

For each promising dataset:
```bash
# Download
cd /tmp && git clone <dataset_url> || wget <dataset_zip>

# Validate structure
ls -la pesticide_dataset/
  ├── images/
  │   ├── train/ (*.jpg, *.png)
  │   ├── val/
  │   └── test/
  └── labels/
      ├── train/ (*.txt — YOLO format)
      ├── val/
      └── test/

# Count images and check annotations
find pesticide_dataset/images -type f | wc -l
find pesticide_dataset/labels -type f | wc -l
head pesticide_dataset/labels/train/*.txt
```

**What to Check:**
- ✓ Image and label counts match (1:1 pairing)
- ✓ No empty label files (images must have annotations)
- ✓ Label format is YOLO (class_id cx cy w h on each line)
- ✓ Class IDs are 0-indexed and valid
- ✓ Normalized coordinates (0.0 to 1.0)
- ✓ At least 50 images total (preferably 500+)

### Step 3: Merge Compatible Datasets

```python
# Pseudo-code (see merge_datasets.py for full implementation)

# Define class mapping
existing_classes = [
    "pesticide_package",
    "cibrc_label",
    "toxicity_triangle",
    "cibrc_reg_stamp"
]

new_dataset_classes = [
    "bottle_body",  # → remap to pesticide_package (0)
    "label_area",   # → remap to cibrc_label (1)
    "warning_symbol"  # → remap to toxicity_triangle (2)
]

mapping = {0: 0, 1: 1, 2: 2}  # new_class_id → existing_class_id

# Copy images and relabel
for image_file in new_dataset/images/:
    copy to data/pesticide_pilot_dataset/images/train_merged/
    
for label_file in new_dataset/labels/:
    remap class IDs using mapping
    save to data/pesticide_pilot_dataset/labels/train_merged/

# Ensure no data leakage
assert no_duplicate_filenames_across_splits()
assert train_files ∩ val_files = ∅
assert val_files ∩ test_files = ∅
```

---

## Training Strategy: Retraining Models (Week 2)

### Improved Training Script Available

```bash
# Train with better regularization and early stopping
.venv/bin/python experiments/yolo_train_improved.py \
    --epochs 50 \
    --model yolov8n \
    --imgsz 640 \
    --batch 8

# OR with custom parameters
.venv/bin/python experiments/yolo_train_improved.py \
    --epochs 100 \
    --model yolov8m \
    --imgsz 768 \
    --batch 4
```

### Expected Results After Retraining with Better Data

With 500+ diverse pesticide images, expect:
```
Before (33 images, overfitted):
├── mAP@50:     0.9950 (misleading)
├── mAP@50-95:  0.5970 (true performance)
├── Ratio:      1.67× (HIGH overfitting)
└── False Positives: Many on novel images

After (500+ images, well-trained):
├── mAP@50:     ~0.70-0.80 (realistic)
├── mAP@50-95:  ~0.60-0.75 (similar, not degraded)
├── Ratio:      ~1.1× (LOW overfitting)
└── False Positives: Reduced, better generalization
```

### Key Training Parameters

**Regularization (to prevent overfitting):**
```python
dropout: 0.2-0.3           # Drop 20-30% of neurons during training
weight_decay: 0.001-0.002  # L2 regularization
patience: 15-20 epochs     # Early stopping if val doesn't improve
```

**Data Augmentation (for diversity without overfitting):**
```python
hsv_h: 0.015     # Hue: minimal color shift
hsv_s: 0.5       # Saturation: moderate
hsv_v: 0.3       # Value/brightness
degrees: 10      # Rotation: up to 10°
translate: 0.1   # Shift: up to 10% of image
scale: 0.3       # Scale: ±30%
mixup: 0.05      # Mix 2 images together occasionally
```

**Model Selection:**
- `yolov8n` (nano): Smallest, fastest, good for edge devices
- `yolov8s` (small): Balanced, good for mobile
- `yolov8m` (medium): Better accuracy, slower
- → **Recommended: yolov8n for pesticide labels** (small objects)

---

## Evaluation Strategy: Test All Experiments on Same Test Set

```bash
# Evaluate single checkpoint
.venv/bin/python experiments/yolo_evaluate.py \
    --checkpoint experiments/detection/weights/best.pt \
    --split test

# Evaluate all experiments
.venv/bin/python experiments/yolo_evaluate.py --all --split test

# Output includes:
# ├── mAP@50 & mAP@50-95 metrics
# ├── Overfitting ratio & indicator
# ├── Per-class performance breakdown
# ├── Per-image error analysis (TP/FP/FN)
# └── JSON report for comparison
```

**Key Evaluation Rules:**
- ✓ Always compare on **same held-out test set**
- ✓ Compare **both** mAP@50 and mAP@50-95 (not just one)
- ✓ Look for closing gap between metrics (sign of good generalization)
- ✓ Check per-class metrics (may vary significantly)
- ✓ Analyze false positives/negatives per image

---

## Production Integration: Switching Model Checkpoints

### How to Use a Different Checkpoint

#### Option A: Copy New Checkpoint to Production

```bash
# After retraining, copy best checkpoint
cp experiments/detection/improved_v1/weights/best.pt \
   experiments/detection/weights/best.pt

# YOLO server automatically loads: experiments/detection/weights/best.pt
# Restart the server:
pkill -f yoloServer.py
.venv/bin/python src/services/yoloServer.py
```

#### Option B: Use Custom Checkpoint Path

```bash
# Set environment variable
export YOLO_CHECKPOINT=/path/to/your/best.pt

# Start server with custom checkpoint
.venv/bin/python src/services/yoloServer.py
```

#### Option C: Update Server Code

In `src/services/yoloServer.py` line 39-42:
```python
CHECKPOINT = os.environ.get(
    "YOLO_CHECKPOINT",
    "experiments/detection/weights/best.pt"  # ← Change this path
)
```

### Verify Checkpoint Loaded Correctly

```bash
# Check server health
curl http://localhost:5001/health | jq '.checkpoint'

# Check model info & metrics
curl http://localhost:5001/model-info | jq '.manifest'
```

---

## Complete Workflow: Step-by-Step

### Week 1: Dataset Research & Curation

```bash
# 1. Research datasets (manual, ~2-3 hours)
#    → Document 3-5 promising sources
#    → Verify licenses & download samples

# 2. Validate dataset quality
./scripts/validate_dataset.py <dataset_path>

# 3. Check for duplicates with existing data
./scripts/find_duplicates.py \
    data/pesticide_pilot_dataset/images \
    <new_dataset>/images

# 4. Plan class mapping
#    → How do new classes map to existing 4 classes?
#    → Document in mapping file
```

### Week 2: Data Merge & Retraining

```bash
# 5. Merge datasets
.venv/bin/python scripts/merge_datasets.py \
    --existing data/pesticide_pilot_dataset \
    --new /path/to/new/dataset \
    --output data/pesticide_merged \
    --mapping class_mapping.json

# 6. Retrain models
.venv/bin/python experiments/yolo_train_improved.py \
    --epochs 60 --model yolov8n

# 7. Evaluate on test set
.venv/bin/python experiments/yolo_evaluate.py --split test

# 8. Compare results
less experiments/detection/eval_test_*.json | jq '.metrics'
```

### Week 3: Integration & Testing

```bash
# 9. Promote best model to production
cp experiments/detection/improved_v1/weights/best.pt \
   experiments/detection/weights/best.pt

# 10. Test end-to-end
.venv/bin/python test_e2e_yolo.py

# 11. Run web app
npm start  # or npm run dev

# 12. Test in browser
#     Upload test images → Verify bounding boxes render
#     Check confidence scores → Verify they match model output
```

---

## Quick Reference: File Locations

| File | Purpose | Action |
|------|---------|--------|
| `experiments/yolo_train_improved.py` | Training script | Run for new models |
| `experiments/yolo_evaluate.py` | Evaluation script | Run after training |
| `test_e2e_yolo.py` | End-to-end test | Run before deployment |
| `experiments/detection/weights/best.pt` | Production checkpoint | Copy new models here |
| `experiments/detection/model_manifest.json` | Training metadata | Updated after training |
| `data/pesticide_pilot_dataset/data.yaml` | Dataset config | Update paths if merging |

---

## Troubleshooting

### Problem: "No improvement, model still overfits"

**Cause:** Dataset still too small or too similar.  
**Solution:**
- Get more diverse images (different brands, lighting, angles)
- Use simpler model (yolov8n instead of yolov8m)
- Use stronger regularization (dropout=0.3, weight_decay=0.002)
- Train for fewer epochs (30-40 instead of 60-80)

### Problem: "Model performance dropped after adding new data"

**Cause:** Class imbalance or misaligned class mapping.  
**Solution:**
- Check class distribution in merged dataset
- Ensure class IDs match exactly across datasets
- Verify no data leakage (duplicates across train/val/test)
- Use stratified train/val/test split

### Problem: "Bounding boxes not rendering in web app"

**Cause:** YOLO server not running or model not loaded.  
**Solution:**
```bash
# Check if server is running
curl http://localhost:5001/health

# If not, start it
.venv/bin/python src/services/yoloServer.py

# Check model info
curl http://localhost:5001/model-info | jq '.'
```

---

## Next Steps

1. **This week:** Search for real pesticide datasets (2-3 hours of research)
2. **Next week:** Download and merge 1-2 datasets (4-6 hours of prep)
3. **Week 3:** Retrain models and evaluate (2-3 hours of computation)
4. **Week 4:** Integration testing and deployment (1-2 hours)

**Expected outcome:** Production model with <1.3× overfitting ratio and better real-world accuracy.

---

**For questions or blockers:** Refer to YOLO_AUDIT_2026-10-25.md for detailed system documentation.
