import React from "react";

export function Header({ onHomeClick, currentScreen }) {
  return (
    <header className="chassis-header" role="banner">
      <div className="header-inner">
        <div className="brand-group" onClick={onHomeClick} style={{ cursor: "pointer" }}>
          <div className="aperture-emblem" aria-hidden="true">
            <svg viewBox="0 0 40 40" className="emblem-svg">
              <circle cx="20" cy="20" r="18" className="emblem-rim" />
              <circle cx="20" cy="20" r="14" className="emblem-inner" />
              <polygon points="20,6 26,17 38,17 28,24 32,36 20,29 8,36 12,24 2,17 14,17" className="emblem-iris" />
              <circle cx="20" cy="20" r="4" className="emblem-core" />
            </svg>
          </div>
          <div className="brand-copy">
            <div className="brand-title-row">
              <span className="brand-name">KRISHILENS</span>
              <span className="badge-statutory">CIB&RC 1971</span>
            </div>
            <div className="brand-sub">OPTICAL PESTICIDE LABEL INTELLIGENCE</div>
          </div>
        </div>

        <div className="header-telemetry">
          <div className="telemetry-pill">
            <span className="telemetry-dot live"></span>
            <span className="telemetry-label">YOLOv8n + GEMMA 4</span>
          </div>

          {currentScreen !== "deck" && (
            <button
              className="btn-enamel-small"
              onClick={onHomeClick}
              title="Return to Aperture Deck"
              id="header-home-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>NEW SCAN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
