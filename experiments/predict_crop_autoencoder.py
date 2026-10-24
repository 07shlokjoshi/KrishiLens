import sys
import os
import joblib
import numpy as np
from PIL import Image
from sklearn.metrics import mean_squared_error

def compute_reconstruction_anomaly(image_path):
    model_path = "experiments/models/crop_autoencoder.joblib"
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Run training first.")

    bundle = joblib.load(model_path)
    ae = bundle["model"]
    img_size = bundle.get("img_size", (16, 16))

    with Image.open(image_path) as img:
        img_resized = img.convert("RGB").resize(img_size)
        arr = np.asarray(img_resized, dtype=np.float32) / 255.0
        X = arr.flatten().reshape(1, -1)

    X_recon = ae.predict(X)
    mse = float(mean_squared_error(X, X_recon))

    return {
        "image_path": image_path,
        "reconstruction_error_mse": round(mse, 6),
        "interpretation": "High reconstruction error (> 0.05) indicates anomalous pattern (e.g. weed or non-crop feature)."
    }

if __name__ == "__main__":
    sample_tile = "Unsupervised_Crop_Detection/final_algorithm/generated_squares_4/example_L2072_T2248.JPG"
    if len(sys.argv) > 1:
        sample_tile = sys.argv[1]

    res = compute_reconstruction_anomaly(sample_tile)
    print("Tile Reconstruction Anomaly Score:")
    print(f"  Image: {res['image_path']}")
    print(f"  MSE:   {res['reconstruction_error_mse']}")
    print(f"  Note:  {res['interpretation']}")
