import os
import sys
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image

class ArabicCharCNN(nn.Module):
    def __init__(self, num_classes=29):
        super(ArabicCharCNN, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.1),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Dropout2d(0.2),
        )
        self.classifier = nn.Sequential(
            nn.Linear(64 * 7 * 7, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

def predict(image_path, checkpoint_path="experiments/training_25_epochs/best_model.pt"):
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}. Run train.py first.")

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    
    classes = checkpoint["classes"]
    idx_to_class = checkpoint["idx_to_class"]

    model = ArabicCharCNN(num_classes=len(classes)).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.5,), (0.5,))
    ])

    with Image.open(image_path) as img:
        img_gray = img.convert("L").resize((28, 28))
        tensor = transform(img_gray).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(tensor)
        probs = torch.softmax(output, dim=1).squeeze(0)
        top_probs, top_indices = torch.topk(probs, 3)

    pred_idx = top_indices[0].item()
    pred_char = idx_to_class[pred_idx]
    pred_conf = top_probs[0].item()

    top_3 = []
    for p, idx in zip(top_probs, top_indices):
        top_3.append({
            "character": idx_to_class[idx.item()],
            "confidence_pct": round(p.item() * 100, 2)
        })

    return {
        "image": image_path,
        "predicted_character": pred_char,
        "confidence_pct": round(pred_conf * 100, 2),
        "top_3_predictions": top_3,
        "model_epoch": checkpoint.get("epoch")
    }

if __name__ == "__main__":
    sample_img = "Arabic-OCR/Dataset/char_sample/ا/10.png"
    if len(sys.argv) > 1:
        sample_img = sys.argv[1]

    result = predict(sample_img)
    print("=================================================")
    print("🔤 Arabic Character CNN Inference Result")
    print("=================================================")
    print(f"Image:               {result['image']}")
    print(f"Predicted Character: {result['predicted_character']}")
    print(f"Confidence:          {result['confidence_pct']}%")
    print(f"Checkpoint Epoch:    {result['model_epoch']}")
    print("Top 3 Candidates:")
    for c in result['top_3_predictions']:
        print(f"  - {c['character']}: {c['confidence_pct']}%")
    print("=================================================")
