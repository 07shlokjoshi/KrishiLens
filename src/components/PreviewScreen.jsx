import React, { useState } from "react";

export function PreviewScreen({ imageSrc, imageName, onConfirm, onRetake }) {
  const [mode, setMode] = useState("full"); // "full" or "local"

  return (
    <div className="preview-screen-container" role="region" aria-label="Specimen calibration preview">
      <div className="preview-chassis-card">
        {/* Card Header */}
        <div className="preview-header">
          <div className="preview-title-group">
            <span className="preview-icon">🔍</span>
            <div>
              <h2 className="preview-title">Calibrated Specimen Preview</h2>
              <span className="preview-sub">{imageName || "Captured Frame"}</span>
            </div>
          </div>
          <span className="preview-status-pill">READY FOR INFERENCE</span>
        </div>

        {/* Precision Image Stage */}
        <div className="preview-image-stage">
          <div className="stage-corner top-left"></div>
          <div className="stage-corner top-right"></div>
          <div className="stage-corner bottom-left"></div>
          <div className="stage-corner bottom-right"></div>

          <img
            src={imageSrc}
            alt="Pesticide label specimen ready for scanning"
            className="preview-image-element"
          />
        </div>

        {/* Inference Mode Selection */}
        <div className="inference-mode-section">
          <div className="mode-section-title">Select Optical Processing Pipeline:</div>
          <div className="mode-toggle-group">
            <label className={`mode-option-card ${mode === "full" ? "selected" : ""}`}>
              <input
                type="radio"
                name="inferenceMode"
                value="full"
                checked={mode === "full"}
                onChange={() => setMode("full")}
                className="visually-hidden"
              />
              <div className="mode-card-radio"></div>
              <div className="mode-card-content">
                <div className="mode-title-row">
                  <strong>Full Neural Pipeline</strong>
                  <span className="badge-recom">RECOMMENDED</span>
                </div>
                <p className="mode-description">
                  Ultralytics YOLOv8n object detection (Package, Label, Diamond) + Gemma 4 Multimodal reasoning.
                </p>
              </div>
            </label>

            <label className={`mode-option-card ${mode === "local" ? "selected" : ""}`}>
              <input
                type="radio"
                name="inferenceMode"
                value="local"
                checked={mode === "local"}
                onChange={() => setMode("local")}
                className="visually-hidden"
              />
              <div className="mode-card-radio"></div>
              <div className="mode-card-content">
                <div className="mode-title-row">
                  <strong>Local CIB&RC OCR Engine</strong>
                  <span className="badge-offline">OFFLINE SAFE</span>
                </div>
                <p className="mode-description">
                  YOLOv8 detection + High-accuracy local OCR & statutory CIB&RC knowledge base lookup.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Tactile Action Buttons */}
        <div className="preview-actions-dock">
          <button
            type="button"
            className="btn-enamel-secondary"
            onClick={onRetake}
            id="preview-retake-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>RETAKE / CHOOSE ANOTHER</span>
          </button>

          <button
            type="button"
            className="btn-enamel-primary"
            onClick={() => onConfirm(mode)}
            id="preview-analyze-btn"
          >
            <div className="btn-metallic-rim"></div>
            <div className="btn-core-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>ANALYZE SPECIMEN</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
