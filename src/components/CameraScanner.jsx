import React, { useEffect } from "react";
import { useCamera } from "../hooks/useCamera.js";

export function CameraScanner({ onCapture, onClose }) {
  const {
    videoRef,
    isStreaming,
    hasTorch,
    isTorchOn,
    error,
    startCamera,
    stopCamera,
    toggleTorch,
    switchCamera,
    captureFrame
  } = useCamera();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleShutter = () => {
    const frameData = captureFrame();
    if (frameData) {
      onCapture(frameData, `capture_${Date.now()}.jpg`);
    }
  };

  return (
    <div className="camera-scanner-screen" role="region" aria-label="Live camera viewfinder">
      {/* Top Instrument Bezel */}
      <div className="scanner-top-bar">
        <button
          type="button"
          className="scanner-control-btn"
          onClick={onClose}
          title="Close scanner"
          id="scanner-close-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>CLOSE</span>
        </button>

        <div className="scanner-status-indicator">
          <span className={`status-pulse ${isStreaming ? "live" : "standby"}`}></span>
          <span className="status-label">
            {isStreaming ? "OPTICAL SENSOR ACTIVE" : "INITIALIZING OPTICS..."}
          </span>
        </div>

        <div className="scanner-top-actions">
          {hasTorch && (
            <button
              type="button"
              className={`scanner-control-btn ${isTorchOn ? "active" : ""}`}
              onClick={toggleTorch}
              title="Toggle flashlight"
              id="scanner-torch-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{isTorchOn ? "TORCH ON" : "TORCH"}</span>
            </button>
          )}

          <button
            type="button"
            className="scanner-control-btn"
            onClick={switchCamera}
            title="Switch front / rear camera"
            id="scanner-switch-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>FLIP</span>
          </button>
        </div>
      </div>

      {/* Viewfinder Viewport with HUD */}
      <div className="viewfinder-viewport">
        {error ? (
          <div className="scanner-error-state">
            <div className="scanner-error-icon">⚠️</div>
            <div className="scanner-error-text">{error}</div>
            <p className="scanner-error-hint">
              You can still test the model by uploading an image or selecting a benchmark specimen.
            </p>
            <button type="button" className="btn-enamel-small" onClick={onClose}>
              Return to Specimen Deck
            </button>
          </div>
        ) : (
          <div className="viewfinder-lens-wrap">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="viewfinder-video-element"
            />

            {/* Reticle Overlay HUD */}
            <div className="reticle-overlay-hud">
              {/* Corner framing brackets */}
              <div className="hud-corner top-left"></div>
              <div className="hud-corner top-right"></div>
              <div className="hud-corner bottom-left"></div>
              <div className="hud-corner bottom-right"></div>

              {/* Center crosshair */}
              <div className="hud-crosshair-center">
                <div className="crosshair-h"></div>
                <div className="crosshair-v"></div>
                <div className="crosshair-circle"></div>
              </div>

              {/* Animated Laser Sweep Line */}
              <div className="hud-laser-sweep"></div>

              {/* Framing Guidance Label */}
              <div className="hud-guidance-pill">
                ALIGN CIB&RC PESTICIDE LABEL INSIDE RETICLE
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Heavy Tactile Shutter Dock */}
      <div className="scanner-shutter-dock">
        <div className="shutter-instructions">
          Hold steady • Ensure good lighting on toxicity diamond
        </div>

        <button
          type="button"
          className="shutter-enamel-trigger"
          onClick={handleShutter}
          disabled={!isStreaming}
          id="shutter-trigger-btn"
          aria-label="Capture pesticide label photo"
        >
          <div className="shutter-outer-ring">
            <div className="shutter-knurled-rim">
              <div className="shutter-inner-core">
                <div className="shutter-symbol"></div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
