# Dataset Preparation Quick Reference

**For complete details, see:** [DATASET_WORKFLOW.md](DATASET_WORKFLOW.md)  
**For annotation details, see:** [ANNOTATION_GUIDE.md](ANNOTATION_GUIDE.md)

---

## ✅ Current Dataset Status

```
Total images: 33 ✅ VALIDATED
├── Train: 29 images
├── Val: 2 images
└── Test: 2 images

Classes: 4 (pesticide_package, cibrc_label, toxicity_triangle, cibrc_reg_stamp)
Negative controls: 3 (water bottle, field tool)
Unique pesticide sources: 1 (acetamiprid only)

Status: ✅ Passes validation
```

---

## Quick Commands

### 1️⃣ Validate Current Dataset (Already Passing)

```bash
.venv/bin/python scripts/validate_dataset.py data/pesticide_pilot_dataset
```

**Output should show:** ✅ VALIDATION PASSED

---

### 2️⃣ Collect Pesticide Images

Place new images in: `data/incoming/`

```bash
# Example: create batch folder
mkdir -p data/incoming/batch_001_2026-10-25

# Copy images
cp /path/to/pesticide/photos/*.jpg data/incoming/batch_001_2026-10-25/

# Track source
cat > data/incoming/batch_001_2026-10-25/SOURCE.txt << 'EOF'
Batch: batch_001_2026-10-25
Date: 2026-10-25
Source: [CIB&RC database / local market / etc]
License: [CC-BY-4.0 / Research / etc]
Notes: [pesticide types, container types, etc]
EOF
```

---

### 3️⃣ Annotate Images with LabelImg

```bash
# Install (if needed)
pip install labelImg

# Start annotation tool
labelImg data/incoming data/classes.txt

# Annotate each image:
# 1. Draw rectangle (Ctrl+N)
# 2. Select class from dropdown
# 3. Save (Ctrl+S)
# 4. Next (Ctrl+Shift+N)
```

**Key annotation rules:**
- Draw TIGHT boxes (minimal extra space)
- One box per object per class
- All 4 classes if visible
- For negative controls: don't draw boxes, save empty label

---

### 4️⃣ Validate Annotations

```bash
.venv/bin/python scripts/validate_dataset.py data/incoming
```

**Must show:** ✅ VALIDATION PASSED before merging

---

### 5️⃣ Move to Reviewed Folder

```bash
# After validation passes
mv data/incoming/batch_001_2026-10-25/* data/reviewed/
```

---

### 6️⃣ Merge with Existing Dataset

```bash
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged \
  --new-source "batch_001_pesticides_2026-10-25" \
  --new-license "CC-BY-4.0"
```

**This creates:**
- `data/pesticide_merged/images/{train,val,test}`
- `data/pesticide_merged/labels/{train,val,test}`
- `data/pesticide_merged/data.yaml`
- `data/pesticide_merged/MERGE_MANIFEST.json` (tracks sources)

---

### 7️⃣ Validate Merged Dataset

```bash
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged
```

**CRITICAL:** Must show ✅ VALIDATION PASSED before training

---

### 8️⃣ Train New Model

**Only if validation passed in step 7 ✅**

```bash
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60 \
  --model yolov8n \
  --imgsz 640 \
  --batch 16
```

---

### 9️⃣ Evaluate Model

```bash
.venv/bin/python experiments/yolo_evaluate.py \
  --split test \
  --checkpoint experiments/detection/weights/best.pt
```

**Current baseline (need to beat):**
- mAP@50-95: 59.7% → target: >65%
- Overfitting ratio: 1.67× → target: <1.3×

---

### 🔟 Deploy (If Better Than Baseline)

```bash
# Only if metrics improved
cp experiments/detection/weights/best.pt \
   experiments/detection/weights/best.pt.backup

# Deploy new model
cp <new_checkpoint> experiments/detection/weights/best.pt

# Restart server
pkill -f yoloServer.py
.venv/bin/python src/services/yoloServer.py
```

---

## Complete Workflow in One Script

```bash
#!/bin/bash
# Full workflow from image collection to deployment

BATCH_NAME="batch_001_2026-10-25"

# 1. Collect and place images in data/incoming/$BATCH_NAME

# 2. Annotate
echo "Starting annotation..."
labelImg data/incoming/$BATCH_NAME data/classes.txt

# 3. Validate
echo "Validating annotations..."
.venv/bin/python scripts/validate_dataset.py data/incoming/$BATCH_NAME
if [ $? -ne 0 ]; then echo "❌ Fix errors before continuing"; exit 1; fi

# 4. Move to reviewed
mv data/incoming/$BATCH_NAME/* data/reviewed/

# 5. Merge
echo "Merging datasets..."
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged \
  --new-source "$BATCH_NAME" \
  --new-license "CC-BY-4.0"

# 6. Validate merged
echo "Validating merged dataset..."
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged
if [ $? -ne 0 ]; then echo "❌ Fix errors before training"; exit 1; fi

# 7. Train
echo "Training model..."
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60

# 8. Evaluate
echo "Evaluating..."
.venv/bin/python experiments/yolo_evaluate.py --split test

echo "✅ Complete! Check metrics above."
```

---

## Folder Organization

