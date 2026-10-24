/**
 * KrishiLens YOLO Inference Service (Node.js bridge to Python FastAPI sidecar)
 * =============================================================================
 * Calls the Python YOLO server (port 5001) for real object detection.
 * Falls back gracefully if the YOLO server is not running.
 *
 * Detection response shape:
 *   {
 *     model_source, device, image_width, image_height,
 *     num_detections,
 *     detections: [{ class_id, class_name, confidence, color, bbox_norm, bbox_pixels }],
 *     latency_ms, model_metrics
 *   }
 */

const YOLO_SERVER_URL = process.env.YOLO_SERVER_URL || "http://localhost:5001";
const YOLO_TIMEOUT_MS = parseInt(process.env.YOLO_TIMEOUT_MS || "10000", 10);

export class YoloService {
  constructor() {
    this.serverUrl = YOLO_SERVER_URL;
    this.available = null; // null = unknown, true/false = checked
    this.lastHealthCheck = 0;
    this.healthCheckIntervalMs = 30_000;
  }

  /**
   * Check if the YOLO Python server is healthy.
   * Caches result for 30s to avoid spamming.
   */
  async checkHealth() {
    const now = Date.now();
    if (this.available !== null && now - this.lastHealthCheck < this.healthCheckIntervalMs) {
      return this.available;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.serverUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.available = res.ok;
    } catch {
      this.available = false;
    }

    this.lastHealthCheck = now;
    return this.available;
  }

  /**
   * Get model info including metrics from manifest.
   */
  async getModelInfo() {
    const isUp = await this.checkHealth();
    if (!isUp) return { available: false };

    try {
      const res = await fetch(`${this.serverUrl}/model-info`);
      const data = await res.json();
      return { available: true, ...data };
    } catch {
      return { available: false };
    }
  }

  /**
   * Run YOLO detection on a base64 image.
   * @param {string} imageDataUri - base64 data URI (data:image/jpeg;base64,...)
   * @param {object} opts - { conf, iou }
   * @returns {Promise<object>} detection results or error
   */
  async detect(imageDataUri, opts = {}) {
    const isUp = await this.checkHealth();
    if (!isUp) {
      return {
        available: false,
        error: "YOLO_SERVER_OFFLINE",
        message:
          "YOLO inference server is not running. Start it with: " +
          ".venv/bin/python src/services/yoloServer.py",
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), YOLO_TIMEOUT_MS);

      const response = await fetch(`${this.serverUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageDataUri,
          conf: opts.conf ?? 0.25,
          iou:  opts.iou  ?? 0.45,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        return {
          available: true,
          error: "YOLO_INFERENCE_ERROR",
          message: `YOLO server returned HTTP ${response.status}: ${errText}`,
        };
      }

      const data = await response.json();
      return {
        available: true,
        ...data,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        return {
          available: true,
          error: "YOLO_TIMEOUT",
          message: `YOLO inference timed out after ${YOLO_TIMEOUT_MS}ms`,
        };
      }
      return {
        available: true,
        error: "YOLO_REQUEST_FAILED",
        message: err.message,
      };
    }
  }
}

// Singleton
export const yoloService = new YoloService();
