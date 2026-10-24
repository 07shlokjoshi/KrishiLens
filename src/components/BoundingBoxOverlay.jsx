import React, { useState } from "react";

const CLASS_CONFIG = {
  pesticide_package: {
    label: "Pesticide Package",
    shortLabel: "Package",
    color: "#10b981", // Emerald
    bgColor: "rgba(16, 185, 129, 0.18)",
    borderColor: "#10b981",
    icon: "📦"
  },
  cibrc_label: {
    label: "CIB&RC Label",
    shortLabel: "Statutory Label",
    color: "#f59e0b", // Amber gold
    bgColor: "rgba(245, 158, 11, 0.18)",
    borderColor: "#f59e0b",
    icon: "🏷️"
  },
  toxicity_triangle: {
    label: "Toxicity Diamond",
    shortLabel: "Tox Diamond",
    color: "#ef4444", // Red / Toxicity accent
    bgColor: "rgba(239, 68, 68, 0.22)",
    borderColor: "#ef4444",
    icon: "⚠️"
  },
  cibrc_reg_stamp: {
    label: "Registration Stamp",
    shortLabel: "CIR Stamp",
    color: "#06b6d4", // Cyan
    bgColor: "rgba(6, 182, 212, 0.18)",
    borderColor: "#06b6d4",
    icon: "🔖"
  }
};

