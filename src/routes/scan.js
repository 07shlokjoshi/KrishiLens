import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { InferenceEngine } from "../services/inferenceEngine.js";
import { DetectorService } from "../services/detectorService.js";

const router = express.Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const engine = new InferenceEngine();
const detector = new DetectorService();

/**
 * POST /api/scan
 * Accepts base64 image or multipart/form-data
 */
router.post("/scan", upload.single("image"), async (req, res) => {
  try {
    let imageInput = null;

    if (req.file) {
      imageInput = req.file.buffer;
    } else if (req.body && req.body.image) {
      imageInput = req.body.image;
    }

    if (!imageInput) {
      return res.status(400).json({
        label_detected: false,
        status: "INVALID_REQUEST",
        error: "Missing image data. Provide 'image' in JSON body or multipart form."
      });
    }

    // If imageInput is a local test-image path
    if (typeof imageInput === "string" && imageInput.startsWith("/test-images/")) {
      const filename = path.basename(imageInput);
      const diskPath = path.resolve("data/test_images", filename);
      if (fs.existsSync(diskPath)) {
        imageInput = fs.readFileSync(diskPath);
      } else {
        return res.status(404).json({
          label_detected: false,
          status: "FILE_NOT_FOUND",
          error: `Test sample image '${filename}' not found.`
        });
      }
    }

    const forceLocalOcr = req.query.mode === "local" || req.body.mode === "local";

    const result = await engine.processLabel(imageInput, { forceLocalOcr });
    return res.json(result);
  } catch (err) {
    console.error("Scan processing error:", err);
    return res.status(500).json({
      label_detected: false,
      status: "SERVER_ERROR",
      error: err.message
    });
  }
});

/**
 * POST /api/detect
 * Lightweight endpoint to only run YOLOv8 object detection
 */
router.post("/detect", upload.single("image"), async (req, res) => {
  try {
    let imageInput = null;

    if (req.file) {
      imageInput = req.file.buffer;
    } else if (req.body && req.body.image) {
      imageInput = req.body.image;
    }

    if (!imageInput) {
      return res.status(400).json({
        success: false,
        error: "Missing image data"
      });
    }

    if (typeof imageInput === "string" && imageInput.startsWith("/test-images/")) {
      const filename = path.basename(imageInput);
      const diskPath = path.resolve("data/test_images", filename);
      if (fs.existsSync(diskPath)) {
        imageInput = fs.readFileSync(diskPath);
      } else {
        return res.status(404).json({
          success: false,
          error: `Test sample image '${filename}' not found.`
        });
      }
    }

    const confThreshold = req.body.conf ? parseFloat(req.body.conf) : 0.35;
    const result = await detector.detectObjects(imageInput, confThreshold);
    return res.json(result);
  } catch (err) {
    console.error("Detect error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;