```
data/
├── classes.txt                          ← Class names for LabelImg
├── pesticide_pilot_dataset/             ← Current 33 images (DO NOT MODIFY)
│   ├── images/{train,val,test}
│   └── labels/{train,val,test}
│
├── incoming/                            ← NEW images to annotate
│   └── batch_001_2026-10-25/
│       ├── image1.jpg
│       ├── image2.jpg
│       └── SOURCE.txt                  ← Track source & license
│
├── reviewed/                            ← Annotated & validated images
│   ├── image1.jpg
│   ├── image1.txt
│   ├── image2.jpg
│   └── image2.txt
│
├── external_datasets/                   ← Track external sources
│   └── SOURCES.md                       ← Document with links & licenses
│
└── pesticide_merged/                    ← OUTPUT: Ready for training
    ├── images/{train,val,test}
    ├── labels/{train,val,test}
    ├── data.yaml
    └── MERGE_MANIFEST.json              ← Source tracking
```

---

## File Naming Convention

```
# Pesticide images with batch info
pesticide_<type>_<date>_<batch>_<condition>.jpg

Examples:
pesticide_acetamiprid_2026-10-25_batch001_clear.jpg
pesticide_chlorpyrifos_2026-10-25_batch001_dim.jpg
pesticide_fungicide_2026-10-25_batch002_glare.jpg

# Negative control images
neg_sample_<object>_<date>.jpg

Examples:
neg_sample_water_bottle_2026-10-25.jpg
neg_sample_field_tool_2026-10-25.jpg
```

---

## Troubleshooting

### Validation Fails

**Problem:** "Invalid class ID"
- **Fix:** Class must be 0-3. Check LabelImg dropdown.

**Problem:** "Coordinates out of range"
- **Fix:** Use LabelImg (handles normalization automatically).

**Problem:** "Missing label file"
- **Fix:** Every image needs a .txt file. Use LabelImg to save.

---

### Merge Fails

**Problem:** "Duplicate images detected"
- **Expected:** If merging with existing dataset, duplicates are normal (shows with warning but continues)
- **Fix:** If real duplicates, remove from `data/reviewed/` and retry

**Problem:** "Cannot copy image"
- **Fix:** Check file permissions in `data/reviewed/`

---

### Training Fails

**Problem:** "No data found"
- **Fix:** Run validation first: `.venv/bin/python scripts/validate_dataset.py data/pesticide_merged`

**Problem:** "GPU out of memory"
- **Fix:** Reduce batch size: `--batch 8` instead of `--batch 16`

---

## Key Metrics to Monitor

**During Training:**
- Loss should decrease steadily
- Validation mAP should increase

**After Training:**
```bash
# Primary metric (must improve)
mAP@50-95: Current=59.7% | Target>65%

# Secondary metrics
mAP@50: Current=99.5% | Target>70%
Overfitting ratio: Current=1.67x | Target<1.3x
False positives: Current=18% | Target<5%
```

---

## Success Checklist

### Before Training ✅
- [ ] New images collected (≥50, ideally 200+)
- [ ] All images annotated with LabelImg
- [ ] Validation script passes on annotated images
- [ ] Merge script completes without errors
- [ ] Validation script passes on merged dataset
- [ ] No data leakage detected

### During Training ✅
- [ ] Training loss decreases
- [ ] No GPU out of memory errors
- [ ] Training completes without interruption

### After Training ✅
- [ ] mAP@50-95 > 65% (improvement over 59.7%)
- [ ] Overfitting ratio < 1.3× (improvement over 1.67×)
- [ ] False positive rate < 5%
- [ ] Tested on sample pesticide images

### Ready to Deploy ✅
- [ ] All above metrics pass
- [ ] Evaluated on diverse test set
- [ ] Compared against baseline
- [ ] Server restarted with new model

---

## Important Notes

1. **Do NOT skip validation** - Always run validation before training
2. **Do NOT use generic bottle datasets as pesticide labels** - Use only for pesticide_package class
3. **Do NOT train until merged dataset validates** - Prevents bad data from corrupting model
4. **Do NOT overwrite best.pt unless new model is better** - Keep current model as backup
5. **Do track sources and licenses** - MERGE_MANIFEST.json documents everything

---

## Next Steps (For Now)

1. **Read:** [ANNOTATION_GUIDE.md](ANNOTATION_GUIDE.md) (10 minutes)
2. **Read:** [DATASET_WORKFLOW.md](DATASET_WORKFLOW.md) (20 minutes)
3. **Collect:** 50-100 diverse pesticide images (1-3 days)
4. **Annotate:** Use LabelImg (2-3 hours)
5. **Validate & Merge:** Follow commands above (30 minutes)
6. **Train:** Run yolo_train_improved.py (3-4 hours)
7. **Evaluate:** Check metrics and decide on deployment (30 minutes)

**Estimated total time:** 2-3 weeks for production-ready model

---

## File Locations

| File | Purpose | Location |
|------|---------|----------|
| Validation script | Check dataset format | `scripts/validate_dataset.py` |
| Merge script | Combine datasets | `scripts/merge_datasets.py` |
| Training script | Train YOLO model | `experiments/yolo_train_improved.py` |
| Evaluation script | Check metrics | `experiments/yolo_evaluate.py` |
| Annotation guide | How to annotate | `ANNOTATION_GUIDE.md` |
| Workflow guide | Full workflow | `DATASET_WORKFLOW.md` |
| Classes file | For LabelImg | `data/classes.txt` |
| Current dataset | 33 validated images | `data/pesticide_pilot_dataset/` |

---

**Questions?** Check [ANNOTATION_GUIDE.md](ANNOTATION_GUIDE.md) or [DATASET_WORKFLOW.md](DATASET_WORKFLOW.md)