export function BoundingBoxOverlay({
  imageSrc,
  detections = [],
  modelName = "YOLOv8n-KrishiLens-v1.0"
}) {
  const [selectedClass, setSelectedClass] = useState("all");
  const [minConf, setMinConf] = useState(0.35);
  const [hoveredBoxIndex, setHoveredBoxIndex] = useState(null);

  // Filter detections by class and confidence
  const filteredDetections = detections.filter((d) => {
    const matchesClass = selectedClass === "all" || d.class_name === selectedClass;
    const matchesConf = (d.confidence || 0) >= minConf;
    return matchesClass && matchesConf;
  });

  // Calculate counts per class
  const classCounts = detections.reduce((acc, d) => {
    acc[d.class_name] = (acc[d.class_name] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bbox-inspector-chassis">
      {/* Control Toolbar */}
      <div className="bbox-toolbar">
        <div className="bbox-toolbar-header">
          <div className="bbox-model-tag">
            <span className="live-indicator-pulse"></span>
            <span className="bbox-model-text">REAL DETECTION: {modelName}</span>
          </div>
          <div className="bbox-count-tag">
            <span>{filteredDetections.length} of {detections.length} Boxes Active</span>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="bbox-filter-chips" role="group" aria-label="Detection class filters">
          <button
            type="button"
            className={`bbox-chip ${selectedClass === "all" ? "active" : ""}`}
            onClick={() => setSelectedClass("all")}
          >
            <span className="chip-icon">👁️</span>
            <span>All Classes</span>
            <span className="chip-badge">{detections.length}</span>
          </button>

          {Object.entries(CLASS_CONFIG).map(([clsKey, cfg]) => {
            const count = classCounts[clsKey] || 0;
            return (
              <button
                key={clsKey}
                type="button"
                className={`bbox-chip ${selectedClass === clsKey ? "active" : ""}`}
                style={{
                  "--chip-accent": cfg.color,
                  borderColor: selectedClass === clsKey ? cfg.color : undefined
                }}
                onClick={() => setSelectedClass(clsKey)}
              >
                <span className="chip-icon">{cfg.icon}</span>
                <span>{cfg.shortLabel}</span>
                <span
                  className="chip-badge"
                  style={{ backgroundColor: count > 0 ? cfg.color : "rgba(255,255,255,0.1)", color: count > 0 ? "#000" : "#888" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Confidence Threshold Slider */}
        <div className="bbox-slider-row">
          <label htmlFor="conf-slider" className="bbox-slider-label">
            Min Confidence Threshold: <strong>{Math.round(minConf * 100)}%</strong>
          </label>
          <input
            id="conf-slider"
            type="range"
            min="0.20"
            max="0.95"
            step="0.05"
            value={minConf}
            onChange={(e) => setMinConf(parseFloat(e.target.value))}
            className="bbox-range-input"
          />
        </div>
      </div>

      {/* Responsive Image Viewport with Bounding Boxes */}
      <div className="bbox-viewport-container">
        <div className="bbox-viewport-inner">
          <img
            src={imageSrc}
            alt="Pesticide label specimen with real model bounding boxes"
            className="bbox-source-image"
          />

          {/* SVG Overlay for Vector Precision */}
          <svg
            className="bbox-svg-overlay"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
          >
            {filteredDetections.map((det, idx) => {
              const cfg = CLASS_CONFIG[det.class_name] || {
                color: "#10b981",
                label: det.class_name,
                icon: "📍"
              };
              const isHovered = hoveredBoxIndex === idx;

              // bbox_normalized is [x1, y1, width, height] normalized to [0, 1]
              const [x, y, w, h] = det.bbox_normalized || [0, 0, 1, 1];
              const svgX = x * 1000;
              const svgY = y * 1000;
              const svgW = w * 1000;
              const svgH = h * 1000;

              return (
                <g
                  key={idx}
                  className={`bbox-svg-group ${isHovered ? "hovered" : ""}`}
                  onMouseEnter={() => setHoveredBoxIndex(idx)}
                  onMouseLeave={() => setHoveredBoxIndex(null)}
                >
                  {/* Outer Glow on hover */}
                  {isHovered && (
                    <rect
                      x={svgX - 4}
                      y={svgY - 4}
                      width={svgW + 8}
                      height={svgH + 8}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth="8"
                      strokeOpacity="0.4"
                      rx="8"
                    />
                  )}

                  {/* Shaded Fill */}
                  <rect
                    x={svgX}
                    y={svgY}
                    width={svgW}
                    height={svgH}
                    fill={cfg.color}
                    fillOpacity={isHovered ? 0.35 : 0.15}
                    rx="4"
                  />

                  {/* Primary Bounding Box Border */}
                  <rect
                    x={svgX}
                    y={svgY}
                    width={svgW}
                    height={svgH}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth={isHovered ? "6" : "3.5"}
                    strokeDasharray={det.class_name === "toxicity_triangle" ? "none" : "none"}
                    rx="4"
                  />

                  {/* Corner Accent Brackets for Optical Camera HUD Aesthetic */}
                  <path
                    d={`M ${svgX} ${svgY + 25} L ${svgX} ${svgY} L ${svgX + 25} ${svgY}`}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="7"
                  />
                  <path
                    d={`M ${svgX + svgW - 25} ${svgY} L ${svgX + svgW} ${svgY} L ${svgX + svgW} ${svgY + 25}`}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="7"
                  />
                  <path
                    d={`M ${svgX} ${svgY + svgH - 25} L ${svgX} ${svgY + svgH} L ${svgX + 25} ${svgY + svgH}`}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="7"
                  />
                  <path
                    d={`M ${svgX + svgW - 25} ${svgY + svgH} L ${svgX + svgW} ${svgY + svgH} L ${svgX + svgW} ${svgY + svgH - 25}`}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="7"
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML Overlay Tags for Crisp Fonts and Badges */}
          <div className="bbox-html-tags-layer">
            {filteredDetections.map((det, idx) => {
              const cfg = CLASS_CONFIG[det.class_name] || {
                color: "#10b981",
                label: det.class_name,
                icon: "📍"
              };
              const isHovered = hoveredBoxIndex === idx;
              const [x, y] = det.bbox_normalized || [0, 0];

              return (
                <div
                  key={idx}
                  className={`bbox-tag-badge ${isHovered ? "is-hovered" : ""}`}
                  style={{
                    left: `${Math.max(1, Math.min(90, x * 100))}%`,
                    top: `${Math.max(2, Math.min(92, y * 100))}%`,
                    backgroundColor: cfg.color
                  }}
                  onMouseEnter={() => setHoveredBoxIndex(idx)}
                  onMouseLeave={() => setHoveredBoxIndex(null)}
                >
                  <span className="tag-icon">{cfg.icon}</span>
                  <span className="tag-label">{cfg.shortLabel}</span>
                  <span className="tag-conf">{det.confidence_pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detection Table / List Breakdown */}
      <div className="bbox-detections-list">
        <h4 className="bbox-list-heading">Model Predicted Coordinates (Ultralytics YOLOv8n)</h4>
        <div className="bbox-cards-grid">
          {filteredDetections.map((det, idx) => {
            const cfg = CLASS_CONFIG[det.class_name] || {
              color: "#10b981",
              label: det.class_name,
              icon: "📍"
            };
            const [x, y, w, h] = det.bbox_normalized || [0, 0, 0, 0];
            const px = det.bbox_pixels || [0, 0, 0, 0];
            const isHovered = hoveredBoxIndex === idx;

            return (
              <div
                key={idx}
                className={`bbox-metric-card ${isHovered ? "hovered" : ""}`}
                style={{ "--card-border-color": cfg.color }}
                onMouseEnter={() => setHoveredBoxIndex(idx)}
                onMouseLeave={() => setHoveredBoxIndex(null)}
              >
                <div className="bbox-card-top">
                  <div className="bbox-card-name">
                    <span className="card-badge-bullet" style={{ backgroundColor: cfg.color }}></span>
                    <strong>{cfg.label}</strong>
                  </div>
                  <span
                    className="bbox-card-conf"
                    style={{ backgroundColor: `${cfg.color}22`, color: cfg.color, borderColor: cfg.color }}
                  >
                    {det.confidence_pct}% Conf
                  </span>
                </div>
                <div className="bbox-coords-row">
                  <span className="coord-label">Normalized [x,y,w,h]:</span>
                  <span className="coord-value font-mono">[{x.toFixed(2)}, {y.toFixed(2)}, {w.toFixed(2)}, {h.toFixed(2)}]</span>
                </div>
                <div className="bbox-coords-row">
                  <span className="coord-label">Pixels [x,y,w,h]:</span>
                  <span className="coord-value font-mono">[{px[0]}px, {px[1]}px, {px[2]}px, {px[3]}px]</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
