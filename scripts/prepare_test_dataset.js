import fs from "fs";
import path from "path";
import sharp from "sharp";

const DATA_DIR = path.resolve("data");
const TEST_IMG_DIR = path.join(DATA_DIR, "test_images");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEST_IMG_DIR)) fs.mkdirSync(TEST_IMG_DIR, { recursive: true });

async function prepareDataset() {
  console.log("Preparing KrishiLens Test & Evaluation Dataset...");

  const baseAcetamiprid = path.resolve("test_acetamiprid.png");
  if (!fs.existsSync(baseAcetamiprid)) {
    console.error("Base image test_acetamiprid.png not found!");
    process.exit(1);
  }

  // 1. Clear Authentic Label (Upscaled 300 DPI equivalent for clean regulatory text)
  const p1 = path.join(TEST_IMG_DIR, "label_1_clear_acetamiprid.png");
  await sharp(baseAcetamiprid)
    .resize({ width: 2376, height: 1728 })
    .sharpen()
    .png()
    .toFile(p1);
  console.log("Created:", p1);

  // 2. Blurry Label (Gaussian blur radius 9)
  const p2 = path.join(TEST_IMG_DIR, "label_2_blurry_acetamiprid.png");
  await sharp(baseAcetamiprid).blur(9).png().toFile(p2);
  console.log("Created:", p2);

  // 3. Rotated Label (90 degrees)
  const p3 = path.join(TEST_IMG_DIR, "label_3_rotated_acetamiprid.png");
  await sharp(baseAcetamiprid).rotate(90).png().toFile(p3);
  console.log("Created:", p3);

  // 4. Low Light Label (Darkened: brightness 0.35, contrast 0.8)
  const p4 = path.join(TEST_IMG_DIR, "label_4_low_light_acetamiprid.png");
  await sharp(baseAcetamiprid)
    .modulate({ brightness: 0.35, saturation: 0.8 })
    .png()
    .toFile(p4);
  console.log("Created:", p4);

  // 5. Cropped Partial Label (Extract center 50%)
  const p5 = path.join(TEST_IMG_DIR, "label_5_cropped_acetamiprid.png");
  const meta = await sharp(baseAcetamiprid).metadata();
  await sharp(baseAcetamiprid)
    .extract({
      left: Math.floor(meta.width * 0.2),
      top: Math.floor(meta.height * 0.2),
      width: Math.floor(meta.width * 0.6),
      height: Math.floor(meta.height * 0.6),
    })
    .png()
    .toFile(p5);
  console.log("Created:", p5);

  // 6. Glare / Overexposed Label
  const p6 = path.join(TEST_IMG_DIR, "label_6_glare_acetamiprid.png");
  await sharp(baseAcetamiprid)
    .modulate({ brightness: 1.8, saturation: 0.5 })
    .png()
    .toFile(p6);
  console.log("Created:", p6);

  // 7. Non-pesticide Control Object
  const p7 = path.join(TEST_IMG_DIR, "label_7_non_pesticide_control.png");
  const micPath = "/Users/shlokjoshi/Downloads/spotlight-illuminates-a-vintage-microphone-on-the-stage-of-a-theater-during-a-performance-photo.jpeg";
  if (fs.existsSync(micPath)) {
    await sharp(micPath).resize(600, 450).png().toFile(p7);
  } else {
    // Generate solid color dummy
    await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 50, g: 80, b: 120 }
      }
    }).png().toFile(p7);
  }
  console.log("Created:", p7);

  // 8. Ground Truth JSON
  const groundTruth = {
    metadata: {
      generated_at: new Date().toISOString(),
      standards: "CIB&RC (Central Insecticides Board & Registration Committee, India)",
      description: "Evaluation benchmark for KrishiLens pesticide label reading and structured extraction"
    },
    test_cases: [
      {
        id: "label_1_clear_acetamiprid",
        filename: "label_1_clear_acetamiprid.png",
        category: "clear_front_facing",
        expected_label_detected: true,
        expected_product_name: "Acetamiprid Technical 99% w/w Minimum",
        expected_active_ingredient: "Acetamiprid",
        expected_concentration: "99.00% w/w minimum",
        expected_toxicity_class: "MODERATELY_TOXIC",
        expected_toxicity_color: "Blue",
        critical_safety_phrases: [
          "Keep out of reach of children",
          "Read leaflet before use",
          "Keep in cool, dry place"
        ],
        should_succeed: true
      },
      {
        id: "label_2_blurry_acetamiprid",
        filename: "label_2_blurry_acetamiprid.png",
        category: "blurry_unreadable",
        expected_label_detected: true,
        should_flag_unreadable: true,
        should_succeed: false
      },
      {
        id: "label_3_rotated_acetamiprid",
        filename: "label_3_rotated_acetamiprid.png",
        category: "rotated_90deg",
        expected_label_detected: true,
        expected_active_ingredient: "Acetamiprid",
        should_succeed: true
      },
      {
        id: "label_4_low_light_acetamiprid",
        filename: "label_4_low_light_acetamiprid.png",
        category: "low_light_underexposed",
        expected_label_detected: true,
        should_succeed: true
      },
      {
        id: "label_5_cropped_acetamiprid",
        filename: "label_5_cropped_acetamiprid.png",
        category: "cropped_partial",
        expected_label_detected: true,
        should_flag_unreadable: true
      },
      {
        id: "label_6_glare_acetamiprid",
        filename: "label_6_glare_acetamiprid.png",
        category: "glare_overexposed",
        expected_label_detected: true
      },
      {
        id: "label_7_non_pesticide_control",
        filename: "label_7_non_pesticide_control.png",
        category: "non_pesticide_negative_control",
        expected_label_detected: false,
        should_reject: true
      }
    ]
  };

  const gtPath = path.join(DATA_DIR, "ground_truth.json");
  fs.writeFileSync(gtPath, JSON.stringify(groundTruth, null, 2));
  console.log("Ground truth saved:", gtPath);
}

prepareDataset().catch(console.error);
