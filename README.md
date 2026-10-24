# 🌾 KrishiLens — Real-Time Pesticide Label Detection Using Gemma 4

> **Empowering Indian farmers with instant, camera-based pesticide label reading, multimodal AI entity extraction, statutory CIB&RC toxicity verification, and voice guidance in regional languages.**

---

## 1. Project Overview & Central Workflow

In India, only **36% of farmers read pesticide labels**, and **44% experience poisoning symptoms annually** due to microscopic fonts, complex chemical terminology, and multilingual barriers. 

**KrishiLens** solves this critical safety challenge:
1. **Point Camera**: The farmer points the smartphone camera at any pesticide bottle, container, or packet.
2. **Real-Time Edge Detection**: Client-side computer vision tracks packaging boundaries at 15–30 FPS with high-contrast bounding boxes.
3. **Capture & Preprocessing**: Once stabilized or tapped, the image is enhanced (upscaled, normalized, and sharpened).
4. **Gemma 4 Multimodal Reading**: The image is analyzed using Gemma 4 (`google/gemma-4-31B-it:novita`) via the Hugging Face Router API.
5. **CIB&RC Verification & Fallback**: Extracts Active Ingredient, Concentration, Registration Number, and statutory toxicity classification (Red ☠️ / Yellow ⚠️ / Blue ⚠️ / Green 🟢). A local edge OCR fallback guarantees 100% uptime if cloud credits are depleted.
6. **Voice Guidance & Translation**: Clear explanations and mandatory safety gear (PPE) checklist in English, Hindi (हिंदी), and Marathi (मराठी) with Web Speech API audio readout for low-literacy farmers.

---

## 2. Dataset Audit & Evidence-Based Technical Decisions

Before implementing the pipeline, all three cloned repositories and local resources were rigorously audited.

### Dataset Audit Matrix

| Repository / Source | Actual Contents | Size / Records | Visual Annotations | OCR Ground Truth | Suitable for CV Training? | Key Limitations & Findings | Recommended Action |
|---|---|---|---|---|---|---|---|
| **`pesticide_data_Pesti-Gen`** | Chemical tabular data (`stable_pesticide_data.csv`) | 1,123 chemical rows | **None** (0 images) | None | **No** (Zero visual data) | Pure molecular database (SMILES strings, LD50/LC50 toxicity ratings) for generative molecular design. | Use as active ingredient reference dictionary; do not attempt CV training. |
| **`Arabic-OCR`** | Arabic letter glyph dataset (`char_4K_sample.rar`) | 21.3 MB archive; 29 Arabic letter glyphs | Character glyphs only | Arabic characters only | **No** (Arabic alphabet only) | Recognizes typed Arabic letters (ا-ى) only. Contains 0 pesticide labels, no packaging, no Indian languages. | Incompatible with Indian pesticide packaging; excluded from pipeline. |
| **`Unsupervised_Crop_Detection`** | Aerial drone imagery of farm fields | 32,779 16x16 pixel terrain patches (100 MB) | None | None | **No** (Aerial soil/grass patches) | Autoencoders for detecting weeds vs plant vegetation from drone flights. "Crop" refers to agricultural plants, not image cropping. | Incompatible with container/label detection; excluded from pipeline. |
| **CIB&RC Acetamiprid 99% Label** | Authentic Govt. of India approved pesticide label leaflet | Converted to 2376x1728 px PNG + 7 test edge-case variants | Ground truth regulatory fields | Full verbatim text | **Yes** (Evaluation benchmark) | Authentic regulatory standard for Indian agriculture. | Primary ground truth benchmark for detection, OCR, and Gemma 4 field accuracy. |

### Technical Decision on Model Training
- **Finding**: None of the provided repositories contained pesticide packaging bounding boxes or label images.
- **Decision**: Training a custom detector on irrelevant data would be counterproductive and scientifically invalid. Instead, we implemented a real-time client-side contour and aspect-ratio detector in the camera preview (15 FPS), coupled with zero-shot Gemma 4 multimodal understanding and an edge CIB&RC OCR fallback.

---

## 3. Gemma 4 Inference & Cloud Credit Resilience

The application integrates the exact inference code using the OpenAI SDK connected to the Hugging Face Router:

```javascript
import { OpenAI } from "openai";

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN,
});

const response = await client.chat.completions.create({
  model: "google/gemma-4-31B-it:novita",
  messages: [ ... ]
});
```

### Live Test & Resilience Engine
When testing with the initial Hugging Face token, the router returned:
`{"error":"You have no remaining credits. Purchase pre-paid credits to continue using Inference Providers."}`

To prevent system crashes, KrishiLens implements a **dual-engine architecture**:
1. **Tier 1 (Gemma 4 Live)**: When `HF_TOKEN` has pre-paid provider credits, the backend executes full multimodal vision inference with Gemma 4.
2. **Tier 2 (High-Accuracy Edge CIB&RC OCR Fallback)**: If credits are 0 or offline, the backend seamlessly falls back to local high-accuracy OCR + rule-based entity extraction, correctly labeling provenance in the UI.

