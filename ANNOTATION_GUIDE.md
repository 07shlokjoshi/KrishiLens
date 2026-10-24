# KrishiLens Pesticide Detection — Annotation Guide

**Purpose:** Define the four object classes for pesticide product labeling and provide clear visual and textual annotation instructions.

---

## Class Definitions

### Class 0: Pesticide Package (pesticide_package)
**Definition:** The main container body holding the pesticide product.

**What to annotate:**
- Full visible container (bottle, pouch, can, carton, sachet)
- Boundaries defined by the container's edge
- Include any attached labels that are part of the package surface
- DO NOT include space around the package

**Example shapes:**
- HDPE plastic bottle (most common)
- Foil/metallized pouch (liquid concentrates)
- Cardboard carton (powder formulations)
- Aluminum can (aerosol)
- Plastic sachet (single-use packets)

**Inclusion rule:** Any part of the actual product container

**Exclusion rule:** Background, table surface, hands holding bottle

---

### Class 1: CIB&RC Label (cibrc_label)
**Definition:** The primary rectangular text panel containing statutory warnings and product information.

**What to annotate:**
- Text area with black/dark text on white/light background
- Contains ingredient list, health warnings, usage instructions
- Usually centered or positioned on the container's front
- May include multiple languages
- Includes safety symbols and warning text

**Location hints:**
- On pesticide bottles: usually a white rectangular label
- On pouches: the main information panel
- On cans: the labeled band around the container

**Inclusion rule:** Text-heavy informational panel with product safety details

**Exclusion rule:** Brand logos alone, decorative graphics, pictorial warnings

---

### Class 2: Toxicity Triangle (toxicity_triangle)
**Definition:** The statutory CIB&RC toxicity diamond (appears as a triangle or diamond shape).

**What to annotate:**
- Color-coded warning diamond: Red, Yellow, Blue, or Green
- Center contains Roman numerals (I, II, III, or blank) or hazard symbol
- Size: typically 2-3 cm on bottle labels
- Distinctive geometric shape with high contrast

**Color meanings:**
- **Red (I/II):** Highly toxic
- **Yellow (II):** Moderately toxic
- **Blue (III):** Mildly toxic
- **Green (No symbol):** Non-toxic/Safe

**Inclusion rule:** The colored diamond/triangle shape itself (not surrounding text)

**Exclusion rule:** Other warning symbols, text explaining the triangle

---

### Class 3: CIB&RC Registration Stamp (cibrc_reg_stamp)
**Definition:** The registration number and manufacturing license region stamp.

**What to annotate:**
- Alphanumeric registration code (e.g., "CR-12-AB-2024-01234")
- May include: CIB&RC registration number, ISI mark, manufacturing batch
- Usually small text, printed on the container
- Often located on back or bottom of bottle

**Inclusion rule:** Registration/licensing stamps and numbers

**Exclusion rule:** Manufacturing date codes, barcode, general product codes

---

## Annotation Tool: LabelImg

### Installation

```bash
pip install labelImg
```

### Usage

```bash
labelImg <image_directory> <classes_file>
```

Example:
```bash
labelImg data/incoming classes.txt
```

### Step-by-Step Annotation

1. **Open Image** → File → Open Dir → select `data/incoming/`

2. **For each image:**

   a. **Draw bounding boxes** for each visible class
      - Click "Create RectBox" (or Ctrl+N)
      - Drag rectangle around the object
      - Select class from dropdown

   b. **Be precise:**
      - Draw tight boxes (minimal extra space)
      - Don't include background
      - One box per object instance
      - No overlapping boxes unless objects actually overlap

   c. **Negative controls:** If image contains NO pesticides
      - Do NOT draw any boxes
      - Save with empty labels
      - Mark as "neg" in filename

   d. **Save** → Ctrl+S (saves as YOLO `.txt` format)

3. **Quality checks:**
   - Every class present gets a box
   - No stray boxes on irrelevant objects
   - Coordinates look reasonable
   - Class labels are correct

---

## YOLO Format Specification

Each image has a corresponding `.txt` file in YOLO format:

```
<class_id> <x_center> <y_center> <width> <height>
```

**Where:**
- `class_id` = 0 (pesticide_package), 1 (cibrc_label), 2 (toxicity_triangle), or 3 (cibrc_reg_stamp)
- `x_center`, `y_center` = center coordinates (normalized to [0, 1])
- `width`, `height` = bounding box dimensions (normalized to [0, 1])

**Example:**
```
0 0.5234 0.4821 0.8456 0.7234
1 0.5234 0.4821 0.8456 0.7234
2 0.5100 0.3200 0.1400 0.2100
3 0.3500 0.8600 0.3200 0.0800
```

**For negative controls (no pesticides):** Leave `.txt` file empty

---

## Workflow for New Images

### 1. **Place Raw Images**
```bash
# Copy incoming pesticide photos to:
cp /path/to/images/*.jpg data/incoming/
```

### 2. **Create Annotations**
```bash
# Start LabelImg
labelImg data/incoming classes.txt

# Annotate each image with all 4 classes
# Save when done (Ctrl+S)
```

### 3. **Review and Validate**
```bash
# Move annotated images to reviewed folder
cp -r data/incoming/* data/reviewed/

# Check file format
python3 scripts/validate_annotations.py data/reviewed
```

