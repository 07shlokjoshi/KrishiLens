# KrishiLens YOLO Pesticide Detection — Complete Implementation Guide

**Version:** 2.0  
**Last Updated:** 2026-10-25  
**Status:** Production-Ready Infrastructure, Needs Dataset Improvement

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Current Architecture](#current-architecture)
3. [Running the System](#running-the-system)
4. [Training New Models](#training-new-models)
5. [Evaluating Models](#evaluating-models)
6. [Deploying to Production](#deploying-to-production)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

### What Is KrishiLens YOLO Detection?

KrishiLens uses **YOLOv8 (You Only Look Once v8)** object detection to identify and locate:
- **Pesticide Packages** — Full container body
- **CIB&RC Labels** — Primary statutory text panel
- **Toxicity Triangles** — Red/Yellow/Blue/Green warning symbols
- **Registration Stamps** — License & registry numbers

### Current Performance

**Baseline Model:** `exp3_yolov8n_hires` (trained on 33 images)

| Metric | Value | Status |
|--------|-------|--------|
| mAP@50 | 99.50% | ✓ Excellent on tight dataset |
| mAP@50-95 | 59.70% | ⚠️ Poor on strict metrics |
| Overfitting Ratio | 1.67× | 🔴 HIGH (need >500 images) |
| Inference Speed | ~600ms | ✓ Fast |
| Model Size | 6.3 MB | ✓ Mobile-friendly |

**Status:** ✓ Infrastructure complete | ⚠️ Needs larger dataset

---

## Current Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Frontend)                       │
│  public/index.html + public/js/*.js (React 19 Migration)   │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP REST
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                Express.js Backend Server (port 3001)        │
│  server.js + src/routes/yolo.js                            │
│  ├─ POST /api/yolo/detect   → runs inference               │
│  ├─ GET  /api/yolo/health   → checks server status         │
│  └─ GET  /api/yolo/model    → returns model metrics        │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP Proxy
                   │
┌──────────────────▼──────────────────────────────────────────┐
│        Python FastAPI YOLO Server (port 5001)              │
│  src/services/yoloServer.py                                │
│  └─ Runs actual YOLOv8 inference                           │
│     • Loads model checkpoint (6.3 MB)                      │
│     • Returns bounding boxes + confidence scores           │
│     • Includes model training metrics                      │
└──────────────────────────────────────────────────────────────┘
                   │
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              YOLO Model Checkpoint                          │
│  experiments/detection/weights/best.pt                      │
│  └─ YOLOv8n (nano) trained on pesticide labels            │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User captures/uploads image
   ↓
2. Browser converts to base64 data URI
   ↓
3. POST /api/yolo/detect { image: "data:image/jpeg;base64,..." }
   ↓
4. Node.js forwards to Python YOLO server
   ↓
5. YOLO server runs model.predict()
   ↓
6. Returns: { detections: [{ class_name, confidence, bbox_norm, bbox_pixels }] }
   ↓
7. Browser renders bounding boxes on canvas overlay
   ↓
8. User sees class labels, confidence scores, and highlighted regions
```

---

## Running the System

### Prerequisites

```bash
# Check Python & Node versions
python3 --version  # 3.11+
node --version     # 18+
npm --version      # 10+

# Check YOLO installation
.venv/bin/python -c "from ultralytics import YOLO; print('✓ YOLO installed')"
```

### Start the Web Application (3 terminals)

**Terminal 1: YOLO Python Server**
```bash
cd /Users/shlokjoshi/Desktop/KrishiLens
.venv/bin/python src/services/yoloServer.py

# Expected output:
# [INFO] Loading YOLO model: experiments/detection/weights/best.pt
# [INFO] YOLO server ready on port 5001 | Device: mps
# [INFO] Classes: {'0': 'pesticide_package', '1': 'cibrc_label', ...}
```

**Terminal 2: Express.js Backend**
```bash
cd /Users/shlokjoshi/Desktop/KrishiLens
npm start  # or: node server.js

# Expected output:
# =======================================================
# 🌾 KrishiLens Pesticide Label Reader Server Running
# 📡 URL: http://localhost:3001
# =======================================================
```

**Terminal 3: Watch for code changes (optional)**
```bash
npm run dev  # Auto-restarts on file changes
```

### Access the Web App

Open browser and navigate to:
```
http://localhost:3001
```

You should see the KrishiLens interface with:
- Camera Scanner button
- File Upload button
- Test samples carousel
- Field Inspection Checklist

---

## Training New Models

### Quick Start: Train with Improved Script

```bash
# Train baseline model (50 epochs, yolov8n, 640px resolution)
.venv/bin/python experiments/yolo_train_improved.py

# Train with custom parameters
.venv/bin/python experiments/yolo_train_improved.py \
    --epochs 60 \
    --model yolov8s \
    --imgsz 768 \
    --batch 8
```

### Training Process

The script will:
1. **Validate dataset** — Check image/label pairing, class IDs, no leakage
2. **Train two experiments** — Baseline + high-resolution variant
3. **Save checkpoints** — Every 5 epochs + best weights
4. **Evaluate on val set** — Print mAP@50, mAP@50-95, per-class metrics
5. **Evaluate on test set** — Final performance report
6. **Compare experiments** — Print summary table

### Monitor Training Progress

```bash
# Watch logs in real-time
tail -f experiments/detection/*/logs/*.log

# Or check YOLO's training plots
open experiments/detection/improved_v1_baseline/results.png
open experiments/detection/improved_v2_highres/results.png
```

### Output Structure

After training, you'll have:
```
experiments/detection/
├── improved_v1_baseline/
│   ├── weights/
│   │   ├── best.pt          ← Best checkpoint (validation)
│   │   └── last.pt          ← Final checkpoint (all epochs)
│   ├── results.csv          ← Training metrics per epoch
│   ├── results.png          ← Charts (loss, mAP, etc.)
│   └── experiment_result.json ← Parsed metrics
├── improved_v2_highres/
│   └── ... (same structure)
└── weights/
    ├── best.pt              ← Current production model
    └── improved_v1_baseline_best.pt
```

---

## Evaluating Models

### Full Evaluation on Test Set

```bash
# Evaluate current production model
.venv/bin/python experiments/yolo_evaluate.py \
    --checkpoint experiments/detection/weights/best.pt \
    --split test

# Evaluate a specific experiment
.venv/bin/python experiments/yolo_evaluate.py \
    --checkpoint experiments/detection/improved_v1_baseline/weights/best.pt \
    --split val
```

### Compare All Experiments

```bash
# Evaluate all experiment checkpoints on test set
.venv/bin/python experiments/yolo_evaluate.py --all --split test

# Output: Comparison table showing all models' metrics
#   Checkpoint                   P      R     F1   mAP50  mAP50-95
#   exp3_yolov8n_hires         0.9375 0.75  0.833 0.9950 0.4300
#   improved_v1_baseline       0.8...
#   improved_v2_highres        0.8...
```

### Evaluation Metrics Explained

```
Precision (P):      Of all detections the model made, how many were correct?
                    High P = few false positives
                    
Recall (R):         Of all real objects, how many did the model find?
                    High R = no missed detections
                    
F1-score:           Harmonic mean of P and R
                    Best for imbalanced datasets
                    
mAP@50:             "Loose" metric (boxes need 50% overlap)
                    ❌ Don't use alone (misleading)
                    
mAP@50-95:          "Strict" metric (50-95% overlap required)
                    ✓ More realistic assessment
                    
Ratio (mAP50/50-95): Should be close to 1.0 (1.0-1.2 ideal)
                    >1.5 = overfitting (model memorized training data)
```

### JSON Evaluation Output

Each evaluation saves a JSON report:
```bash
# Find the report
ls -t experiments/detection/eval_test_*.json | head -1 | xargs cat | jq .

# Key fields:
jq '.metrics'                           # Overall metrics
jq '.overfitting_analysis'              # Overfitting ratio + indicator
jq '.per_class_mAP50'                   # Per-class breakdown
jq '.error_analysis'                    # TP/FP/FN counts
jq '.per_image_results[] | select(.error_type != "TRUE_POSITIVE")'  # Errors
```

---

## Deploying to Production

### Step 1: Train & Evaluate Best Model

```bash
# Train several experiments
.venv/bin/python experiments/yolo_train_improved.py --epochs 50 --model yolov8n
.venv/bin/python experiments/yolo_train_improved.py --epochs 50 --model yolov8s

# Evaluate all on test set
.venv/bin/python experiments/yolo_evaluate.py --all --split test

# Pick best based on:
# ✓ mAP@50-95 (primary metric)
# ✓ Overfitting ratio (should be <1.3)
# ✓ Per-class performance (consistent across classes)
# ✓ Speed (inference latency)
```

### Step 2: Promote Best Model to Production

```bash
# Copy best checkpoint to production path
cp experiments/detection/improved_v1_baseline/weights/best.pt \
   experiments/detection/weights/best.pt

# Update production manifest (automatically generated during training)
# Already in experiments/detection/model_manifest.json
```

### Step 3: Restart YOLO Server

```bash
# Kill existing server
pkill -f "python.*yoloServer.py"

# Start new instance
.venv/bin/python src/services/yoloServer.py

# Verify it loads the new checkpoint
curl http://localhost:5001/health | jq '.checkpoint'
```

### Step 4: Test End-to-End

```bash
# Automated test
.venv/bin/python test_e2e_yolo.py

# Manual test in browser
# 1. Open http://localhost:3001
# 2. Click "Open Camera Scanner" or "Upload Leaflet/Photo"
# 3. Capture/upload a test pesticide image
# 4. Click "Run YOLO Detection"
# 5. Verify bounding boxes render correctly
# 6. Check confidence scores match console output
```

### Step 5: Git Commit (if using version control)

```bash
git add experiments/detection/weights/best.pt
git add experiments/detection/model_manifest.json
git commit -m "chore(yolo): promote improved_v1_baseline as production model

- mAP@50: 0.XX
- mAP@50-95: 0.XX  
- Overfitting ratio: X.X
- Trained on improved_dataset with regularization

Test on pesticide images: PASS"
```

---

## Troubleshooting

### "YOLO Server Offline" Error in Web App

**Symptom:** Web app shows "YOLO server offline" message

**Fix:**
```bash
# Check if server is running
pgrep -f yoloServer.py

# If not running, start it
.venv/bin/python src/services/yoloServer.py

# Test health endpoint
curl http://localhost:5001/health

# Check for port conflicts
lsof -i :5001  # Should show yoloServer
```

### Bounding Boxes Not Rendering

**Symptom:** "Run YOLO Detection" button works, detections appear, but boxes not visible

**Fix:**
```bash
# Check if canvas element exists in DOM
curl http://localhost:3001 | grep "yolo.*canvas"

# Check browser console for JavaScript errors
# (Open DevTools → Console tab)

# Verify canvas overlay CSS
grep "yolo-bbox-canvas" public/css/style.css

# Test prediction format
curl -X POST http://localhost:3001/api/yolo/detect \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,..."}' | jq '.detections[0]'
```

### Model Predictions Inaccurate

**Symptom:** Many false positives or false negatives

**Likely Cause:** Model is overfitted (trained on too small dataset)

**Solution:**
```bash
# Check overfitting ratio
.venv/bin/python experiments/yolo_evaluate.py --split test | grep "Overfitting"

# If ratio > 1.5:
# 1. Get more diverse images (500+ minimum)
# 2. Retrain with stronger regularization:

.venv/bin/python experiments/yolo_train_improved.py \
    --epochs 40  # Fewer epochs = less memorization
    
# In yolo_train_improved.py, manually set:
# dropout: 0.3  # Increase from 0.2
# weight_decay: 0.002  # Increase from 0.001
```

### Model Checkpoint Loading Error

**Symptom:** "Checkpoint not found" or "Failed to load checkpoint"

**Fix:**
```bash
# Verify checkpoint exists
ls -lh experiments/detection/weights/best.pt

# Check file isn't corrupted
.venv/bin/python -c "from ultralytics import YOLO; YOLO('experiments/detection/weights/best.pt')"

# If corrupted, restore from backup
cp experiments/detection/weights/final.pt \
   experiments/detection/weights/best.pt

# Or retrain
.venv/bin/python experiments/yolo_train_improved.py
```

### Out of Memory During Training

**Symptom:** "CUDA out of memory" or similar error

**Fix:**
```bash
# Reduce batch size
.venv/bin/python experiments/yolo_train_improved.py \
    --batch 2  # Default is 4

# Use smaller model
.venv/bin/python experiments/yolo_train_improved.py \
    --model yolov8n  # Instead of yolov8s or yolov8m

# Reduce image resolution
.venv/bin/python experiments/yolo_train_improved.py \
    --imgsz 512  # Instead of 640 or 768
```

---

## File Reference

### Training & Evaluation Scripts

| File | Purpose | Command |
|------|---------|---------|
| `experiments/yolo_train_improved.py` | Train YOLO models with regularization | `.venv/bin/python experiments/yolo_train_improved.py` |
| `experiments/yolo_evaluate.py` | Evaluate any checkpoint on test/val/train | `.venv/bin/python experiments/yolo_evaluate.py --split test` |
| `test_e2e_yolo.py` | End-to-end system test | `.venv/bin/python test_e2e_yolo.py` |

### Model Checkpoints

| Path | Size | Purpose |
|------|------|---------|
| `experiments/detection/weights/best.pt` | 6.3 MB | Current production model |
| `experiments/detection/weights/final.pt` | 6.3 MB | Backup of previous production |
| `yolov8n.pt` | 6.3 MB | Pretrained YOLOv8 nano (no pesticide training) |
| `yolov8s.pt` | 22 MB | Pretrained YOLOv8 small (no pesticide training) |

### Web Application Files

| File | Purpose |
|------|---------|
| `server.js` | Express.js backend server |
| `src/routes/yolo.js` | YOLO API endpoints |
| `src/services/yoloServer.py` | Python YOLO inference server |
| `src/services/yoloService.js` | Node.js bridge to YOLO server |
| `public/js/yoloBBox.js` | Bounding box rendering on canvas |
| `public/js/app.js` | Main application logic |
| `public/index.html` | HTML structure |
| `public/css/style.css` | Styles |

---

## Next Steps

### Immediate (This Week)
- [ ] Verify end-to-end system works: `npm start` + python YOLO server
- [ ] Run `test_e2e_yolo.py` to confirm pipeline
- [ ] Research 3-5 public pesticide datasets (see YOLO_IMPROVEMENT_STRATEGY.md)

### Short-term (Next 1-2 Weeks)
- [ ] Download and validate candidate datasets
- [ ] Merge datasets with existing training data
- [ ] Retrain models with `yolo_train_improved.py`
- [ ] Evaluate on test set: expect mAP@50-95 ~0.65-0.75

### Medium-term (Weeks 2-4)
- [ ] Deploy improved model to production
- [ ] Test in real field conditions with actual pesticide images
- [ ] Collect user feedback and error cases
- [ ] Iterate: add difficult cases to training data

---

## Support & References

**Documentation:**
- `YOLO_AUDIT_2026-10-25.md` — System audit & baseline metrics
- `YOLO_IMPROVEMENT_STRATEGY.md` — Dataset improvement plan
- This guide — Implementation & operations

**Key Scripts:**
- `experiments/yolo_train_improved.py` — Training with regularization
- `experiments/yolo_evaluate.py` — Comprehensive evaluation
- `test_e2e_yolo.py` — System integration test

**Resources:**
- YOLOv8 Documentation: https://docs.ultralytics.com/
- Roboflow Datasets: https://roboflow.com/search
- Kaggle: https://kaggle.com/datasets

---

**Last Updated:** 2026-10-25 | **Status:** Production-Ready Infrastructure ✓
