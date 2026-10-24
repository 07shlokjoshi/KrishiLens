import sys
import os
import joblib
import numpy as np
from PIL import Image

def predict_arabic_char(image_path):
    model_path = "experiments/models/arabic_ocr_classifier.joblib"
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Run training first.")

    bundle = joblib.load(model_path)
    model = bundle["model"]
    classes = bundle["classes"]
    img_size = bundle.get("img_size", (25, 25))

    with Image.open(image_path) as img:
        img_gray = img.convert("L").resize(img_size)
        arr = np.asarray(img_gray, dtype=np.float32) / 255.0
        X = arr.flatten().reshape(1, -1)

    pred = model.predict(X)[0]
    probs = model.predict_proba(X)[0]
    confidence = float(np.max(probs))

    return {
        "image_path": image_path,
        "predicted_char": pred,
        "confidence": round(confidence, 4),
        "classes_count": len(classes)
    }

if __name__ == "__main__":
    sample_img = "Arabic-OCR/Dataset/char_sample/ا/10.png"
    if len(sys.argv) > 1:
        sample_img = sys.argv[1]

    res = predict_arabic_char(sample_img)
    print("Arabic Character Prediction:")
    print(f"  Image:      {res['image_path']}")
    print(f"  Predicted:  {res['predicted_char']}")
    print(f"  Confidence: {res['confidence'] * 100:.2f}%")
