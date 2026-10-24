import os
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix, ConfusionMatrixDisplay

def run_experiment():
    print("=================================================================")
    print("🧪 EXPERIMENT A: PESTICIDE CHEMICAL PROPERTY PREDICTION")
    print("=================================================================\n")

    csv_path = "pesticide_data_Pesti-Gen/half_life_pesticide.csv"
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} records from {csv_path}")

    # Focus on top 3 primary agricultural pesticide classes (Insecticide, Fungicide, Herbicide)
    target_classes = ["insecticide", "fungicide", "herbicide"]
    filtered_df = df[df["target class"].isin(target_classes)].dropna(subset=["SMILES", "target class"])
    print(f"Filtered to top classes {target_classes}: {len(filtered_df)} samples")

    X_smiles = filtered_df["SMILES"].values
    y = filtered_df["target class"].values

    # Clean Train/Val/Test Split (70% train, 15% val, 15% test)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X_smiles, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    print(f"Dataset split: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    # Feature Extraction: Character n-grams (3-5 chars) representing molecular sub-fragments
    vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(2, 4), max_features=1500)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_val_vec = vectorizer.transform(X_val)
    X_test_vec = vectorizer.transform(X_test)

    print(f"Extracted {X_train_vec.shape[1]} molecular n-gram features")

    # Train Baseline Model: Random Forest with fixed seed
    rf = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42, n_jobs=-1)
    rf.fit(X_train_vec, y_train)

    # Validation
    y_val_pred = rf.predict(X_val_vec)
    val_acc = accuracy_score(y_val, y_val_pred)
    print(f"Validation Accuracy: {val_acc * 100:.2f}%")

    # Final Held-Out Test Evaluation
    y_test_pred = rf.predict(X_test_vec)
    test_acc = accuracy_score(y_test, y_test_pred)
    test_report = classification_report(y_test, y_test_pred, output_dict=True)
    
    print(f"Test Accuracy:       {test_acc * 100:.2f}%\n")
    print(classification_report(y_test, y_test_pred))

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_test_pred, labels=target_classes)
    os.makedirs("experiments/plots", exist_ok=True)
    os.makedirs("experiments/models", exist_ok=True)

    fig, ax = plt.subplots(figsize=(6, 5))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=target_classes)
    disp.plot(cmap="Blues", ax=ax)
    plt.title("Chemical Target Class Confusion Matrix (Held-out Test)")
    plt.tight_layout()
    cm_path = "experiments/plots/chemical_confusion_matrix.png"
    plt.savefig(cm_path, dpi=200)
    plt.close()
    print(f"Confusion matrix plot saved to {cm_path}")

    # Save Fitted Pipeline Artifacts
    model_bundle = {
        "vectorizer": vectorizer,
        "model": rf,
        "classes": target_classes,
        "metrics": {
            "test_accuracy": float(test_acc),
            "macro_f1": float(test_report["macro avg"]["f1-score"]),
            "weighted_f1": float(test_report["weighted avg"]["f1-score"])
        }
    }
    model_path = "experiments/models/pesticide_chemical_classifier.joblib"
    joblib.dump(model_bundle, model_path)
    print(f"Model artifact saved to {model_path}")

    # Return structured summary for manifest
    return {
        "experiment": "Experiment A: Pesticide Chemical Classifier",
        "dataset": "pesticide_data_Pesti-Gen/half_life_pesticide.csv",
        "task": "Molecular SMILES to Pesticide Functional Class (Insecticide/Fungicide/Herbicide)",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "features": "TF-IDF Character N-grams (2-4)",
        "model": "RandomForestClassifier(n_estimators=100, max_depth=20)",
        "test_accuracy": round(test_acc * 100, 2),
        "macro_f1": round(test_report["macro avg"]["f1-score"] * 100, 2),
        "artifact_path": model_path,
        "plot_path": cm_path
    }

if __name__ == "__main__":
    run_experiment()
