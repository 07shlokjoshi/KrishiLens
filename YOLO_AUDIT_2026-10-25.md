# KrishiLens YOLO Detection System — Complete Audit Report
**Generated:** 2026-10-25  
**Auditor:** Claude Code  
**Status:** ACTIONABLE FINDINGS

---

## Executive Summary

The KrishiLens YOLO pesticide detection system has a **complete, functional infrastructure** for end-to-end detection. However, the **training dataset is critically small** (33 images, mostly augmentations) and the best model shows **signs of overfitting** (mAP50=0.995 but mAP50-95=0.43). **Immediate action required:** Find real, larger pesticide-package datasets and retrain.

---

## 1. Frontend Infrastructure ✓ READY

| Component | Status | Notes |
|-----------|--------|-------|
| **HTML/CSS/JS App** | ✓ Complete | `/public/index.html` with all screens designed |
| **YOLO UI Elements** | ✓ Complete | Preview detection panel, results panel, bounding box renderer |
| **BBox Renderer** | ✓ Ready | `/public/js/yoloBBox.js` — draws normalized coords → canvas pixels |
| **Detection Buttons** | ✓ Ready | "Run YOLO Detection" on preview screen, "Execute AI Label Extraction" button |

**Key Features:**
- Real-time canvas overlay aligned to image display size
- Confidence scores, class labels, and pixel coordinates shown
- Color-coded bounding boxes per class (green=package, blue=label, red=toxicity, orange=reg)
- Model metrics displayed (mAP@50, mAP@50-95, per-class breakdown)

---

## 2. Backend API Infrastructure ✓ READY

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/yolo/health` | GET | ✓ Ready | Check if Python YOLO server is running |
| `/api/yolo/model` | GET | ✓ Ready | Get model info + training metrics |
| `/api/yolo/detect` | POST | ✓ Ready | Run inference on base64 image |

**Node Service:** `/src/services/yoloService.js`
- Communicates with Python FastAPI server (port 5001)
- 30-second health check caching
- Graceful offline fallback
- Timeout: 10 seconds per request

---

## 3. Python YOLO Server ✓ READY

**File:** `/src/services/yoloServer.py`
**Status:** FastAPI server ready, model loading logic in place

### Configuration
```
Port:                5001 (YOLO_PORT env var)
Model Checkpoint:    experiments/detection/weights/best.pt (YOLO_CHECKPOINT)
Device:              Apple Silicon (mps) / CUDA / CPU auto-detect
Confidence Threshold: 0.25 (YOLO_CONF env var)
IOU Threshold:       0.45 (YOLO_IOU env var)
```

### Capabilities
- ✓ Loads model manifest with training metrics
- ✓ Returns normalized bbox coords: [cx, cy, w, h] (0-1 scale)
- ✓ Returns pixel coords: {x1, y1, x2, y2, width, height}
- ✓ Returns actual confidence scores (never fabricated)
- ✓ Includes per-class mAP from training manifest
- ✓ CORS enabled for frontend access

---

## 4. Current Model & Training Infrastructure

### Best Model (exp3_yolov8n_hires)

**Checkpoint:** `experiments/detection/weights/best.pt` (6.3 MB)

| Metric | Value | Note |
|--------|-------|------|
| Architecture | YOLOv8n (nano) | Lightweight, suitable for mobile |
| Input Resolution | 1024×1024 | High resolution for label text |
| Epochs Trained | 80 | Early stopping at best val performance |
| Batch Size | 4 | Limited by dataset size |
| Learning Rate | 0.001 | Fixed |
| Device | Apple Silicon (mps) | M-series GPU acceleration |
| **Val Precision** | **0.9375** | High true positives relative to all positives |
| **Val Recall** | **0.75** | 3 in 4 objects detected |
| **Val mAP@50** | **0.995** | 🔴 **SUSPICIOUSLY HIGH** |
| **Val mAP@50-95** | **0.43** | 🔴 **SEVERELY LOW** — overfitting signal |
| **F1-score (Val)** | **0.8333** | Reasonable balance |

**Per-Class mAP@50 (Validation):**
- pesticide_package: 0.995
- cibrc_label: 0.995
- toxicity_triangle: 0.995
- cibrc_reg_stamp: 0.995

### Training History

| Experiment | Model | Epochs | imgsz | P | R | mAP@50 | mAP@50-95 | Decision |
|------------|-------|--------|-------|---|---|--------|-----------|----------|
| exp1 | yolov8n | 100 | 640 | — | — | 0.7872 | 0.372 | Baseline, lower res |
| exp2 | yolov8s | 80 | 640 | — | — | 0.7671 | 0.407 | Larger model, not better |
| exp3 ✓ | yolov8n | 80 | 1024 | 0.9375 | 0.75 | 0.995 | 0.43 | **SELECTED** but overfits |

---

## 5. Dataset Audit

### Current Data Structure

**Location:** `data/pesticide_pilot_dataset/`

| Split | Images | Labels | Coverage |
|-------|--------|--------|----------|
| **train** | 24 | 24 | ~73% |
| **val** | 5 | 5 | ~15% |
| **test** | 4 | 4 | ~12% |
| **TOTAL** | **33** | **33** | 100% |

### Dataset Composition (PROBLEMATIC)

**Unique Source Images:** ~7 acetamiprid photos under different conditions
- label_1_clear_acetamiprid (multiple augmentations)
- label_4_low_light_acetamiprid (multiple augmentations)
- label_6_glare_acetamiprid (multiple augmentations)
- Negative samples (water bottle, field tool)

**Augmentation Methods Applied:**
- HSV color jitter (h, s, v)
- Rotation (±15°)
- Scale (0.4–0.5)
- Brightness/contrast
- Gaussian blur
- Mosaic mixing
- Horizontal flip

### Classes Defined (data.yaml)

```yaml
nc: 4
names:
  0: pesticide_package      # Full container body
  1: cibrc_label            # Primary statutory text panel
  2: toxicity_triangle      # CIB&RC toxicity diamond
  3: cibrc_reg_stamp        # Registration number & license
