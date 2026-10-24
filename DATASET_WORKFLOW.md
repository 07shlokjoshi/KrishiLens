# KrishiLens Pesticide Dataset — Collection & Annotation Workflow

**Status:** ✅ Current dataset validated (33 images)  
**Structure:** Ready for expansion with incoming pesticide images  
**Goal:** Build a diverse, pesticide-specific dataset for robust model training

---

## Quick Start Commands

```bash
# 1. Validate current dataset
.venv/bin/python scripts/validate_dataset.py data/pesticide_pilot_dataset

# 2. Annotate incoming images with LabelImg
labelImg data/incoming data/classes.txt

# 3. Validate annotations
.venv/bin/python scripts/validate_dataset.py data/reviewed

# 4. Merge datasets
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged

# 5. Train model (only if validation passes ✅)
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60
```

---

## Folder Structure

```
KrishiLens/data/
├── pesticide_pilot_dataset/        ← Current 33 images (verified)
│   ├── images/
│   │   ├── train/  (29 images)
│   │   ├── val/    (2 images)
│   │   └── test/   (2 images)
│   └── labels/
│       ├── train/  (YOLO format)
│       ├── val/
│       └── test/
│
├── incoming/                       ← NEW: Place raw images here
│   └── *.jpg                      (images awaiting annotation)
│
├── reviewed/                       ← NEW: Annotated images
│   ├── images/
│   │   ├── *.jpg                 (annotated pesticide photos)
│   │   └── *.png
│   └── labels/
│       └── *.txt                 (YOLO format annotations)
│
├── annotated/                      ← NEW: Validated & ready
│   ├── images/
│   └── labels/
│
├── external_datasets/              ← NEW: Track external sources
│   ├── dataset_1/
│   ├── dataset_2/
│   └── SOURCES.md                (document sources & licenses)
│
├── pesticide_merged/              ← OUTPUT: Merged training data
│   ├── images/
│   │   ├── train/
│   │   ├── val/
│   │   └── test/
│   ├── labels/
│   ├── data.yaml                 (configuration)
│   └── MERGE_MANIFEST.json       (source tracking)
│
├── classes.txt                     ← Class names (for LabelImg)
└── data.yaml                       ← Current dataset config
```

---

## Current Dataset Summary

**Statistics:**
- Total images: 33
- Train: 29 images
- Val: 2 images
- Test: 2 images
- Negative controls: 3 (water bottle, field tool)
- Unique pesticide sources: 1 (acetamiprid)
- Annotation status: ✅ Validated

**Class Distribution (Training Set):**
- pesticide_package (class 0): 27 instances
- cibrc_label (class 1): 27 instances
- toxicity_triangle (class 2): 27 instances
- cibrc_reg_stamp (class 3): 27 instances

**Overfitting Status:** 🔴 HIGH (needs 500+ diverse images)

---

## Step 1: Collect Pesticide Images

### Legal Image Sources

✅ **Recommended sources:**

