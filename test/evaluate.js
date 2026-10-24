import fs from "fs";
import path from "path";
import { InferenceEngine } from "../src/services/inferenceEngine.js";

async function runEvaluation() {
  console.log("=========================================================");
  console.log("🧪 KRISHILENS COMPREHENSIVE BENCHMARK EVALUATION");
  console.log("=========================================================\n");

  const gtPath = path.resolve("data/ground_truth.json");
  if (!fs.existsSync(gtPath)) {
    console.error("Ground truth file missing! Run npm run prepare-data first.");
    process.exit(1);
  }

  const gt = JSON.parse(fs.readFileSync(gtPath, "utf-8"));
  const testCases = gt.test_cases;

  const engine = new InferenceEngine();

  const results = [];
  let tp = 0; // True positive label detection
  let fp = 0; // False positive
  let tn = 0; // True negative (rejected non-pesticide)
  let fn = 0; // False negative
  let fieldMatches = {
    active_ingredient: 0,
    concentration: 0,
    toxicity_classified: 0,
    unreadable_correctly_flagged: 0
  };
  let totalPesticideCases = 0;

  for (const tc of testCases) {
    const imgPath = path.resolve("data/test_images", tc.filename);
    console.log(`Evaluating [${tc.id}] (${tc.category})...`);

    if (!fs.existsSync(imgPath)) {
      console.warn(`  Image not found: ${imgPath}`);
      continue;
    }

    const imgBuffer = fs.readFileSync(imgPath);
    const start = Date.now();
    // Force local OCR fallback if cloud credits are 0 to get reliable deterministic benchmark
    const res = await engine.processLabel(imgBuffer, { forceLocalOcr: true });
    const duration = Date.now() - start;

    const detected = res.label_detected;
    const isPesticide = !tc.should_reject;

    if (isPesticide) {
      totalPesticideCases++;
      if (detected) {
        tp++;
      } else {
        fn++;
      }
    } else {
      if (!detected) {
        tn++;
      } else {
        fp++;
      }
    }

    // Check field-level matches
    let aiMatch = false;
    let concMatch = false;
    let toxMatch = false;
    let unreadableFlagMatch = false;

    if (tc.expected_active_ingredient) {
      aiMatch = res.active_ingredient && res.active_ingredient.toLowerCase().includes(tc.expected_active_ingredient.toLowerCase());
      if (aiMatch) fieldMatches.active_ingredient++;
    }

    if (tc.expected_concentration) {
      concMatch = Boolean(res.concentration);
      if (concMatch) fieldMatches.concentration++;
    }

    if (res.toxicity_category) {
      toxMatch = true;
      fieldMatches.toxicity_classified++;
    }

    if (tc.should_flag_unreadable) {
      unreadableFlagMatch = res.unreadable_fields && res.unreadable_fields.length > 0;
      if (unreadableFlagMatch) fieldMatches.unreadable_correctly_flagged++;
    }

    results.push({
      id: tc.id,
      category: tc.category,
      label_detected: detected,
      status: res.status,
      active_ingredient: res.active_ingredient,
      concentration: res.concentration,
      toxicity_category: res.toxicity_category?.code,
      unreadable_fields_count: res.unreadable_fields?.length || 0,
      latency_ms: duration,
      ai_matched: aiMatch,
      conc_matched: concMatch,
      unreadable_flagged_correctly: unreadableFlagMatch
    });

    console.log(`  -> Detected: ${detected} | Status: ${res.status} | AI: ${res.active_ingredient || "None"} | Latency: ${duration}ms`);
  }

  // Calculate metrics
  const precision = (tp + fp) > 0 ? (tp / (tp + fp)) : 0;
  const recall = (tp + fn) > 0 ? (tp / (tp + fn)) : 0;
  const accuracy = (tp + tn) / (tp + tn + fp + fn);
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const summary = {
    evaluated_at: new Date().toISOString(),
    total_samples: testCases.length,
    label_detection_metrics: {
      true_positives: tp,
      false_positives: fp,
      true_negatives: tn,
      false_negatives: fn,
      precision: Number((precision * 100).toFixed(2)),
      recall: Number((recall * 100).toFixed(2)),
      accuracy: Number((accuracy * 100).toFixed(2)),
      f1_score: Number((f1 * 100).toFixed(2))
    },
    field_level_accuracy: {
      active_ingredient_extraction: `${fieldMatches.active_ingredient} / ${totalPesticideCases}`,
      concentration_extraction: `${fieldMatches.concentration} / ${totalPesticideCases}`,
      toxicity_classification: `${fieldMatches.toxicity_classified} / ${totalPesticideCases}`,
      unreadable_uncertainty_handling: `${fieldMatches.unreadable_correctly_flagged} / 2`
    },
    test_case_results: results
  };

  const outPath = path.resolve("data/evaluation_results.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log("\n=========================================================");
  console.log("📊 EVALUATION METRICS REPORT (ACTUAL GROUND-TRUTH BENCHMARK)");
  console.log("=========================================================");
  console.log(`Total Samples:           ${summary.total_samples}`);
  console.log(`Detection Accuracy:      ${summary.label_detection_metrics.accuracy}%`);
  console.log(`Detection Precision:     ${summary.label_detection_metrics.precision}%`);
  console.log(`Detection Recall:        ${summary.label_detection_metrics.recall}%`);
  console.log(`F1 Score:                ${summary.label_detection_metrics.f1_score}%`);
  console.log(`AI Field Accuracy:       ${summary.field_level_accuracy.active_ingredient_extraction}`);
  console.log(`Concentration Accuracy:  ${summary.field_level_accuracy.concentration_extraction}`);
  console.log(`Results saved to:        ${outPath}`);
  console.log("=========================================================\n");

  await engine.ocrService.terminate();
}

runEvaluation().catch(console.error);
