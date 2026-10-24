import { GemmaService } from "./gemmaService.js";
import { OcrService } from "./ocrService.js";
import { ValidationService } from "./validationService.js";
import { DetectorService } from "./detectorService.js";

export class InferenceEngine {
  constructor() {
    this.gemmaService = new GemmaService();
    this.ocrService = new OcrService();
    this.validationService = new ValidationService();
    this.detectorService = new DetectorService();
  }

  /**
   * Main scan execution pipeline
   * @param {string | Buffer} imageInput - Base64 Data URI or buffer
   * @param {object} options
   */
  async processLabel(imageInput, options = {}) {
    const startTime = Date.now();
    let gemmaResult = null;
    let ocrResult = null;
    let fallbackTriggered = false;
    let fallbackReason = null;

    // Run Object Detection in parallel with label extraction
    const detectionPromise = this.detectorService.detectObjects(imageInput).catch((err) => {
      console.warn("Detection failed in inferenceEngine:", err.message);
      return { success: false, detections: [], error: err.message };
    });

    let resultPayload = null;

    // 1. Attempt Cloud Gemma 4 Inference
    if (!options.forceLocalOcr) {
      try {
        gemmaResult = await this.gemmaService.extractLabelInfo(imageInput);
        if (gemmaResult.success) {
          const validated = this.validationService.validateAndEnrich(
            gemmaResult.data,
            "Gemma 4 (google/gemma-4-31B-it:novita via HF Router)"
          );
          resultPayload = {
            ...validated,
            raw_model_response: gemmaResult.raw
          };
        } else {
          fallbackTriggered = true;
          fallbackReason = gemmaResult.errorType || gemmaResult.message;
        }
      } catch (err) {
        fallbackTriggered = true;
        fallbackReason = err.message;
      }
    } else {
      fallbackTriggered = true;
      fallbackReason = "USER_REQUESTED_LOCAL_OCR";
    }

    // 2. High-Accuracy Local OCR & CIB&RC Fallback
    if (!resultPayload) {
      try {
        ocrResult = await this.ocrService.processImage(imageInput);
        const provenanceLabel = fallbackReason === "CREDIT_LIMIT_REACHED"
          ? "Local CIB&RC OCR Engine (Hugging Face Router Account Out of Credits)"
          : `Local CIB&RC OCR Engine (${fallbackReason || "Fallback"})`;

        const validated = this.validationService.validateAndEnrich(
          ocrResult.parsed,
          provenanceLabel
        );

        resultPayload = {
          ...validated,
          ocr_confidence: ocrResult.confidence,
          fallback_details: {
            triggered: fallbackTriggered,
            reason: fallbackReason
          }
        };
      } catch (ocrErr) {
        resultPayload = {
          label_detected: false,
          status: "API_FAILURE",
          error_message: "Both Gemma 4 and local OCR failed: " + ocrErr.message,
          safety_advisory: "System was unable to process the camera frame. Please check permissions or upload a clearer photo."
        };
      }
    }

    // Await real model detections
    const detectionResult = await detectionPromise;
    const detections = (detectionResult && detectionResult.detections) || [];

    return {
      ...resultPayload,
      detections,
      detection_model: detectionResult.model_version || "YOLOv8n-KrishiLens-v1.0",
      detection_count: detections.length,
      latency_ms: Date.now() - startTime
    };
  }
}

