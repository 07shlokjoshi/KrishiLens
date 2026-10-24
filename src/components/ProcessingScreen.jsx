import React, { useEffect, useState } from "react";

const STAGES = [
  { id: 1, label: "Frame Normalization & Contrast Calibration", detail: "Applying bilateral filtering and aspect stabilization" },
  { id: 2, label: "YOLOv8n Neural Bounding Box Inference", detail: "Detecting pesticide_package, cibrc_label, and toxicity_triangle" },
  { id: 3, label: "Statutory CIB&RC Database Matching", detail: "Querying Central Insecticides Board & Registration Committee records" },
  { id: 4, label: "Multilingual Safety & LD50 Synthesis", detail: "Generating farmer advisory in English, Hindi, and Marathi" }
];

export function ProcessingScreen() {
  const [activeStage, setActiveStage] = useState(1);

  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStage(2), 700);
    const timer2 = setTimeout(() => setActiveStage(3), 1600);
    const timer3 = setTimeout(() => setActiveStage(4), 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="processing-screen-container" role="status" aria-live="polite">
      <div className="processing-chassis-card">
        {/* Optical Gyroscope Unit */}
        <div className="gyroscope-lens-unit">
          <div className="gyro-outer-ring"></div>
          <div className="gyro-middle-ring"></div>
          <div className="gyro-inner-glass">
            <div className="gyro-laser-sweep"></div>
            <div className="gyro-iris-blades"></div>
            <div className="gyro-core-chip">
              <span className="chip-pulsar"></span>
            </div>
          </div>
        </div>

        {/* Processing Telemetry Banner */}
        <div className="processing-banner">
          <h2 className="processing-main-title">Processing Optical Specimen</h2>
          <p className="processing-subtext">
            Executing deep learning inference and statutory safety verification
          </p>
        </div>

        {/* Pipeline Stage Indicators */}
        <div className="pipeline-stages-list">
          {STAGES.map((stg) => {
            const isCompleted = activeStage > stg.id;
            const isCurrent = activeStage === stg.id;

            return (
              <div
                key={stg.id}
                className={`pipeline-stage-item ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
              >
                <div className="stage-bullet">
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="stage-num">{stg.id}</span>
                  )}
                </div>
                <div className="stage-content">
                  <div className="stage-label">{stg.label}</div>
                  <div className="stage-detail">{stg.detail}</div>
                </div>
                {isCurrent && <span className="stage-pulsar"></span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
