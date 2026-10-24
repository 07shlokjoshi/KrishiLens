import os
import glob
import json
import shutil
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

def transform_box(box, transform_type, img_w, img_h, param=None):
    """
    Transforms normalized [cls, xc, yc, w, h] under geometric transforms.
    Returns transformed normalized box [cls, xc, yc, w, h].
    """
    cls_id, xc, yc, w, h = box
    
    if transform_type == "hflip":
        new_xc = 1.0 - xc
        return [cls_id, new_xc, yc, w, h]
        
    elif transform_type == "scale":
        # zoom in/out around center
        scale_factor = param # e.g. 0.85 or 1.15
        new_w = min(1.0, max(0.01, w * scale_factor))
        new_h = min(1.0, max(0.01, h * scale_factor))
        # Keep center aligned
        return [cls_id, xc, yc, new_w, new_h]
        
    elif transform_type == "translate":
        dx, dy = param # normalized shifts e.g. (+0.04, -0.03)
        new_xc = min(0.98, max(0.02, xc + dx))
        new_yc = min(0.98, max(0.02, yc + dy))
        return [cls_id, new_xc, new_yc, w, h]
        
    return box

def expand_training_dataset(base_dir="data/pesticide_pilot_dataset"):
    print("=================================================================")
    print("🌾 EXPANDING PESTICIDE PACKAGING DATASET WITH REALISTIC VARIATIONS")
    print("=================================================================")

    train_img_dir = os.path.join(base_dir, "images", "train")
    train_lbl_dir = os.path.join(base_dir, "labels", "train")

    original_images = sorted(glob.glob(os.path.join(train_img_dir, "*.png")))
    print(f"Found {len(original_images)} initial base training images.")

    created_count = 0

    for img_path in original_images:
        base_name = os.path.splitext(os.path.basename(img_path))[0]
        # Skip if already an augmented image
        if "_aug_" in base_name:
            continue

        lbl_path = os.path.join(train_lbl_dir, base_name + ".txt")
        if not os.path.exists(lbl_path):
            continue

        # Load boxes
        boxes = []
        with open(lbl_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 5:
                    boxes.append([int(parts[0])] + [float(x) for x in parts[1:]])

        with Image.open(img_path) as img:
            img = img.convert("RGB")
            w, h = img.size

            # 1. Variation: Warm Morning Sun (Color temperature shift + slight brightness)
            im_warm = ImageEnhance.Color(img).enhance(1.25)
            im_warm = ImageEnhance.Brightness(im_warm).enhance(1.10)
            name_warm = f"{base_name}_aug_warm"
            im_warm.save(os.path.join(train_img_dir, f"{name_warm}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_warm}.txt"), "w") as f:
                for b in boxes:
                    f.write(f"{b[0]} {b[1]:.4f} {b[2]:.4f} {b[3]:.4f} {b[4]:.4f}\n")
            created_count += 1

            # 2. Variation: High Contrast Field Glare (Harsh noon daylight)
            im_contrast = ImageEnhance.Contrast(img).enhance(1.35)
            name_contrast = f"{base_name}_aug_contrast"
            im_contrast.save(os.path.join(train_img_dir, f"{name_contrast}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_contrast}.txt"), "w") as f:
                for b in boxes:
                    f.write(f"{b[0]} {b[1]:.4f} {b[2]:.4f} {b[3]:.4f} {b[4]:.4f}\n")
            created_count += 1

            # 3. Variation: Slight Handheld Motion Defocus (Blur radius 2.0)
            im_defocus = img.filter(ImageFilter.GaussianBlur(radius=1.8))
            name_defocus = f"{base_name}_aug_defocus"
            im_defocus.save(os.path.join(train_img_dir, f"{name_defocus}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_defocus}.txt"), "w") as f:
                for b in boxes:
                    f.write(f"{b[0]} {b[1]:.4f} {b[2]:.4f} {b[3]:.4f} {b[4]:.4f}\n")
            created_count += 1

            # 4. Variation: Distance Zoom / Scale (+10% scale)
            im_zoom = img.resize((int(w * 1.08), int(h * 1.08)), Image.Resampling.LANCZOS)
            # Crop back to original dimensions
            left = (im_zoom.width - w) // 2
            top = (im_zoom.height - h) // 2
            im_zoom = im_zoom.crop((left, top, left + w, top + h))
            name_zoom = f"{base_name}_aug_zoom"
            im_zoom.save(os.path.join(train_img_dir, f"{name_zoom}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_zoom}.txt"), "w") as f:
                for b in boxes:
                    new_b = transform_box(b, "scale", w, h, param=1.08)
                    f.write(f"{new_b[0]} {new_b[1]:.4f} {new_b[2]:.4f} {new_b[3]:.4f} {new_b[4]:.4f}\n")
            created_count += 1

            # 5. Variation: Slight Camera Angle Translation (Shift center by -3% X, +2% Y)
            im_shift = Image.new("RGB", (w, h), (18, 26, 22))
            dx_px = int(w * -0.03)
            dy_px = int(h * 0.02)
            im_shift.paste(img, (dx_px, dy_px))
            name_shift = f"{base_name}_aug_shift"
            im_shift.save(os.path.join(train_img_dir, f"{name_shift}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_shift}.txt"), "w") as f:
                for b in boxes:
                    new_b = transform_box(b, "translate", w, h, param=(-0.03, 0.02))
                    f.write(f"{new_b[0]} {new_b[1]:.4f} {new_b[2]:.4f} {new_b[3]:.4f} {new_b[4]:.4f}\n")
            created_count += 1

            # 6. Variation: Horizontal Perspective Mirror (Flipped package view)
            im_hflip = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            name_hflip = f"{base_name}_aug_hflip"
            im_hflip.save(os.path.join(train_img_dir, f"{name_hflip}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_hflip}.txt"), "w") as f:
                for b in boxes:
                    new_b = transform_box(b, "hflip", w, h)
                    f.write(f"{new_b[0]} {new_b[1]:.4f} {new_b[2]:.4f} {new_b[3]:.4f} {new_b[4]:.4f}\n")
            created_count += 1

            # 7. Variation: Dim Farm Twilight / Storage Room (Underexposed 0.55)
            im_dim = ImageEnhance.Brightness(img).enhance(0.55)
            name_dim = f"{base_name}_aug_dim"
            im_dim.save(os.path.join(train_img_dir, f"{name_dim}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_dim}.txt"), "w") as f:
                for b in boxes:
                    f.write(f"{b[0]} {b[1]:.4f} {b[2]:.4f} {b[3]:.4f} {b[4]:.4f}\n")
            created_count += 1

            # 8. Variation: High Grain / Mobile Sensor Noise
            noise = np.random.normal(0, 12, (h, w, 3)).astype(np.float32)
            im_arr = np.array(img, dtype=np.float32) + noise
            im_arr = np.clip(im_arr, 0, 255).astype(np.uint8)
            im_noise = Image.fromarray(im_arr)
            name_noise = f"{base_name}_aug_noise"
            im_noise.save(os.path.join(train_img_dir, f"{name_noise}.png"))
            with open(os.path.join(train_lbl_dir, f"{name_noise}.txt"), "w") as f:
                for b in boxes:
                    f.write(f"{b[0]} {b[1]:.4f} {b[2]:.4f} {b[3]:.4f} {b[4]:.4f}\n")
            created_count += 1

    # Add 2 Negative Control Samples to train split (e.g. household items with 0 labels)
    neg_1 = os.path.join(train_img_dir, "neg_sample_field_tool.png")
    if not os.path.exists(neg_1):
        Image.new("RGB", (640, 480), (60, 75, 65)).save(neg_1)
        open(os.path.join(train_lbl_dir, "neg_sample_field_tool.txt"), "w").close()
        created_count += 1

    neg_2 = os.path.join(train_img_dir, "neg_sample_water_bottle.png")
    if not os.path.exists(neg_2):
        Image.new("RGB", (640, 480), (85, 95, 110)).save(neg_2)
        open(os.path.join(train_lbl_dir, "neg_sample_water_bottle.txt"), "w").close()
        created_count += 1

    total_train = len(glob.glob(os.path.join(train_img_dir, "*.png")))
    print(f"✅ Generated {created_count} augmented variations and negative samples.")
    print(f"Total training images now available: {total_train}")

if __name__ == "__main__":
    expand_training_dataset()
