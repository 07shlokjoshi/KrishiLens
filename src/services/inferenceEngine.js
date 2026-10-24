import { GemmaService } from "./gemmaService.js";
import { OcrService } from "./ocrService.js";
import { ValidationService } from "./validationService.js";

export class InferenceEngine {
  constructor() {
    this.gemmaService = new GemmaService();
    this.ocrService = new OcrService();
    this.validationService = new ValidationService();
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

    // 1. Attempt Cloud Gemma 4 Inference
    if (!options.forceLocalOcr) {
      try {
        gemmaResult = await this.gemmaService.extractLabelInfo(imageInput);
        if (gemmaResult.success) {
          const validated = this.validationService.validateAndEnrich(
            gemmaResult.data,
            "Gemma 4 (google/gemma-4-31B-it:novita via HF Router)"
          );
          return {
            ...validated,
            latency_ms: Date.now() - startTime,
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
    try {
      ocrResult = await this.ocrService.processImage(imageInput);
      const provenanceLabel = fallbackReason === "CREDIT_LIMIT_REACHED"
        ? "Local CIB&RC OCR Engine (Hugging Face Router Account Out of Credits)"
        : `Local CIB&RC OCR Engine (${fallbackReason || "Fallback"})`;

      const validated = this.validationService.validateAndEnrich(
        ocrResult.parsed,
        provenanceLabel
      );

      return {
        ...validated,
        latency_ms: Date.now() - startTime,
        ocr_confidence: ocrResult.confidence,
        fallback_details: {
          triggered: fallbackTriggered,
          reason: fallbackReason
        }
      };
    } catch (ocrErr) {
      return {
        label_detected: false,
        status: "API_FAILURE",
        error_message: "Both Gemma 4 and local OCR failed: " + ocrErr.message,
        latency_ms: Date.now() - startTime,
        safety_advisory: "System was unable to process the camera frame. Please check permissions or upload a clearer photo."
      };
    }
  }
}
