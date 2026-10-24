import React from "react";

export function ErrorScreen({ error, onRetry, onHome }) {
  return (
    <div className="error-screen-container" role="alert" aria-label="Diagnostic failure plate">
      <div className="error-chassis-card">
        <div className="error-hazard-stripe"></div>

        <div className="error-card-body">
          <div className="error-icon-housing">
            <div className="error-beacon">⚠️</div>
          </div>

          <h2 className="error-title">Inspection Could Not Be Verified</h2>
          <p className="error-message">
            {error || "The optical sensor was unable to verify a statutory CIB&RC pesticide label in this frame."}
          </p>

          <div className="field-corrective-checklist">
            <h4 className="checklist-heading">FIELD CORRECTIVE MEASURES:</h4>
            <ul className="checklist-items">
              <li>
                <span className="check-bullet">1.</span>
                <span><strong>Avoid Glare:</strong> Diffuse strong overhead sunlight or reflections off plastic bottles.</span>
              </li>
              <li>
                <span className="check-bullet">2.</span>
                <span><strong>Ensure Focus:</strong> Tap your screen to focus sharply on the printed ingredients and toxicity diamond.</span>
              </li>
              <li>
                <span className="check-bullet">3.</span>
                <span><strong>Center the Label:</strong> Keep the container upright within the optical crosshair reticle.</span>
              </li>
            </ul>
          </div>

          <div className="error-actions-row">
            <button
              type="button"
              className="btn-enamel-secondary"
              onClick={onHome}
              id="error-deck-btn"
            >
              RETURN TO SPECIMEN DECK
            </button>

            <button
              type="button"
              className="btn-enamel-primary"
              onClick={onRetry}
              id="error-retry-btn"
            >
              <div className="btn-metallic-rim"></div>
              <div className="btn-core-content">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>RETRY SCAN</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