1. **CIB&RC Public Database** (India's pest control registration authority)
   - Site: https://www.cibrc.nic.in/
   - Content: Official pesticide product images and registrations
   - License: Government database (verify usage rights)

2. **Agricultural Retailer Websites**
   - Kisan e-Market (farmer cooperatives)
   - Regional agricultural suppliers
   - Online agricultural marketplaces
   - License: Usually free for non-commercial research

3. **Pesticide Manufacturer Websites**
   - Syngenta India, Bayer CropScience, FMC India, BASF
   - ICAR (Indian Council of Agricultural Research)
   - License: May require explicit permission (check T&C)

4. **Personal Collection**
   - Photograph pesticides from your local agricultural markets
   - Permission from retailers (usually granted)
   - License: Own collection (fully permitted)

5. **Research Institutions**
   - Agricultural universities (IARI, ICAR institutes)
   - Research papers with published datasets
   - License: Varies (check paper for CC or open license)

### Collection Guidelines

**Image requirements:**
- Resolution: ≥ 640×480 pixels
- Clarity: Sharp and in-focus (not blurry)
- Lighting: Good natural or artificial lighting
- Angle: Show label clearly (front/front-oblique)
- All 4 classes visible (or legitimately absent)
- No trademark/logo conflicts (use with permission)

**Diversity targets:**
- ≥ 5 different pesticide types (not just acetamiprid)
- ≥ 5 different container types (bottle, pouch, can, carton)
- ≥ 3 different lighting conditions (bright, overcast, artificial)
- ≥ 3 different camera angles (front, 45°, top-down)
- Include at least 2-3 negative controls (non-pesticide items)

### Organize Images

```bash
# Create batch folder
mkdir -p data/incoming/batch_001_2026-10-25

# Copy images
cp /path/to/collected/images/*.jpg data/incoming/batch_001_2026-10-25/

# Track source
cat > data/incoming/batch_001_2026-10-25/SOURCE.txt << 'EOF'
Batch: batch_001_2026-10-25
Date collected: 2026-10-25
Source: CIB&RC database + local markets
License: Free for research (non-commercial)
Contact: [Your name]
Notes: Includes acetamiprid, chlorpyrifos, dimethoate
EOF
```

---

## Step 2: Annotate Images

### Install LabelImg

```bash
# Install if not already installed
pip install labelImg

# Verify installation
labelImg --version
```

### Start Annotation

```bash
# Open LabelImg with your batch
labelImg data/incoming/batch_001_2026-10-25 data/classes.txt

# Or simply:
labelImg data/incoming data/classes.txt
```

### Annotation Process

**For each image:**

1. **Click "Create RectBox"** (or Ctrl+N)
2. **Draw rectangle** around each visible class
3. **Select class** from dropdown (not class ID)
4. **Save** (Ctrl+S, saves as YOLO `.txt`)
5. **Next image** (Ctrl+Shift+N or click next)

**Key rules:**
- Draw **tight boxes** (minimal extra space)
- One box per object per class
- All 4 classes must have boxes (if visible)
- Negative controls: don't draw any boxes, save empty label
- Save after each image (Ctrl+S)

### Quality Check

```bash
# After annotating a batch, verify format
.venv/bin/python3 << 'EOF'
from pathlib import Path

batch_dir = Path("data/incoming/batch_001_2026-10-25")
errors = 0

for label_file in batch_dir.glob("*.txt"):
    if not label_file.stat().st_size > 0:  # Empty file is OK
        continue
    
    with open(label_file) as f:
        for line_num, line in enumerate(f, 1):
            parts = line.split()
            if len(parts) != 5:
                print(f"❌ {label_file.name}:{line_num} - Wrong field count")
                errors += 1
            else:
                class_id, cx, cy, w, h = int(parts[0]), *map(float, parts[1:])
                if not (0 <= class_id < 4):
                    print(f"❌ {label_file.name}:{line_num} - Invalid class {class_id}")
                    errors += 1
                if not all(0 <= v <= 1 for v in [cx, cy, w, h]):
                    print(f"❌ {label_file.name}:{line_num} - Coords out of range")
                    errors += 1

if errors == 0:
    print(f"✅ All labels valid for batch")
else:
    print(f"🔴 Found {errors} errors - fix before merging")
EOF
```

---

## Step 3: Move to Reviewed Folder

```bash
# Move annotated batch to reviewed folder
mv data/incoming/batch_001_2026-10-25/* data/reviewed/

# Verify files copied
ls data/reviewed/ | head -10
```

---

## Step 4: Validate Annotations

```bash
# Comprehensive validation
.venv/bin/python scripts/validate_dataset.py data/reviewed

# Expected output if successful:
# ✅ VALIDATION PASSED - Dataset is ready for merging
```

**If validation fails:**
1. Check error messages carefully
2. Fix annotation issues using LabelImg
3. Re-run validation until passing

---

## Step 5: Merge with Existing Dataset

```bash
# Merge reviewed images with pilot dataset
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged \
  --new-source "batch_001_pesticides_2026-10-25" \
  --new-license "CC-BY-4.0"

# This creates:
# - data/pesticide_merged/images/{train,val,test}
# - data/pesticide_merged/labels/{train,val,test}
# - data/pesticide_merged/data.yaml
# - data/pesticide_merged/MERGE_MANIFEST.json (tracks sources)
```

### What the Merge Script Does

1. **Copies images** from both datasets
2. **Preserves annotations** in YOLO format
3. **Prevents data leakage** (no overlap between train/val/test)
4. **Detects duplicates** (warns if same image in both datasets)
5. **Tracks sources** (saves MERGE_MANIFEST.json)
6. **Creates data.yaml** (ready for training)

### Source Tracking

Check merged dataset sources:

```bash
# View merge manifest
cat data/pesticide_merged/MERGE_MANIFEST.json | python -m json.tool
```

Output shows:
- Source names and URLs
- License information
- Image count per source
- Class mappings applied
- File-to-source mappings

---

## Step 6: Validate Merged Dataset

```bash
# CRITICAL: Always validate before training
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged

# Must see: ✅ VALIDATION PASSED
```

**Key checks performed:**
- ✅ All images have corresponding labels
- ✅ All labels have valid class IDs (0-3)
- ✅ All coordinates normalized [0, 1]
- ✅ No missing annotations
- ✅ No data leakage between splits
- ✅ Duplicate detection

**If validation fails:**
- Don't proceed to training
- Fix issues and re-validate
- Most common issues:
  - Wrong class IDs (0-3 are valid)
  - Coordinates out of range
  - Missing label files

---

## Step 7: Train New Model

**Only proceed if validation passes ✅**

```bash
# Train with merged dataset
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60 \
  --model yolov8n \
  --imgsz 640 \
  --batch 16

# Training output:
# - Model checkpoints in experiments/detection/
# - Training plots in runs/
# - Best model saved as best.pt
```

---

## Step 8: Evaluate New Model

```bash
# Test on held-out test set
.venv/bin/python experiments/yolo_evaluate.py \
  --split test \
  --checkpoint experiments/detection/weights/best.pt

# Expected metrics:
# - mAP@50: >70%
# - mAP@50-95: >65% (primary metric)
# - Overfitting ratio: <1.3× (currently 1.67×)
```

**Important:** Only deploy if:
1. ✅ mAP@50-95 > 65%
2. ✅ Overfitting ratio < 1.3×
3. ✅ False positive rate < 5%

---

## Step 9: Deploy (If Performance Improves)

```bash
# Only if new model beats current baseline
# Current baseline: mAP@50-95 = 59.7%, ratio = 1.67×

# Compare models
.venv/bin/python experiments/yolo_evaluate.py --all --split test

# If new model is better, deploy:
cp experiments/detection/weights/best.pt \
   experiments/detection/weights/best.pt.backup

cp <new_checkpoint> experiments/detection/weights/best.pt

# Restart server
pkill -f yoloServer.py
.venv/bin/python src/services/yoloServer.py
```

---

## Complete Workflow Example

```bash
# 1. Download pesticide images (batch_001)
# 2. Place in data/incoming/batch_001

# 3. Annotate with LabelImg
labelImg data/incoming data/classes.txt

# 4. Move to reviewed
mv data/incoming/batch_001/* data/reviewed/

# 5. Validate
.venv/bin/python scripts/validate_dataset.py data/reviewed

# 6. Merge
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged \
  --new-source "batch_001_pesticides" \
  --new-license "CC-BY-4.0"

# 7. Validate merged
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged

# 8. Train
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60

# 9. Evaluate
.venv/bin/python experiments/yolo_evaluate.py --split test

# 10. Deploy (if better than baseline)
# ... (see deploy steps above)
```

---

## Tracking External Datasets

If using external datasets (Roboflow, Kaggle, GitHub):

```bash
# Create tracking file
cat > data/external_datasets/SOURCES.md << 'EOF'
# External Dataset Sources

## Bottle Detection (GitHub - lonlonago)
- Source: https://github.com/lonlonago/Plastic-Bottle-Detection-Dataset-VOC-YOLO-Format-5846-Images-1-Classification
- Images: 5846 plastic bottles
- License: Check repository
- Status: Not used (generic bottles, not pesticide-specific)

## Beverage Detection (GitHub - codeseeboy)
- Source: https://github.com/codeseeboy/beverage-bottle-detection-model
- Images: 5000+ with 73 classes
- License: Check repository
- Status: Available but not used

## DO NOT use generic bottle datasets as pesticide labels
- They can be used for pesticide_package class only
- Must be supplemented with manual pesticide annotations
- Never claim bottle detection = pesticide detection
EOF
```

---

## Troubleshooting

### LabelImg issues

| Problem | Solution |
|---------|----------|
| LabelImg won't start | `pip install --upgrade labelImg` |
| Can't save labels | Check write permissions in data/reviewed/ |
| Class dropdown empty | Ensure data/classes.txt exists |
| Coordinates look wrong | LabelImg handles normalization (use auto mode) |

### Validation fails

| Error | Fix |
|-------|-----|
| "Invalid class ID" | Class must be 0-3 (check LabelImg dropdown) |
| "Coordinates out of range" | Use LabelImg (handles normalization) |
| "Missing label file" | Every image needs .txt annotation |
| "Cannot open image" | Image corrupted or unsupported format |

### Training issues

| Problem | Solution |
|---------|----------|
| "No class mapping" | Class IDs must be 0-3 |
| "Data leakage detected" | Ensure same image not in multiple splits |
| "Empty labels directory" | Run validation first |
| "GPU out of memory" | Reduce batch size: `--batch 8` |

---

## Success Criteria

✅ **Dataset ready for training when:**
1. Total images ≥ 200 (target: 500+)
2. ≥ 3 different pesticide types
3. ≥ 3 different container types
4. Train/val/test split: ~70/15/15
5. Validation script passes ✅
6. All 4 classes represented in all splits
7. No data leakage between splits
8. Source/license info documented

✅ **Model ready for deployment when:**
1. mAP@50-95 > 65% (up from 59.7%)
2. Overfitting ratio < 1.3× (down from 1.67×)
3. False positive rate < 5%
4. Tested on diverse pesticide images
5. Performance improves over baseline

---

## Next Steps

1. **Immediately:** Validate current dataset (already done ✅)
2. **This week:** Collect 50-100 diverse pesticide images
3. **Next week:** Annotate and validate
4. **Week 3:** Merge and retrain
5. **Week 4:** Evaluate and deploy (if performance improves)

**Estimated timeline to production:** 3-4 weeks with consistent effort

