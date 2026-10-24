import os
import time
import glob
import json
import joblib
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from sklearn.model_selection import train_test_split
from sklearn.linear_model import SGDClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

def load_dataset(dataset_dir, max_per_class=400, img_size=(25, 25)):
    X, y, paths = [], [], []
    classes = sorted([d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))])
    
    print(f"Discovered {len(classes)} character classes in {dataset_dir}")
    
    for cls in classes:
        class_folder = os.path.join(dataset_dir, cls)
        img_files = glob.glob(os.path.join(class_folder, "*.png"))[:max_per_class]
        
        for p in img_files:
            try:
                with Image.open(p) as img:
                    img_gray = img.convert("L").resize(img_size)
                    arr = np.asarray(img_gray, dtype=np.float32) / 255.0
                    X.append(arr.flatten())
                    y.append(cls)
                    paths.append(p)
            except Exception as e:
                continue

    return np.array(X), np.array(y), classes, paths

def run_experiment():
    print("=================================================================")
    print("🧪 EXPERIMENT B: ARABIC CHARACTER OCR CLASSIFIER")
    print("=================================================================\n")

    char_dir = "Arabic-OCR/Dataset/char_sample"
    if not os.path.exists(char_dir):
        raise FileNotFoundError(f"Extracted glyph dataset not found at {char_dir}")

    start_time = time.time()
    img_size = (25, 25)
    max_per_class = 400 # 400 * 29 = 11,600 samples for fast, clean, reproducible training
    X, y, classes, paths = load_dataset(char_dir, max_per_class=max_per_class, img_size=img_size)
    print(f"Loaded {len(X)} total character glyphs across {len(classes)} classes")

    # Stratified Train/Val/Test Split (70% Train, 15% Val, 15% Held-out Test)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    print(f"Splits: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    # Check for near-duplicates across splits via rounded pixel hashes
    train_hashes = set(hash(tuple(np.round(row, 2))) for row in X_train)
    test_leakage = sum(1 for row in X_test if hash(tuple(np.round(row, 2))) in train_hashes)
    print(f"Split Integrity: Exact pixel matches across Train & Test = {test_leakage} ({(test_leakage/len(X_test))*100:.2f}%)")

    # Train Classifier (MLP Neural Network matching Arabic-OCR paper architecture)
    print("\nTraining MLP Neural Network (100 hidden units, max_iter=200)...")
    train_start = time.time()
    clf = MLPClassifier(hidden_layer_sizes=(100,), max_iter=200, alpha=1e-4, random_state=42)
    clf.fit(X_train, y_train)
    train_duration = time.time() - train_start
    print(f"Training completed in {train_duration:.2f} seconds")

    # Validation Evaluation
    val_pred = clf.predict(X_val)
    val_acc = accuracy_score(y_val, val_pred)
    print(f"Validation Accuracy: {val_acc * 100:.2f}%")

    # Held-Out Test Evaluation
    test_pred = clf.predict(X_test)
    test_acc = accuracy_score(y_test, test_pred)
    test_report = classification_report(y_test, test_pred, output_dict=True)
    
    print(f"Held-Out Test Accuracy: {test_acc * 100:.2f}%\n")

    # Save Confusion Matrix Plot
    cm = confusion_matrix(y_test, test_pred, labels=classes)
    os.makedirs("experiments/plots", exist_ok=True)
    os.makedirs("experiments/models", exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 8))
    im = ax.imshow(cm, interpolation="nearest", cmap="Blues")
    plt.colorbar(im)
    plt.title(f"Arabic OCR Classifier Confusion Matrix (Test Acc: {test_acc*100:.2f}%)")
    plt.xlabel("Predicted Character")
    plt.ylabel("True Character")
    plt.tight_layout()
    cm_path = "experiments/plots/arabic_ocr_confusion_matrix.png"
    plt.savefig(cm_path, dpi=200)
    plt.close()
    print(f"Confusion matrix plot saved to {cm_path}")

    # Save Model Checkpoint
    model_bundle = {
        "model": clf,
        "classes": classes,
        "img_size": img_size,
        "metrics": {
            "test_accuracy": float(test_acc),
            "macro_f1": float(test_report["macro avg"]["f1-score"]),
            "weighted_f1": float(test_report["weighted avg"]["f1-score"]),
            "training_time_sec": float(train_duration)
        }
    }
    model_path = "experiments/models/arabic_ocr_classifier.joblib"
    joblib.dump(model_bundle, model_path)
    print(f"Model saved to {model_path}")

    total_time = time.time() - start_time
    return {
        "experiment": "Experiment B: Arabic OCR Character Classifier",
        "dataset": "Arabic-OCR/Dataset/char_sample",
        "classes_count": len(classes),
        "total_samples": len(X),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "model": "MLPClassifier(hidden_layer_sizes=(100,))",
        "training_time_sec": round(train_duration, 2),
        "test_accuracy": round(test_acc * 100, 2),
        "macro_f1": round(test_report["macro avg"]["f1-score"] * 100, 2),
        "artifact_path": model_path,
        "plot_path": cm_path
    }

if __name__ == "__main__":
    run_experiment()
