# KrishiLens YOLO — Quick Start Cheat Sheet

## Start the System (3 terminals needed)

**Terminal 1: Python YOLO Server**
```bash
cd /Users/shlokjoshi/Desktop/KrishiLens
.venv/bin/python src/services/yoloServer.py
# Waits for requests on http://localhost:5001
```

**Terminal 2: Express.js Backend**
```bash
cd /Users/shlokjoshi/Desktop/KrishiLens
npm start
# Serves web app on http://localhost:3001
```

**Terminal 3: Open Browser**
```
http://localhost:3001
```

---

## Test Everything Works

```bash
# End-to-end system test (all 3 tests should PASS)
.venv/bin/python test_e2e_yolo.py
```

---

## Train New Models

```bash
# Train with defaults (50 epochs, yolov8n, 640px)
.venv/bin/python experiments/yolo_train_improved.py

# Train with custom settings
.venv/bin/python experiments/yolo_train_improved.py \
    --epochs 60 \
    --model yolov8s \
    --imgsz 768
```

---

## Evaluate Models

```bash
# Evaluate current production model on test set
.venv/bin/python experiments/yolo_evaluate.py --split test

# Evaluate all experiments and compare
.venv/bin/python experiments/yolo_evaluate.py --all --split test

# Evaluate on validation set
.venv/bin/python experiments/yolo_evaluate.py --split val
```

---

## Deploy New Model to Production

```bash
# After training, copy best model to production
cp experiments/detection/improved_v1_baseline/weights/best.pt \
   experiments/detection/weights/best.pt

# Restart YOLO server (stop and start Terminal 1)
pkill -f yoloServer.py
.venv/bin/python src/services/yoloServer.py
```

---

## Troubleshooting Commands

```bash
# Check if YOLO server is running
pgrep -f yoloServer.py

# Test YOLO server directly
curl http://localhost:5001/health | jq '.'

# Check what model is loaded
curl http://localhost:5001/model-info | jq '.manifest'

# View YOLO logs
tail -f experiments/detection/*/logs/*.log

# Check Python dependencies
.venv/bin/python -c "from ultralytics import YOLO; print('✓ OK')"
```

---

## Files You'll Use Most

```
Training:      .venv/bin/python experiments/yolo_train_improved.py
Evaluation:    .venv/bin/python experiments/yolo_evaluate.py
Testing:       .venv/bin/python test_e2e_yolo.py

Production:    experiments/detection/weights/best.pt
Backup:        experiments/detection/weights/final.pt

Web App:       npm start
YOLO Server:   .venv/bin/python src/services/yoloServer.py
```

---

## Documentation

```bash
# Read in order for best understanding:
1. YOLO_STATUS_SUMMARY.md              # What's done, what's next (THIS IS KEY)
2. YOLO_IMPLEMENTATION_GUIDE.md        # How to operate the system
3. YOLO_IMPROVEMENT_STRATEGY.md        # How to improve the model
4. YOLO_AUDIT_2026-10-25.md            # Deep technical dive
```

---

## Current Performance

```
Dataset Size:        33 images (too small)
Model:               YOLOv8n nano
mAP@50:              99.50% (misleading)
mAP@50-95:           59.70% (real performance)
Overfitting Ratio:   1.67× (HIGH ⚠️)
Status:              Not production-ready

To improve:
1. Get 500+ real pesticide images
2. Retrain with improved_v1_baseline
3. Deploy when mAP@50-95 > 65%
```

---

## Typical Workflow

```bash
# Week 1: Start here
npm start &
.venv/bin/python src/services/yoloServer.py &
.venv/bin/python test_e2e_yolo.py
# → All tests should PASS ✓

# Week 1-2: Find datasets
# (Search Roboflow, Kaggle, GitHub)
# Download 500+ pesticide images

# Week 2: Merge and retrain
.venv/bin/python experiments/yolo_train_improved.py --epochs 60
.venv/bin/python experiments/yolo_evaluate.py --split test

# Week 2-3: If good results, deploy
cp experiments/detection/improved_v1/weights/best.pt \
   experiments/detection/weights/best.pt

# Week 3: Verify in production
.venv/bin/python test_e2e_yolo.py
npm start
# Test in browser at http://localhost:3001
```

---

## Key Metrics to Watch

```
After retraining, check:

Precision:      Should be >75%
Recall:         Should be >75%
F1-score:       Should be >75%

mAP@50:         Should be >70%
mAP@50-95:      Should be >65%  ← Primary metric

Overfitting:    Should be <1.3× (currently 1.67×)
                Healthy: 1.0-1.2×

False Positives: Should be <5% of test images
```

---

## Pro Tips

```bash
# Monitor training in real-time
tail -f experiments/detection/improved_v1_baseline/runs/*/training.log

# Compare all experiments at once
.venv/bin/python experiments/yolo_evaluate.py --all --split test | \
    grep "Checkpoint\|Overfitting"

# Save evaluation results as JSON
.venv/bin/python experiments/yolo_evaluate.py --split test \
    --output eval_results.json

# Kill all Python processes (be careful!)
pkill -f "python"
```

---

## What NOT to Do

```
❌ Don't use mAP@50 alone (misleading)
❌ Don't train on <100 images (overfitting)
❌ Don't skip early stopping (wastes time, overfits)
❌ Don't commit best.pt to Git (use .gitignore)
❌ Don't train at 1024px resolution with small batch size
❌ Don't ignore the overfitting ratio warning
```

---

## Success Checklist

- [ ] `test_e2e_yolo.py` passes all 3 tests
- [ ] Web app loads at http://localhost:3001
- [ ] Can upload/capture image and run detection
- [ ] Bounding boxes render with confidence scores
- [ ] YOLO server reports mAP metrics
- [ ] Found 500+ pesticide images
- [ ] Merged datasets into training folder
- [ ] Trained improved model
- [ ] mAP@50-95 > 65% on test set
- [ ] Overfitting ratio < 1.3×
- [ ] Deployed best model to production

---

**Status:** ✓ System ready | ⚠️ Needs larger dataset | 🔴 Not production yet

**Est. Time to Production:** 1-2 weeks (with good dataset)

**For questions:** Read YOLO_STATUS_SUMMARY.md first
