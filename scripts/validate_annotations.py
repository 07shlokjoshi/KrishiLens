import os
import glob
from PIL import Image

def validate_dataset(dataset_root="data/pesticide_pilot_dataset"):
    print(f"=================================================")
    print(f"🔍 Validating Dataset at: {dataset_root}")
    print(f"=================================================")

    splits = ["train", "val", "test"]
    total_images = 0
    total_boxes = 0
    class_counts = {0: 0, 1: 0, 2: 0, 3: 0}
    class_names = {
        0: "pesticide_package",
        1: "cibrc_label",
        2: "toxicity_triangle",
        3: "cibrc_reg_stamp"
    }

    errors = []

    for split in splits:
        img_dir = os.path.join(dataset_root, "images", split)
        lbl_dir = os.path.join(dataset_root, "labels", split)

        if not os.path.exists(img_dir) or not os.path.exists(lbl_dir):
            errors.append(f"Missing split directory: {img_dir} or {lbl_dir}")
            continue

        images = sorted(glob.glob(os.path.join(img_dir, "*.png")) + glob.glob(os.path.join(img_dir, "*.jpg")))
        print(f"\n📂 Split: '{split}' ({len(images)} images)")

        for img_path in images:
            total_images += 1
            base = os.path.splitext(os.path.basename(img_path))[0]
            lbl_path = os.path.join(lbl_dir, base + ".txt")

            if not os.path.exists(lbl_path):
                errors.append(f"Missing label file for image: {img_path}")
                continue

            with Image.open(img_path) as im:
                w_px, h_px = im.size

            with open(lbl_path, "r") as f:
                lines = [line.strip() for line in f if line.strip()]

            if len(lines) == 0:
                print(f"  ✓ {base}.png: NEGATIVE SAMPLE (0 bounding boxes)")
                continue

            print(f"  ✓ {base}.png ({w_px}x{h_px}): {len(lines)} bounding box(es)")

            for i, line in enumerate(lines):
                parts = line.split()
                if len(parts) != 5:
                    errors.append(f"{lbl_path}: line {i+1} has {len(parts)} tokens, expected 5.")
                    continue

                cls_id = int(parts[0])
                xc, yc, bw, bh = map(float, parts[1:])

                if cls_id not in class_names:
                    errors.append(f"{lbl_path}: invalid class ID {cls_id}")

                if not (0.0 <= xc <= 1.0 and 0.0 <= yc <= 1.0 and 0.0 <= bw <= 1.0 and 0.0 <= bh <= 1.0):
                    errors.append(f"{lbl_path}: out-of-bounds coordinate: {parts}")

                class_counts[cls_id] = class_counts.get(cls_id, 0) + 1
                total_boxes += 1

    print("\n-------------------------------------------------")
    print("📊 PILOT DATASET CLASS DISTRIBUTION:")
    for cid, name in class_names.items():
        print(f"  Class {cid} ({name:18s}): {class_counts.get(cid, 0)} instances")
    print(f"\nTotal Images: {total_images} | Total Boxes: {total_boxes}")

    if errors:
        print(f"\n❌ Validation failed with {len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        return False
    else:
        print("\n✅ DATASET INTEGRITY VERIFIED: All annotations are within normalized bounds and match image splits.")
        return True

if __name__ == "__main__":
    validate_dataset()
