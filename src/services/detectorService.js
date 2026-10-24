import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * Service to execute the trained YOLOv8 Pesticide Label Detector
 */
export class DetectorService {
  constructor() {
    this.pythonPath = path.resolve(".venv/bin/python");
    this.scriptPath = path.resolve("experiments/detection/predict.py");
    this.weightsPath = path.resolve("experiments/detection/weights/best.pt");
  }

  /**
   * Runs object detection on image buffer or file path
   * @param {Buffer | string} imageInput
   * @param {number} confThreshold
   */
  async detectObjects(imageInput, confThreshold = 0.35) {
    let tempFilePath = null;

    try {
      if (typeof imageInput === "string" && fs.existsSync(imageInput)) {
        tempFilePath = imageInput;
      } else {
        // Write buffer to temporary file for python script
        let buffer = imageInput;
        if (typeof imageInput === "string" && imageInput.startsWith("data:")) {
          const base64Data = imageInput.split(",")[1];
          buffer = Buffer.from(base64Data, "base64");
        }
        tempFilePath = path.join(os.tmpdir(), `detect_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
        fs.writeFileSync(tempFilePath, buffer);
      }

      return await new Promise((resolve, reject) => {
        const proc = spawn(this.pythonPath, [
          this.scriptPath,
          tempFilePath,
          String(confThreshold)
        ]);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          // Clean up temp file if we created it
          if (tempFilePath && tempFilePath.startsWith(os.tmpdir()) && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch {}
          }

          if (code !== 0) {
            console.warn("Detection process returned non-zero code:", code, stderr);
            return resolve({
              success: false,
              error: `Detection exited with code ${code}`,
              detections: []
            });
          }

          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed);
          } catch (parseErr) {
            console.error("Failed to parse detection output:", stdout, parseErr);
            resolve({
              success: false,
              error: "Failed to parse model output: " + parseErr.message,
              detections: []
            });
          }
        });

        proc.on("error", (err) => {
          if (tempFilePath && tempFilePath.startsWith(os.tmpdir()) && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch {}
          }
          console.error("Spawn detector error:", err);
          resolve({
            success: false,
            error: err.message,
            detections: []
          });
        });
      });
    } catch (err) {
      if (tempFilePath && tempFilePath.startsWith(os.tmpdir()) && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch {}
      }
      return {
        success: false,
        error: err.message,
        detections: []
      };
    }
  }
}
