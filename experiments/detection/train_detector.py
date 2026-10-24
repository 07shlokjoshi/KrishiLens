import os
import shutil
import json
import torch
from ultralytics import YOLO

def main():
    print("=================================================================")
    print("🚀 TRAINING KRISHILENS PESTICIDE LABEL DETECTOR (YOLOv8n)")
    print("=================================================================")

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Hardware Acceleration Device: {device}")

    data_yaml = os.path.abspath("data/pesticide_pilot_dataset/data.yaml")
    if not os.path.exists(data_yaml):
        raise FileNotFoundError(f"Dataset config not found at {data_yaml}")

    # Output directories
    exp_dir = os.path.abspath("experiments/detection")
    weights_dir = os.path.join(exp_dir, "weights")
    os.makedirs(weights_dir, exist_ok=True)

    # Load lightweight pretrained YOLOv8n detector
    print("Initializing YOLOv8n with pretrained COCO weights...")
    model = YOLO("yolov8n.pt")

    # Fine-tune model for 25 complete epochs on custom pesticide classes
    epochs = 25
    batch_size = 8
    img_size = 640

    print(f"Starting training for {epochs} complete epochs on {device}...")
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        device=device,
        project=exp_dir,
        name="krishilens_run",
        exist_ok=True,
        seed=42,
        optimizer="AdamW",
        lr0=0.002,
        verbose=True
    )

    # Copy best and last weights to weights_dir
    run_weights = os.path.join(exp_dir, "krishilens_run", "weights")
    best_src = os.path.join(run_weights, "best.pt")
    last_src = os.path.join(run_weights, "last.pt")

    best_dst = os.path.join(weights_dir, "best.pt")
    last_dst = os.path.join(weights_dir, "final.pt")

    if os.path.exists(best_src):
        shutil.copy(best_src, best_dst)
        print(f"⭐ Best validation checkpoint saved to: {best_dst}")
    if os.path.exists(last_src):
        shutil.copy(last_src, last_dst)
        print(f"📦 Final epoch checkpoint saved to: {last_dst}")

    print("\nTraining completed successfully!")

if __name__ == "__main__":
    main()
