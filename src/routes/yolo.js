/**
 * KrishiLens YOLO Detection API Route
 * =====================================
 * POST /api/yolo/detect   — Run real YOLO bounding box detection
 * GET  /api/yolo/health   — Check YOLO server status
 * GET  /api/yolo/model    — Get model info + metrics
 */

import express from "express";
import { yoloService } from "../services/yoloService.js";

const router = express.Router();

/**
 * GET /api/yolo/health
 * Check if the Python YOLO sidecar is running and healthy.
 */
router.get("/health", async (req, res) => {
  const available = await yoloService.checkHealth();
  const info = available ? await yoloService.getModelInfo() : {};
  return res.json({
    yolo_available: available,
    server_url: yoloService.serverUrl,
    ...info,
  });
});

/**
 * GET /api/yolo/model
 * Returns model config, trained metrics (P/R/F1/mAP@50/mAP@50-95),
 * per-class breakdown, and checkpoint path.
 */
router.get("/model", async (req, res) => {
  const info = await yoloService.getModelInfo();
  if (!info.available) {
    return res.status(503).json({
      error: "YOLO_SERVER_OFFLINE",
      instructions: "Start the YOLO server: .venv/bin/python src/services/yoloServer.py",
    });
  }
  return res.json(info);
});

/**
 * POST /api/yolo/detect
 * Body: { image: "<base64 data URI>", conf?: 0.25, iou?: 0.45 }
 *
 * Returns genuine YOLO bounding boxes with:
 *   - class_id, class_name, confidence (actual model output, never fabricated)
 *   - bbox_norm: [cx, cy, w, h] normalized 0-1
 *   - bbox_pixels: {x1, y1, x2, y2, width, height} in original image pixels
 *   - model_metrics: actual P/R/F1/mAP from training
 */
router.post("/detect", async (req, res) => {
  const { image, conf, iou } = req.body || {};

  if (!image) {
    return res.status(400).json({
      error: "MISSING_IMAGE",
      message: "Provide 'image' as a base64 data URI in the JSON body.",
    });
  }

  if (typeof image !== "string" || !image.startsWith("data:")) {
    return res.status(400).json({
      error: "INVALID_IMAGE_FORMAT",
      message: "Image must be a base64 data URI (data:image/jpeg;base64,...).",
    });
  }

  const result = await yoloService.detect(image, { conf, iou });

  if (!result.available) {
    return res.status(503).json({
      error: result.error,
      message: result.message,
      instructions: "Start with: .venv/bin/python src/services/yoloServer.py",
    });
  }

  if (result.error) {
    return res.status(500).json(result);
  }

  return res.json(result);
});

export default router;
