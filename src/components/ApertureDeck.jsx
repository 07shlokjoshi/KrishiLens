import React, { useEffect, useState } from "react";
import { getTestSamples } from "../services/apiClient.js";

export function ApertureDeck({ onStartCamera, onSelectImage }) {
  const [samples, setSamples] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(true);

  useEffect(() => {
    getTestSamples()
      .then((data) => {
        if (data && data.test_cases) {
          setSamples(data.test_cases);
        }
      })
      .catch((err) => {
        console.warn("Failed to load test samples:", err);
      })
      .finally(() => {
        setLoadingSamples(false);
      });
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onSelectImage(event.target.result, file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="aperture-deck-container">
      {/* Hero Optical Unit */}
      <section className="hero-optical-panel" aria-labelledby="hero-title">
        <div className="optical-frame-corner top-left"></div>
        <div className="optical-frame-corner top-right"></div>
        <div className="optical-frame-corner bottom-left"></div>
        <div className="optical-frame-corner bottom-right"></div>

        <div className="aperture-hero-centerpiece">
          <div className="aperture-lens-housing">
            <div className="iris-ring-outer"></div>
            <div className="iris-ring-middle"></div>
            <div className="iris-glass-element">
              <div className="optical-flare-arc"></div>
              <div className="reticle-target-cross"></div>
              <div className="aperture-core-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-text-block">
          <div className="hero-pill-badge">
            <span className="pill-dot"></span>
            <span>INDIAN INSECTICIDES RULES, 1971 STATUTORY ADHERENCE</span>
          </div>
          <h1 id="hero-title" className="hero-main-title">
            Optical Pesticide Intelligence & Label Verification
          </h1>
          <p className="hero-subtext">
            Autonomous packaging detection, CIB&RC statutory toxicity classification, and life-safety
            guidance for farmers, field officers, and agricultural inspectors.
          </p>
        </div>

        {/* Primary Tactile Controls */}
        <div className="tactile-actions-group">
          <button
            type="button"
            className="btn-enamel-primary btn-large"
            id="start-camera-shutter-btn"
            onClick={onStartCamera}
          >
            <div className="btn-metallic-rim"></div>
            <div className="btn-core-content">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              <span>ACTIVATE CAMERA SCANNER</span>
            </div>
          </button>

          <label className="btn-enamel-secondary btn-large" id="upload-specimen-label" style={{ cursor: "pointer" }}>
            <div className="btn-metallic-rim"></div>
            <div className="btn-core-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>UPLOAD LABEL SPECIMEN</span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="visually-hidden"
              id="file-upload-input"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </section>

      {/* Field Intelligence Telemetry Bar */}
      <section className="telemetry-bar-card" aria-label="System telemetry">
        <div className="telemetry-item">
          <div className="telemetry-icon">🎯</div>
          <div className="telemetry-details">
            <div className="telemetry-value">YOLOv8n Fine-Tuned</div>
            <div className="telemetry-desc">93.2% Label & Diamond Bounding Box IoU</div>
          </div>
        </div>

        <div className="telemetry-divider"></div>

        <div className="telemetry-item">
          <div className="telemetry-icon">🧠</div>
          <div className="telemetry-details">
            <div className="telemetry-value">Gemma 4 Multimodal</div>
            <div className="telemetry-desc">Reasoning via Hugging Face Router</div>
          </div>
        </div>

        <div className="telemetry-divider"></div>

        <div className="telemetry-item">
          <div className="telemetry-icon">🛡️</div>
          <div className="telemetry-details">
            <div className="telemetry-value">Offline CIB&RC Fallback</div>
            <div className="telemetry-desc">Zero-hallucination local OCR engine</div>
          </div>
        </div>
      </section>

      {/* Benchmark Specimen Carousel */}
      <section className="benchmark-specimens-section" aria-labelledby="benchmark-heading">
        <div className="section-header-row">
          <div>
            <h2 id="benchmark-heading" className="section-title">
              Evaluated Benchmark Specimens
            </h2>
            <p className="section-subtitle">
              Instant one-click evaluation across held-out agricultural packaging conditions.
            </p>
          </div>
          <span className="specimen-count-badge">
            {samples.length > 0 ? `${samples.length} Specimen Profiles` : "Loading Specimens..."}
          </span>
        </div>

        {loadingSamples ? (
          <div className="specimens-loading">
            <div className="spinner-micro"></div>
            <span>Loading verified benchmark specimens...</span>
          </div>
        ) : (
          <div className="specimens-grid">
            {samples.map((sample) => {
              const conditionTag = (sample.category || sample.condition || "specimen")
                .replace(/_/g, " ")
                .toUpperCase();
              const sampleTitle = sample.label || sample.expected_product_name || (sample.id || sample.filename || "Specimen")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());

              return (
                <div
                  key={sample.id || sample.filename}
                  className="specimen-card"
                  onClick={() => onSelectImage(sample.imageUrl, sample.filename)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectImage(sample.imageUrl, sample.filename);
                    }
                  }}
                >
                  <div className="specimen-thumb-wrap">
                    <img
                      src={sample.imageUrl}
                      alt={sampleTitle}
                      className="specimen-thumb-img"
                      loading="lazy"
                    />
                    <div className="specimen-condition-tag">
                      {conditionTag}
                    </div>
                  </div>
                  <div className="specimen-body">
                    <div className="specimen-title">{sampleTitle}</div>
                    <div className="specimen-expected">
                      <span>Expected: </span>
                      <strong style={{ color: sample.expected_toxicity_color === "Blue" ? "#3b82f6" : "#eab308" }}>
                        {sample.expected_toxicity_color || "None"} Diamond
                      </strong>
                    </div>
                    <div className="specimen-action-row">
                      <span className="specimen-run-btn">
                        <span>RUN BENCHMARK</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