```

### Critical Issues ⚠️

1. **Dataset Too Small:** 33 images is NOT enough for production model training
   - Real-world object detection typically needs 1,000+ images minimum
   - With only ~7 unique sources, the model has memorized those specific instances
   - High mAP@50 (0.995) with low mAP@50-95 (0.43) is classic **overfitting**

2. **Limited Diversity:**
   - Only acetamiprid pesticide
   - Only one label format/language
   - No variation in:
     - Other pesticide types (fungicides, herbicides, rodenticides)
     - Different brands/manufacturers
     - Damaged, faded, or worn labels
     - Different viewing angles or lighting conditions (only 3 scenarios simulated)
     - Different container types (bottles, pouches, bags, cans)

3. **No Real-World Test Coverage:**
   - All images are synthetic or lab-controlled
   - Unknown generalization to:
     - Field photos with glare, shadows, motion blur
     - Different phone cameras (iPhone, Android, DSLR)
     - Different pesticide brands

4. **Data Leakage Risk (MITIGATED):**
   - Validation: file stems are unique across splits ✓
   - But augmentations of same source image exist in train+val
   - This inflates validation metrics artificially

---

## 6. Related Datasets in Repository

### Other Data Sources (NOT USED FOR DETECTION)

| Dataset | Type | Location | Status | Classes |
|---------|------|----------|--------|---------|
| **Arabic-OCR** | Glyph Classification | `Arabic-OCR/` | ✗ Not integrated | 29 Arabic letters |
| **Unsupervised Crop Detection** | Autoencoder Embeddings | `Unsupervised_Crop_Detection/` | ✗ Not integrated | Continuous (plants vs soil) |
| **Pesticide Data (Pesti-Gen)** | Chemical Regression/Classification | `pesticide_data_Pesti-Gen/` | ✗ Not integrated | SMILES, toxicity, half-life |

**None of these contribute to object detection training.**

---

## 7. Integration Points in Web App

### Workflow
1. **User captures/uploads image** → Screen 3 (Preview)
2. **User clicks "Run YOLO Detection"** → Calls `/api/yolo/detect` via yoloService
3. **Backend forwards to Python YOLO server** (port 5001)
4. **Python server returns bounding boxes** (normalized + pixel coords)
5. **JavaScript renders boxes** → Canvas overlay on image
6. **User sees confidence scores and class labels** → Can then click "Execute AI Label Extraction"

### Code Locations
- Frontend detection call: `public/js/app.js` line 235 (`runYoloDetect`)
- BBox rendering: `public/js/yoloBBox.js` (YoloBBoxRenderer class)
- Backend YOLO router: `src/routes/yolo.js`
- Python server: `src/services/yoloServer.py`

---

## 8. Blocker: Overfitting Evidence

The model's metrics tell a story:

| Metric | Value | Interpretation |
|--------|-------|-----------------|
| mAP@50 | 0.995 | "At loose IoU=0.50, I'm nearly perfect" |
| mAP@50-95 | 0.43 | "At strict IoU=0.50-0.95, I collapse to ~43%" |
| **Ratio** | **2.3x gap** | 🔴 **Classic overfitting signal** |

### Why This Matters
- **mAP@50**: Bounding box only needs 50% overlap to count as correct → lenient
- **mAP@50-95**: Strict grading from 50% to 95% overlap → realistic
- **The gap:** Model learned **position estimates are unreliable** on unseen data

### Conclusion
The model works on the training distribution but will likely fail on real pesticide images it hasn't seen.

---

## 9. Next Steps (PRIORITY ORDER)

### 🔴 CRITICAL (Week 1)
1. **Find Real Datasets**
   - Search Roboflow, Kaggle, GitHub for "pesticide detection", "label detection", "chemical detection"
   - Verify license: look for CC-BY-4.0, MIT, or research use acceptable
   - Minimum target: 500+ real pesticide package images

2. **Validate Candidate Datasets**
   - Check: Do they have bounding box annotations?
   - Check: Do class names align with CIB&RC requirements?
   - Check: Are images diverse (lighting, angles, pesticide types)?

3. **Merge Datasets**
   - Remap class IDs if needed
   - Check for duplicates
   - Ensure train/val/test split is stratified and non-overlapping

### 🟡 HIGH (Week 2)
4. **Retrain Models**
   - Experiment: yolov8n, yolov8s, yolov8m (different sizes)
   - Tune: learning rate, batch size, epoch count, augmentation
   - Log: every experiment in `experiments/detection/`

5. **Evaluate Properly**
   - Always compare on **same held-out test set**
   - Report: P, R, F1, mAP@50, mAP@50-95, per-class breakdown
   - Look for: mAP@50 and mAP@50-95 closer together (sign of good generalization)

### 🟢 NORMAL (Week 2+)
6. **Integrate & Test End-to-End**
   - Copy best checkpoint to production path
   - Verify `/api/yolo/detect` returns predictions
   - Test in web app: upload sample images, verify bboxes render

7. **Document Everything**
   - Dataset sources and preprocessing
   - Model architecture and training hyperparameters
   - Evaluation metrics and per-class performance
   - How to switch between model checkpoints

---

## 10. Files to Review/Modify

| File | Purpose | Action |
|------|---------|--------|
| `experiments/yolo_train.py` | Training script | ✓ Ready, will reuse |
| `experiments/yolo_evaluate.py` | Evaluation script | Check if exists and run tests |
| `src/services/yoloServer.py` | Python inference server | ✓ Ready, will use as-is |
| `src/services/yoloService.js` | Node.js bridge | ✓ Ready, no changes needed |
| `public/js/yoloBBox.js` | BBox rendering | ✓ Ready, no changes needed |
| `public/js/app.js` | Main app logic | ✓ Ready, verify YOLO calls work |
| `data/pesticide_pilot_dataset/` | Current dataset | Will extend with new data |
| `experiments/detection/model_manifest.json` | Model metadata | Will update after retraining |

---

## 11. Success Criteria

Before calling this task complete:

- [ ] Real pesticide image dataset found and validated (500+ images, diverse)
- [ ] Dataset merged and checked for data leakage
- [ ] Models retrained with improved data (at least 2 experiments)
- [ ] Best model has mAP@50 and mAP@50-95 within reasonable range (no 2.3x gap)
- [ ] End-to-end web app test: upload image → YOLO predictions render correctly
- [ ] Bounding boxes stay aligned when image is resized
- [ ] Error analysis document created (per-class precision/recall)
- [ ] Model manifest updated with new metrics
- [ ] Documentation added: how to train, evaluate, and switch models

---

## 12. Known Working Paths

```bash
# Start YOLO server
.venv/bin/python src/services/yoloServer.py

# Start web app
npm run dev  # or node server.js

# Training script
.venv/bin/python experiments/yolo_train.py

# Python version
Python 3.14.3 ✓ available
PyTorch + ultralytics ✓ available
```

---

**Status:** Ready to proceed with dataset search and retraining.
