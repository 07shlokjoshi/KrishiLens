# KrishiLens — Pesticide Package & Label Dataset Collection & Annotation Protocol

## 1. Overview & Purpose
This document establishes the official data collection and annotation standard for training genuine computer-vision object detectors (YOLOv8, Faster R-CNN, or RT-DETR) for the KrishiLens real-time scanner.

**Current Finding**:
The three repositories present in this project (`pesticide_data_Pesti-Gen`, `Arabic-OCR`, `Unsupervised_Crop_Detection`) do not contain annotated pesticide packaging images. Rather than fabricating bounding boxes on non-pesticide datasets, this workflow outlines the exact requirements for genuine agricultural data collection, standardizes label definitions, and provides a verified pilot dataset.

---

## 2. Target Class Ontology

| Class ID | Class Name | Definition & Boundaries | Required Context |
| :---: | :--- | :--- | :--- |
| **0** | `pesticide_package` | Bounding box enclosing the entire visible pesticide container (e.g., HDPE bottle, cap, neck, pouch, sachet, drum, or box). | Include entire container including cap and base. Exclude user hands or background table. |
| **1** | `cibrc_label` | The rectangular or printed label surface carrying statutory CIB&RC text, product trade name, active ingredients, dosage, and antidote. | Tight box around the printed label sheet. |
| **2** | `toxicity_triangle` | The square diamond / triangle toxicity symbol required under Insecticides Rules 1971 (Color: Bright Red, Bright Yellow, Bright Blue, or Leaf Green). | Must tightly encapsulate the diamond boundary. |
| **3** | `cibrc_reg_stamp` | The textual region containing "CIR-[0-9]+" or "Regn No." and Manufacturing License Number. | Tight box enclosing the registration text block. |

---

## 3. Image Collection Protocol

To ensure models generalize to Indian smallholder farming environments:
1. **Container Types**:
   - Liquid Bottles (100ml, 250ml, 500ml, 1L cylindrical plastic bottles)
   - Powder Pouches / Foil Sachets (100g, 500g, 1kg heat-sealed laminate packets)
   - Granule Drums / Cartons (carton boxes, plastic cans)
2. **Lighting Variations**:
   - Direct harsh sunlight (outdoor field / farm storage)
   - Shaded retail counter / dealer shop
   - Low-light indoors / twilight
   - Flashlight & direct camera glare reflections
3. **Camera Distances & Angles**:
   - Frontal orthogonal ($0^\circ$)
   - Oblique perspective ($30^\circ - 45^\circ$)
   - Cylindrical label curvature (side view)
   - Distance: 15 cm (close-up) to 60 cm (whole bottle in hand)
4. **Negative Controls (Reject Class)**:
   - Fertilizer bags (Urea, DAP, NPK)
   - General FMCG household bottles (shampoo, cooking oil, detergent)
   - Field plants and empty hands
   - Background agricultural tools

---

## 4. Annotation Format Specification (YOLO Standard)
Each image file `image_name.png` must have a corresponding `image_name.txt` file in the same relative split folder.
Format per line:
```
<class_id> <x_center> <y_center> <width> <height>
```
*Note: All coordinates are normalized floats in the range $[0.0, 1.0]$.*

### Negative Samples:
Images containing non-pesticide objects (e.g. `label_7_non_pesticide_control.png`) have an **empty** `.txt` file (0 bytes), teaching the detector to produce zero false positives.

---

## 5. Pilot Dataset Structure
```
data/pesticide_pilot_dataset/
├── data.yaml
├── README.md
├── images/
│   ├── train/  (Training split: Clear, Low Light, Glare)
│   ├── val/    (Validation split: Rotated, Blurry)
│   └── test/   (Held-out test split: Cropped, Non-Pesticide Control)
└── labels/
    ├── train/
    ├── val/
    └── test/
```

---

## 6. Recommended Annotation Tooling
1. **CVAT (Computer Vision Annotation Tool)**: Free, open-source, web-based. Supports direct export to YOLO 1.1 format.
2. **Label Studio**: Open-source, supports AI-assisted pre-labeling.
3. **Roboflow**: Cloud-based annotation with automated augmentation and YOLOv8 export.

---

## 7. Sample Size Guidelines for Production Deployment
- **Proof of Concept (Pilot)**: 10–50 annotated images (benchmarking baseline detector).
- **Lightweight Mobile Model (YOLOv8n / Nano)**: 1,000–2,500 annotated images.
- **Production Enterprise Grade**: 5,000+ images covering 100+ major Indian pesticide formulations.