### 4. **Merge with Existing Dataset**
```bash
# Run merge script (see "Merge Script" section)
.venv/bin/python scripts/merge_datasets.py \
  --existing data/pesticide_pilot_dataset \
  --new data/reviewed \
  --output data/pesticide_merged
```

### 5. **Validate Merged Dataset**
```bash
# Check for errors and duplicates
.venv/bin/python scripts/validate_dataset.py data/pesticide_merged
```

### 6. **Train Model**
```bash
# Only if validation passes ✅
.venv/bin/python experiments/yolo_train_improved.py \
  --data data/pesticide_merged/data.yaml \
  --epochs 60
```

---

## Quality Standards

### Image Quality Requirements

✅ **Good:**
- Clear, in-focus product image
- Good lighting (not too dark, not overexposed)
- Pesticide bottle visible and readable
- All four classes visible (or legitimately absent)
- Resolution ≥ 640x480 pixels

❌ **Poor (reject):**
- Blurry or out-of-focus
- Image too dark or completely blown out
- Multiple bottles overlapping (unless separated clearly)
- Only partial bottle visible
- Text illegible (can't verify annotation accuracy)
- Resolution < 480x360 pixels

### Annotation Quality Standards

✅ **Correct:**
- Each class has exactly one bounding box per instance
- Boxes fit tightly around objects
- Class IDs match the object type
- Coordinates are reasonable (not at extremes like 0.99)
- Empty labels for negative controls

❌ **Incorrect:**
- Missing classes that are visible
- Multiple boxes for single object
- Loose/oversized boxes
- Wrong class IDs
- Boxes on unrelated objects
- Negative control file contains boxes

---

## Common Mistakes and Fixes

| Mistake | What Happens | How to Fix |
|---------|-------------|-----------|
| Bounding box too loose | Model learns to detect background, not object | Redraw tighter box |
| Missing one of 4 classes | Classes underrepresented in training | Always annotate all 4 visible classes |
| Class ID off-by-one | Model confuses classes during training | Double-check class dropdown before saving |
| Coordinates outside [0,1] | Validation fails | Use LabelImg (handles normalization) |
| Empty label file but image has pesticide | Model thinks negative when positive | Ensure label file has at least one box |

---

## Class Co-occurrence Rules

For reference, in realistic pesticide images:

- **If Class 0 (pesticide_package) is present:**
  - Class 1 (cibrc_label) is almost always present
  - Class 2 (toxicity_triangle) is almost always present
  - Class 3 (registration stamp) may be present or absent

- **If Class 1, 2, or 3 is present:**
  - Class 0 must be present (they are all on the package)

- **Negative control images:**
  - Zero boxes for all classes
  - Example: water bottle, field tools, non-pesticide container

---

## Batch Annotation Best Practices

1. **Batch size:** Annotate 10-20 images at a time (avoid fatigue)
2. **Breaks:** Take 5-10 minute breaks between batches
3. **Quality control:** Have second person spot-check 10% of annotated images
4. **Version control:** Save images with metadata:
   - Filename: `pesticide_<type>_<date>_<batch>.jpg`
   - Example: `pesticide_acetamiprid_2026-10-25_batch01.jpg`
5. **Track source:** Document where each image came from

---

## Validation Command (Quick Check)

After annotation, validate before merging:

```bash
# Single image validation
.venv/bin/python3 << 'EOF'
from pathlib import Path

img_file = Path("data/reviewed/image_name.jpg")
label_file = Path("data/reviewed/image_name.txt")

# Check file pair
assert img_file.exists(), f"Missing image: {img_file}"
assert label_file.exists(), f"Missing label: {label_file}"

# Check YOLO format
with open(label_file) as f:
    for line in f:
        parts = line.split()
        assert len(parts) == 5, f"Expected 5 fields, got {len(parts)}"
        class_id, cx, cy, w, h = int(parts[0]), *map(float, parts[1:])
        assert 0 <= class_id < 4, f"Invalid class: {class_id}"
        assert 0 <= cx <= 1, f"cx out of range: {cx}"
        assert 0 <= cy <= 1, f"cy out of range: {cy}"
        assert 0 <= w <= 1, f"w out of range: {w}"
        assert 0 <= h <= 1, f"h out of range: {h}"

print("✅ Label format valid")
EOF
```

---

## Next Steps

1. **Collect pesticide images** (see "Sources" below)
2. **Annotate using LabelImg** (follow workflow above)
3. **Validate annotations** (run validation script)
4. **Merge with existing dataset** (run merge script)
5. **Retrain model** (run training script)
6. **Evaluate** (run evaluation script)

---

## Image Sources

**Legal sources for pesticide product images:**

- CIB&RC public database: [https://www.cibrc.nic.in/](https://www.cibrc.nic.in/)
- Agricultural retailer product pages
- Manufacturer websites (Syngenta, Bayer, FMC, BASF India)
- Personal collection from agricultural markets
- Research institution pesticide archives

**Always:**
- Document source URL or location
- Verify image resolution is adequate
- Ensure label is clearly readable
- Get permission if required (manufacturer logos)

---

## Support

For issues with annotation:
1. Check "Common Mistakes" section
2. Review YOLO format specification
3. Run validation script for detailed error messages
4. Verify image quality meets standards