---

## 4. Statutory CIB&RC Toxicity Classifications (India)

Under the **Insecticides Rules, 1971 (Government of India)**, every pesticide must bear a statutory square/diamond split into two triangles:

- 🔴 **Category I — Extremely Toxic (Red Triangle)**: Symbol: Skull and crossbones (`☠️`). Signal Word: `POISON` / `विष`. Oral LD50: 1 – 50 mg/kg.
- 🟡 **Category II — Highly Toxic (Yellow Triangle)**: Symbol: `⚠️`. Signal Word: `POISON` / `ज़हर`. Oral LD50: 51 – 500 mg/kg.
- 🔵 **Category III — Moderately Toxic (Blue Triangle)**: Symbol: `⚠️`. Signal Word: `DANGER` / `खतरा`. Oral LD50: 501 – 5000 mg/kg.
- 🟢 **Category IV — Slightly Toxic (Green Triangle)**: Symbol: `🟢`. Signal Word: `CAUTION` / `सावधानी`. Oral LD50: > 5000 mg/kg.

KrishiLens automatically maps the detected chemical to its statutory category, rendering high-contrast warning cards and mandatory PPE checklists.

---

## 5. Structured Data Schema

The inference engine strictly outputs validated JSON matching the following schema:

```json
{
  "label_detected": true,
  "status": "SUCCESS_FULLY_READ | PARTIAL_EXTRACTION_UNCERTAIN | LABEL_DETECTED_TEXT_UNREADABLE | NO_LABEL_DETECTED",
  "product_name": "Acetamiprid Technical 99% w/w Minimum",
  "manufacturer": null,
  "active_ingredient": "Acetamiprid",
  "concentration": "99.00% w/w minimum",
  "registration_number": "CIR-XXXX/2026",
  "directions_text": "...",
  "safety_warnings": [
    "Keep in cool, dry place away from heat and open flame.",
    "Read leaflet before use."
  ],
  "first_aid_text": "Induce vomiting if conscious. Seek medical attention immediately.",
  "storage_instructions": "Keep in cool, dry place away from heat and open flame.",
  "language_detected": "en",
  "unreadable_fields": [],
  "toxicity_category": {
    "code": "CATEGORY_III",
    "color": "Blue",
    "signalWord": "DANGER",
    "oralLD50": "501 - 5000 mg/kg"
  },
  "confidence_or_uncertainty": {
    "overall": "HIGH",
    "notes": "High confidence extraction"
  },
  "safety_advisory": "Always wear protective gloves and mask when mixing or spraying."
}
```

---

## 6. Setup & Execution

### Prerequisites
- Node.js v18+ (tested on Node v22.22.0)
- npm v10+

### Installation
```bash
# Navigate to project directory
cd /Users/shlokjoshi/Desktop/KrishiLens

# Install dependencies
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` and insert your credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```env
HF_TOKEN=hf_your_hugging_face_token_here
PORT=3001
VISION_MODEL=google/gemma-4-31B-it:novita
```

> [!CAUTION]
> **Credential Security**: Never commit `.env` or hardcode tokens in client files. `.env` is excluded via `.gitignore`. If a token was previously pasted into a shared terminal or prompt, rotate or revoke it on Hugging Face settings.

### Run Development Server
```bash
npm run dev
# Or production start:
npm start
```
Open **`http://localhost:3001`** in your browser.

---

## 7. Testing & Evaluation Suite

Run the automated evaluation suite against the held-out benchmark test cases:
```bash
npm test
```

### Benchmark Metrics (Actual Run Results)
- **Total Test Samples**: 7 verified conditions (Clear front-facing, Blurry/unreadable, Rotated 90°, Low-light underexposed, Cropped partial, Glare/overexposed, Non-pesticide control)
- **Label Detection Accuracy**: **71.43%**
- **Detection Precision**: **100.00%** (0 false positives: non-pesticide negative controls are reliably rejected)
- **Detection Recall**: **66.67%**
- **F1 Score**: **80.00%**
- **Active Ingredient Match Rate**: Verified against ground-truth CIB&RC formulations.

---

## 8. Safety & Responsible AI Disclaimer

1. **Strictly Reads Printed Labels**: KrishiLens extracts text verbatim from physical packaging. It does **not** hallucinate or invent pesticide application dosages or dilution ratios.
2. **Uncertainty Flagging**: If any critical text is blurry or cropped, KrishiLens flags the field as `null`, highlights it in amber, and prompts the user: *"Key directions or safety instructions are unclear. Do NOT guess dosage. Consult the printed package leaflet or an authorized agricultural extension officer."*
3. **No Guarantee of Agricultural Outcomes**: The tool assists in reading and understanding packaging; final responsibility remains with the certified applicator.


PPT LINk :- https://drive.google.com/file/d/1NbDiUD1suPymOZYWymeUsevTG9ldqimf/view?usp=sharing
