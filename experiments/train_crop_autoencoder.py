import os
import time
import glob
import json
import joblib
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error

def load_tiles(tile_dir, max_tiles=2000, img_size=(16, 16)):
    """Loads and downsamples aerial field tiles to img_size for fast, stable autoencoding."""
    files = glob.glob(os.path.join(tile_dir, "*.JPG"))[:max_tiles]
    X = []
    loaded_paths = []
    
    for f in files:
        try:
            with Image.open(f) as img:
                img_resized = img.convert("RGB").resize(img_size)
                arr = np.asarray(img_resized, dtype=np.float32) / 255.0
                X.append(arr.flatten())
                loaded_paths.append(f)
        except Exception:
            continue

    return np.array(X), loaded_paths

def run_experiment():
    print("=================================================================")
    print("🧪 EXPERIMENT C: UNSUPERVISED CROP/WEED TILE AUTOENCODER")
    print("=================================================================\n")

    tile_dir = "Unsupervised_Crop_Detection/final_algorithm/generated_squares_4"
    if not os.path.exists(tile_dir):
        raise FileNotFoundError(f"Generated squares directory not found at {tile_dir}")

    total_avail = len(glob.glob(os.path.join(tile_dir, "*.JPG")))
    print(f"Total aerial tiles discovered: {total_avail}")
    print("Context: In this repository, 'crop' refers to agricultural field crop plants vs weeds, NOT image cropping or pesticide packaging.")

    img_size = (16, 16) # 16x16x3 = 768 dimensions
    num_samples = 2500
    print(f"\nLoading {num_samples} sample tiles resized to {img_size[0]}x{img_size[1]} RGB...")
    X, loaded_paths = load_tiles(tile_dir, max_tiles=num_samples, img_size=img_size)
    print(f"Loaded {len(X)} tiles (Feature dimension: {X.shape[1]})")

    # Train / Val / Held-out Test Split
    X_train, X_temp = train_test_split(X, test_size=0.30, random_state=42)
    X_val, X_test = train_test_split(X_temp, test_size=0.50, random_state=42)
    print(f"Splits: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    # Autoencoder Architecture: 768 -> 128 -> 32 (Bottleneck) -> 128 -> 768
    print("\nTraining Neural Autoencoder with 32-dim bottleneck representation...")
    start_train = time.time()
    ae = MLPRegressor(
        hidden_layer_sizes=(128, 32, 128),
        activation="relu",
        max_iter=150,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1
    )
    # Target is input itself (unsupervised autoencoding)
    ae.fit(X_train, X_train)
    train_time = time.time() - start_train
    print(f"Training completed in {train_time:.2f} seconds across {ae.n_iter_} iterations")

    # Evaluate Reconstruction Loss on Held-out Test Set
    X_test_recon = ae.predict(X_test)
    test_mse = mean_squared_error(X_test, X_test_recon)
    test_mae = mean_absolute_error(X_test, X_test_recon)
    print(f"Held-Out Test Reconstruction MSE: {test_mse:.6f}")
    print(f"Held-Out Test Reconstruction MAE: {test_mae:.6f}")

    # Generate Qualitative Visualizations: Original vs Reconstructed
    os.makedirs("experiments/plots", exist_ok=True)
    os.makedirs("experiments/models", exist_ok=True)

    fig, axes = plt.subplots(2, 6, figsize=(12, 4))
    for i in range(6):
        # Original
        orig = np.clip(X_test[i].reshape(img_size[0], img_size[1], 3), 0, 1)
        axes[0, i].imshow(orig)
        axes[0, i].axis("off")
        axes[0, i].set_title(f"Orig {i+1}", fontsize=10)

        # Reconstructed
        recon = np.clip(X_test_recon[i].reshape(img_size[0], img_size[1], 3), 0, 1)
        axes[1, i].imshow(recon)
        axes[1, i].axis("off")
        axes[1, i].set_title(f"Recon {i+1}", fontsize=10)

    plt.suptitle(f"Crop/Weed Tile Autoencoder Reconstruction (Test MSE: {test_mse:.5f})", fontsize=12)
    plt.tight_layout()
    plot_path = "experiments/plots/crop_reconstruction.png"
    plt.savefig(plot_path, dpi=200)
    plt.close()
    print(f"Reconstruction comparison plot saved to {plot_path}")

    # Save Model Weights
    bundle = {
        "model": ae,
        "img_size": img_size,
        "bottleneck_dim": 32,
        "metrics": {
            "test_reconstruction_mse": float(test_mse),
            "test_reconstruction_mae": float(test_mae),
            "training_time_sec": float(train_time)
        }
    }
    model_path = "experiments/models/crop_autoencoder.joblib"
    joblib.dump(bundle, model_path)
    print(f"Model saved to {model_path}")

    return {
        "experiment": "Experiment C: Unsupervised Crop/Weed Tile Autoencoder",
        "dataset": "Unsupervised_Crop_Detection/final_algorithm/generated_squares_4",
        "total_tiles_discovered": total_avail,
        "samples_used": len(X),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "bottleneck_dim": 32,
        "training_time_sec": round(train_time, 2),
        "test_reconstruction_mse": round(test_mse, 6),
        "test_reconstruction_mae": round(test_mae, 6),
        "artifact_path": model_path,
        "plot_path": plot_path
    }

if __name__ == "__main__":
    run_experiment()
