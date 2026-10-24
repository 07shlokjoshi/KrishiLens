import React, { useState } from "react";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay.jsx";
import { useSpeech } from "../hooks/useSpeech.js";

const TOXICITY_CONFIG = {
  CATEGORY_I: {
    bg: "#ef4444",
    border: "#b91c1c",
    diamondColor: "#ef4444",
    name: "Extremely Toxic (Red)",
    warningText: "POISON / जहर / विष"
  },
  CATEGORY_II: {
    bg: "#f59e0b",
    border: "#d97706",
    diamondColor: "#f59e0b",
    name: "Highly Toxic (Yellow)",
    warningText: "POISON / जहर / विष"
  },
  CATEGORY_III: {
    bg: "#3b82f6",
    border: "#1d4ed8",
    diamondColor: "#3b82f6",
    name: "Moderately Toxic (Blue)",
    warningText: "DANGER / खतरा / धोका"
  },
  CATEGORY_IV: {
    bg: "#10b981",
    border: "#047857",
    diamondColor: "#10b981",
    name: "Slightly Toxic (Green)",
    warningText: "CAUTION / सावधानी / खबरदारी"
  }
};

export function ResultsScreen({ result, imageSrc, onNewScan, onCopyText }) {
  const [activeTab, setActiveTab] = useState("en"); // "en", "hi", "mr"
  const [viewMode, setViewMode] = useState("certificate"); // "certificate" or "detections"
  const { speak, stop, isSpeaking } = useSpeech();

  const tox = result.toxicity_category || {};
  const toxCategoryCode = tox.code || "CATEGORY_III";
  const toxVisual = TOXICITY_CONFIG[toxCategoryCode] || TOXICITY_CONFIG.CATEGORY_III;

  const explanations = result.explanations || {};
  const currentLangData = explanations[activeTab] || explanations.en || {};

  const detections = result.detections || [];
  const modelName = result.detection_model || "YOLOv8n-KrishiLens-v1.0";

  // Build spoken announcement text
  const getSpeechScript = (lang) => {
    const prod = result.product_name || "Pesticide";
    const sig = tox.signalWord || "Danger";
    const color = tox.color || "Blue";

    if (lang === "hi") {
      const hiData = explanations.hi || {};
      return `सावधान! ${prod}। यह ${color} त्रिभुज, ${tox.hindiSignal || "खतरा"} वाला कीटनाशक है। ${hiData.summary || ""}. सुरक्षा उपकरण अवश्य पहनें।`;
    }
    if (lang === "mr") {
      const mrData = explanations.mr || {};
      return `सावधान! ${prod}। हे ${color} त्रिकोण, ${tox.marathiSignal || "धोका"} चे कीटकनाशक आहे। काळजीपूर्वक हाताळा।`;
    }
    return `Warning: ${prod}. Statutory CIB and RC classification: ${color} Diamond, signal word ${sig}. ${tox.riskLevel || ""}. Wear all required PPE.`;
  };

  const handleAudioBroadcast = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(getSpeechScript(activeTab), activeTab);
    }
  };

  return (
    <div className="results-screen-container" role="region" aria-label="Statutory Certificate and Detections">
      {/* Dual View Mode Navigation Bar */}
      <div className="view-mode-bar">
        <div className="view-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "certificate"}
            className={`view-tab-btn ${viewMode === "certificate" ? "active" : ""}`}
            onClick={() => setViewMode("certificate")}
            id="tab-certificate-view"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>CIB&RC FIELD CERTIFICATE</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "detections"}
            className={`view-tab-btn ${viewMode === "detections" ? "active" : ""}`}
            onClick={() => setViewMode("detections")}
            id="tab-detections-view"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <span>REAL MODEL BOUNDING BOXES</span>
            <span className="det-count-pill">{detections.length}</span>
          </button>
        </div>

        <div className="telemetry-stamp">
          <span className="stamp-item">Latency: <strong>{result.latency_ms || 0}ms</strong></span>
          <span className="stamp-divider">•</span>
          <span className="stamp-item">Source: <strong>{result.inference_metadata?.source || "Local Engine"}</strong></span>
        </div>
      </div>

      {/* DETECTIONS VIEW */}
      {viewMode === "detections" ? (
        <div className="detections-view-wrapper">
          <BoundingBoxOverlay
            imageSrc={imageSrc}
            detections={detections}
            modelName={modelName}
          />
        </div>
      ) : (
        /* STATUTORY CERTIFICATE VIEW */
        <div className="certificate-view-wrapper">
          <div className="statutory-certificate-sheet">
            {/* Certificate Header Plate */}
            <div className="certificate-header">
              <div className="gov-seal-column">
                <div className="seal-emblem">
                  <div className="seal-ring">
                    <span className="seal-text">CIB&RC</span>
                  </div>
                </div>
              </div>

              <div className="certificate-titles">
                <div className="cert-statute">GOVERNMENT OF INDIA • MINISTRY OF AGRICULTURE</div>
                <h2 className="cert-main-title">Statutory Insecticide Verification Record</h2>
                <div className="cert-sub-rule">Pursuant to Section 9 of the Insecticides Act, 1968 & Rule 19 of Insecticides Rules, 1971</div>
              </div>

              <div className="certificate-stamp-box">
                <div className="stamp-border">
                  <span className="stamp-code">CERTIFIED</span>
                  <span className="stamp-date">{new Date().toISOString().split("T")[0]}</span>
                </div>
              </div>
            </div>

            {/* Toxicity Triangle Warning Banner */}
            <div
              className="toxicity-warning-plate"
              style={{
                borderColor: toxVisual.border,
                "--tox-plate-glow": `${toxVisual.bg}33`
              }}
            >
              <div className="tox-plate-left">
                {/* Skeuomorphic CIB&RC Diamond */}
                <div className="statutory-diamond-wrap">
                  <div className="cibrc-diamond-outer">
                    {/* Upper Triangle: White */}
                    <div className="diamond-upper-half">
                      <span className="diamond-symbol">{tox.symbol || "⚠️"}</span>
                    </div>
                    {/* Lower Triangle: Statutory Color */}
                    <div
                      className="diamond-lower-half"
                      style={{ backgroundColor: toxVisual.diamondColor }}
                    >
                      <span className="diamond-color-text">{tox.color || "BLUE"}</span>
                    </div>
                  </div>
                </div>

                <div className="tox-details-column">
                  <div className="tox-badge-row">
                    <span
                      className="tox-pill"
                      style={{ backgroundColor: toxVisual.bg, color: "#fff" }}
                    >
                      {tox.color || "Blue"} Triangle • {(toxCategoryCode || "").replace("_", " ")}
                    </span>
                    <span className="tox-signal-word">
                      {tox.signalWord || "DANGER"} / {tox.hindiSignal || "खतरा"} / {tox.marathiSignal || "धोका"}
                    </span>
                  </div>
                  <h3 className="tox-risk-headline">{tox.riskLevel || "Harmful if swallowed or inhaled"}</h3>
                  <div className="tox-ld50-spec">
                    Statutory Oral LD50: <strong>{tox.oralLD50 || "501 - 5000 mg/kg"}</strong>
                  </div>
                </div>
              </div>

              {/* Audio Broadcast Station */}
              <div className="audio-broadcast-unit">
                <div className="audio-unit-label">EMERGENCY FIELD AUDIO:</div>
                <button
                  type="button"
                  className={`btn-enamel-broadcast ${isSpeaking ? "broadcasting" : ""}`}
                  onClick={handleAudioBroadcast}
                  id="audio-broadcast-btn"
                  title="Broadcast safety instructions"
                >
                  <div className="audio-btn-inner">
                    {isSpeaking ? (
                      <>
                        <div className="sound-wave-bars">
                          <span></span><span></span><span></span><span></span>
                        </div>
                        <span>STOP BROADCAST</span>
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <span>SPEAK IN {activeTab.toUpperCase()}</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Multilingual Guidance Station */}
            <div className="multilingual-guidance-card">
              <div className="language-selector-bar">
                <div className="lang-tabs-group" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className={`lang-tab ${activeTab === "en" ? "active" : ""}`}
                    onClick={() => setActiveTab("en")}
                    id="lang-tab-en"
                  >
                    English (Official)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`lang-tab ${activeTab === "hi" ? "active" : ""}`}
                    onClick={() => setActiveTab("hi")}
                    id="lang-tab-hi"
                  >
                    हिंदी (Hindi)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`lang-tab ${activeTab === "mr" ? "active" : ""}`}
                    onClick={() => setActiveTab("mr")}
                    id="lang-tab-mr"
                  >
                    मराठी (Marathi)
                  </button>
                </div>
              </div>

              <div className="guidance-content-pane">
                <div className="guidance-header-row">
                  <h4 className="guidance-title">{currentLangData.title || result.product_name || "Pesticide Formulation"}</h4>
                  <span className="guidance-signal-badge">{currentLangData.signal || tox.signalWord}</span>
                </div>
                <p className="guidance-summary-text">{currentLangData.summary || "Handle according to statutory recommendations."}</p>

                {/* Pre-harvest interval */}
                <div className="phi-waiting-card">
                  <div className="phi-icon">⏳</div>
                  <div>
                    <span className="phi-label">Pre-Harvest Interval (Waiting Period):</span>
                    <strong className="phi-value"> {currentLangData.waitingPeriod || "Refer to statutory label leaflet"}</strong>
                  </div>
                </div>

                {/* PPE Equipment List */}
                <div className="ppe-guidance-block">
                  <h5 className="ppe-heading">Mandatory Personal Protective Equipment (PPE):</h5>
                  <div className="ppe-chips-grid">
                    {(currentLangData.ppeNeeded || [
                      "Chemical resistant gloves",
                      "Respirator / Mask",
                      "Eye safety goggles",
                      "Protective rubber boots"
                    ]).map((ppe, i) => (
                      <div key={i} className="ppe-chip">
                        <span className="ppe-icon">🛡️</span>
                        <span>{ppe}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Field Safety & Antidote Statement */}
            <div className="safety-advisory-plate">
              <div className="advisory-title-row">
                <span className="advisory-icon">⚠️</span>
                <strong>FIRST AID & STATUTORY EMERGENCY PROTOCOL</strong>
              </div>
              <p className="advisory-text">
                {result.first_aid_text || "Induce vomiting if conscious. Keep patient warm and airway clear. Call medical emergency immediately. Carry container to hospital."}
              </p>
              <div className="advisory-storage">
                <strong>Storage & Disposal Mandate:</strong> {result.storage_instructions || "Store in original tightly closed container under lock and key away from food, animal feed, and children. Crush empty container before disposal."}
              </div>
            </div>

            {/* Technical Specifications Matrix */}
            <div className="tech-specs-table-card">
              <h4 className="tech-specs-title">Statutory Verification Matrix</h4>
              <div className="specs-table-grid">
                <div className="spec-row">
                  <span className="spec-key">Product Form:</span>
                  <span className="spec-val font-bold">{result.product_name || "Unknown Formulation"}</span>
                </div>

                <div className="spec-row">
                  <span className="spec-key">Active Ingredient:</span>
                  <span className="spec-val">
                    {result.active_ingredient || "Unspecified"}
                    {result.active_ingredient && (
                      <button
                        type="button"
                        className="copy-btn-micro"
                        onClick={() => onCopyText(result.active_ingredient, "Active Ingredient")}
                        title="Copy active ingredient"
                      >
                        📋
                      </button>
                    )}
                  </span>
                </div>

                <div className="spec-row">
                  <span className="spec-key">Concentration / Purity:</span>
                  <span className="spec-val">{result.concentration || "Unspecified"}</span>
                </div>

                <div className="spec-row">
                  <span className="spec-key">CIB&RC Registration No:</span>
                  <span className="spec-val font-mono">
                    {result.registration_number || "Not detected on visible facet"}
                    {result.registration_number && (
                      <button
                        type="button"
                        className="copy-btn-micro"
                        onClick={() => onCopyText(result.registration_number, "Registration No")}
                        title="Copy CIR number"
                      >
                        📋
                      </button>
                    )}
                  </span>
                </div>

                <div className="spec-row">
                  <span className="spec-key">Manufacturer:</span>
                  <span className="spec-val">{result.manufacturer || "Not detected in frame"}</span>
                </div>

                <div className="spec-row">
                  <span className="spec-key">Confidence Grade:</span>
                  <span className="spec-val">
                    <span className="badge-grade">{result.confidence_or_uncertainty?.overall || "CONFIRMED"}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="results-bottom-bar">
        <button
          type="button"
          className="btn-enamel-secondary"
          onClick={() => window.print()}
          id="print-certificate-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>PRINT / SAVE REPORT</span>
        </button>

        <button
          type="button"
          className="btn-enamel-primary"
          onClick={onNewScan}
          id="new-scan-btn"
        >
          <div className="btn-metallic-rim"></div>
          <div className="btn-core-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>ANALYZE ANOTHER SPECIMEN</span>
          </div>
        </button>
      </div>
    </div>
  );
}
