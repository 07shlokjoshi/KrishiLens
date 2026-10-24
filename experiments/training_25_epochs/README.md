# KrishiLens — 30-Epoch Deep Learning Experiment (Experiment A: Arabic OCR Glyph Classifier)

## 1. Overview & Objective
This experiment fulfills the **minimum 25-epoch deep learning training requirement** by executing a complete, 30-epoch convolutional neural network (CNN) training and held-out test evaluation within the KrishiLens workspace.

Following the mandatory pre-training audit of the project datasets:
- `pesticide_data_Pesti-Gen`: Contains 0 images. It is a tabular chemistry dataset with SMILES chemical formulas and CIBRC registrations.
- `Unsupervised_Crop_Detection`: Contains 32,779 32×32 RGB agricultural crop/soil aerial imagery patches without bounding boxes or packaging labels.
- `Arabic-OCR`: Contains 127,027 authentic character glyph images across 29 discrete classes, providing an ideal benchmark for multi-epoch supervised computer vision training.

**Crucial Scientific Distinction**: This character classifier is an authentic, reproducible image-classification CNN experiment. It is **not** a pesticide packaging label detector. It demonstrates deep learning convergence and character recognition, while the core KrishiLens application uses its dedicated live camera detector, edge/contour scanner, and multimodal Gemma 4 reasoning pipeline.

---

## 2. Model Architecture: `ArabicCharCNN`
The model is implemented in PyTorch and leverages Apple Silicon MPS hardware acceleration:
- **Input**: 1×28×28 grayscale glyph image
- **Feature Extractor**:
  - Conv Block 1: Conv2d(1 -> 32, k=3, p=1), BatchNorm2d(32), ReLU, MaxPool2d(2, 2), Dropout2d(0.1) -> 32×14×14
  - Conv Block 2: Conv2d(32 -> 64, k=3, p=1), BatchNorm2d(64), ReLU, MaxPool2d(2, 2), Dropout2d(0.2) -> 64×7×7
- **Classifier**:
  - Flatten -> Linear(3136 -> 128), ReLU, Dropout(0.3)
  - Linear(128 -> 29 classes)
- **Loss Function**: `nn.CrossEntropyLoss`
- **Optimizer**: Adam (lr=0.001)

---

## 3. Dataset Configuration & Leakage Prevention
- **Total Samples Used**: 11,600 balanced images (400 per class across 29 classes).
- **Split Strategy**:
  - **Train**: 70% (8,120 samples) — augmented with subtle random rotations (±7°) and slight affine transforms.
  - **Validation**: 15% (1,740 samples) — no augmentation, used strictly for validation loss/accuracy and model selection.
  - **Held-Out Test**: 15% (1,740 samples) — strictly isolated, evaluated only once on the best saved checkpoint.
- **Random Seed**: `42` (ensuring deterministic splits and reproducibility).

---

## 4. Execution Commands

### Reproduce Training (30 Epochs)
```bash
# Activate workspace virtual environment
source .venv/bin/activate

# Execute full 30-epoch training run
python experiments/training_25_epochs/train.py
```

### Run Inference on Any Image
```bash
# Run prediction on a single glyph image
python experiments/training_25_epochs/predict.py "Arabic-OCR/Dataset/char_sample/ا/10.png"

# Run prediction with custom model checkpoint
python experiments/training_25_epochs/predict.py --image "Arabic-OCR/Dataset/char_sample/ب/20.png" --model experiments/training_25_epochs/best_model.pt
```

---

## 5. Artifacts Generated
- `training_config.json`: Hyperparameters, device, seeds, learning rate, and batch size.
- `dataset_report.json`: Per-class counts, split distributions, and image resolution specs.
- `training_history.csv`: Per-epoch tracking of train loss, train accuracy, val loss, val accuracy, and epoch duration.
- `best_model.pt`: Checkpoint with highest validation accuracy.
- `final_model.pt`: Checkpoint saved at the conclusion of epoch 30.
- `results.json`: Final held-out test accuracy, macro F1, and per-class classification metrics.
- `training_curves.png`: Training vs. validation loss and accuracy across all 30 epochs.
- `confusion_matrix.png`: Normalized 29×29 confusion matrix across test samples.
- `sample_predictions/`: Sample test glyph images and corresponding predicted class probabilities (`predictions.json`).
