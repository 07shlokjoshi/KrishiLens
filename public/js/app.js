import { CameraController } from "./camera.js";
import { LabelDetector } from "./detector.js";
import { SpeechReader } from "./speech.js";

// DOM Elements
const videoEl = document.getElementById("camera-video");
const canvasEl = document.getElementById("detector-canvas");
const previewImg = document.getElementById("preview-img");
const fileInput = document.getElementById("file-input");
const detectionPill = document.getElementById("detection-pill");
const detectionBox = document.getElementById("detection-box");
const stabilityMeter = document.getElementById("stability-meter");

// Screens
const screens = {
  home: document.getElementById("screen-home"),
  camera: document.getElementById("screen-camera"),
  preview: document.getElementById("screen-preview"),
  processing: document.getElementById("screen-processing"),
  results: document.getElementById("screen-results"),
  error: document.getElementById("screen-error"),
};

// Controllers
let camera = null;
let detector = null;
const speech = new SpeechReader();

let currentCapturedImage = null;
let currentResultData = null;
let selectedLanguage = "en";
let currentCropRect = null;

// Initialize
async function init() {
  setupNavigation();
  setupCamera();
  loadBenchmarkPresets();
  checkHealth();
}

function showScreen(name) {
  Object.keys(screens).forEach((key) => {
    if (screens[key]) {
      screens[key].classList.toggle("active", key === name);
    }
  });

  if (name !== "camera" && camera) {
    detector?.stop();
    camera.stop();
  }
}

function setupNavigation() {
  // Home buttons
  document.getElementById("btn-start-scan")?.addEventListener("click", () => {
    startCameraWorkflow();
  });

  document.getElementById("btn-upload-file")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  });

  // Camera buttons
  document.getElementById("btn-cam-back")?.addEventListener("click", () => {
    showScreen("home");
  });

  document.getElementById("btn-shutter")?.addEventListener("click", () => {
    captureLabelPhoto();
  });

  document.getElementById("btn-toggle-torch")?.addEventListener("click", async () => {
    const isOn = await camera?.toggleTorch();
    document.getElementById("btn-toggle-torch")?.classList.toggle("active", isOn);
  });

  document.getElementById("btn-flip-cam")?.addEventListener("click", async () => {
    await camera?.switchCamera();
  });

  // Preview buttons
  document.getElementById("btn-retake")?.addEventListener("click", () => {
    startCameraWorkflow();
  });

  document.getElementById("btn-analyze-now")?.addEventListener("click", () => {
    if (currentCapturedImage) {
      processImageAnalysis(currentCapturedImage);
    }
  });

  // Result buttons
  document.getElementById("btn-scan-another")?.addEventListener("click", () => {
    speech.stop();
    startCameraWorkflow();
  });

  document.getElementById("btn-home-from-result")?.addEventListener("click", () => {
    speech.stop();
    showScreen("home");
  });

  document.getElementById("btn-speak-safety")?.addEventListener("click", () => {
    triggerSpeechReadout();
  });

  // Error screen retry
  document.getElementById("btn-error-retry")?.addEventListener("click", () => {
    startCameraWorkflow();
  });
  document.getElementById("btn-error-home")?.addEventListener("click", () => {
    showScreen("home");
  });

  // Language Tabs
  document.querySelectorAll(".lang-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".lang-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      selectedLanguage = tab.dataset.lang || "en";
      renderLanguageContent();
    });
  });
}

function setupCamera() {
  camera = new CameraController(videoEl);
  detector = new LabelDetector(videoEl, canvasEl, {
    onDetectionChange: (info) => {
      updateDetectionUI(info);
    },
    onAutoCapture: (info) => {
      console.log("Auto-capture triggered by label stability:", info);
      currentCropRect = info.rect;
      captureLabelPhoto();
    },
  });
}

async function startCameraWorkflow() {
  showScreen("camera");
  const res = await camera.start();
  if (!res.success) {
    showErrorScreen("Camera Permission Error", res.message || "Could not access device camera. Please allow camera permissions or use the upload button.");
    return;
  }

  // Toggle torch button visibility if device supports it
  const torchBtn = document.getElementById("btn-toggle-torch");
  if (torchBtn) {
    torchBtn.style.display = res.hasTorch ? "flex" : "none";
  }

  detector.start();
}

function updateDetectionUI({ detected, stability, isBlurry }) {
  if (!detectionPill || !detectionBox) return;

  if (detected) {
    detectionBox.className = "detection-box detected";
    detectionPill.innerHTML = `🟢 Label Detected (${stability}% stable)`;
  } else if (stability > 15) {
    detectionBox.className = "detection-box scanning";
    detectionPill.innerHTML = `🟡 Stabilizing Packaging (${stability}%)`;
  } else if (isBlurry) {
    detectionBox.className = "detection-box";
    detectionPill.innerHTML = `⚠️ Image Blurry — Hold Steady or Move Closer`;
  } else {
    detectionBox.className = "detection-box";
    detectionPill.innerHTML = `🔍 Align Pesticide Label in Frame`;
  }
}

function captureLabelPhoto() {
  if (!camera) return;
  detector.stop();

  // Capture frame
  const dataUri = camera.captureFrame(null);
  camera.stop();

  if (!dataUri) {
    showErrorScreen("Capture Error", "Failed to capture image frame from video feed.");
    return;
  }

  currentCapturedImage = dataUri;
  if (previewImg) previewImg.src = dataUri;
  showScreen("preview");
}

function handleFileSelected(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    currentCapturedImage = e.target.result;
    if (previewImg) previewImg.src = currentCapturedImage;
    showScreen("preview");
  };
  reader.readAsDataURL(file);
}

async function processImageAnalysis(imageDataUri) {
  showScreen("processing");
  animateProcessingSteps();

  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUri }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    currentResultData = data;

    if (!data.label_detected && data.status === "NO_LABEL_DETECTED") {
      showErrorScreen("No Pesticide Label Detected", data.safety_advisory || "The camera could not find a recognized pesticide container or label in this image.");
      return;
    }

    renderResults(data);
    showScreen("results");
  } catch (err) {
    console.error("Analysis failed:", err);
    showErrorScreen("Network or Analysis Error", "Failed to analyze image: " + err.message);
  }
}

function animateProcessingSteps() {
  const step1 = document.getElementById("proc-step-1");
  const step2 = document.getElementById("proc-step-2");
  const step3 = document.getElementById("proc-step-3");
  const step4 = document.getElementById("proc-step-4");

  const reset = () => {
    [step1, step2, step3, step4].forEach((s) => s && (s.className = "step-item"));
  };

  reset();
  if (step1) step1.className = "step-item active";

  setTimeout(() => {
    if (step1) step1.className = "step-item done";
    if (step2) step2.className = "step-item active";
  }, 400);

  setTimeout(() => {
    if (step2) step2.className = "step-item done";
    if (step3) step3.className = "step-item active";
  }, 900);

  setTimeout(() => {
    if (step3) step3.className = "step-item done";
    if (step4) step4.className = "step-item active";
  }, 1400);
}

function renderResults(data) {
  // Provenance Banner
  const provEl = document.getElementById("res-provenance");
  if (provEl) {
    provEl.textContent = data.inference_metadata?.source || "AI Inference";
  }

  // Toxicity Card
  const toxCard = document.getElementById("res-tox-card");
  const toxSignal = document.getElementById("res-tox-signal");
  const toxDesc = document.getElementById("res-tox-desc");
  const toxBadge = document.getElementById("res-tox-badge");

  const tox = data.toxicity_category || { color: "Blue", signalWord: "DANGER", riskLevel: "Moderate Risk" };
  const colorClass = `category-${tox.color.toLowerCase()}`;

  if (toxCard) {
    toxCard.className = `toxicity-hazard-card ${colorClass}`;
  }
  if (toxSignal) {
    toxSignal.innerHTML = `${tox.symbol || "⚠️"} ${tox.signalWord} (${tox.color} Triangle)`;
  }
  if (toxDesc) {
    toxDesc.textContent = tox.riskLevel;
  }
  if (toxBadge) {
    toxBadge.textContent = tox.oralLD50 ? `Oral LD50: ${tox.oralLD50}` : tox.code || "";
  }

  // Fields
  setFieldValue("res-product-name", data.product_name, true);
  setFieldValue("res-active-ingredient", data.active_ingredient);
  setFieldValue("res-concentration", data.concentration);
  setFieldValue("res-reg-no", data.registration_number);
  setFieldValue("res-directions", data.directions_text);
  setFieldValue("res-first-aid", data.first_aid_text);
  setFieldValue("res-storage", data.storage_instructions);

  // Safety Warnings
  const warningsContainer = document.getElementById("res-warnings-list");
  if (warningsContainer) {
    warningsContainer.innerHTML = "";
    if (Array.isArray(data.safety_warnings) && data.safety_warnings.length > 0) {
      data.safety_warnings.forEach((w) => {
        const li = document.createElement("li");
        li.textContent = w;
        warningsContainer.appendChild(li);
      });
    } else {
      warningsContainer.innerHTML = "<span class='null-value'>No specific warnings legible</span>";
    }
  }

  // Safety Advisory Disclaimer
  const advEl = document.getElementById("res-safety-advisory");
  if (advEl) {
    advEl.textContent = data.safety_advisory || "Follow statutory precautions.";
  }

  // Uncertainty Box
  const uncertBox = document.getElementById("res-uncertainty-box");
  const uncertNotes = document.getElementById("res-uncertainty-notes");
  if (uncertBox && uncertNotes) {
    if (data.unreadable_fields && data.unreadable_fields.length > 0) {
      uncertBox.style.display = "block";
      uncertNotes.textContent = `Unreadable/Missing fields: ${data.unreadable_fields.join(", ")}. Notes: ${data.confidence_or_uncertainty?.notes || ""}`;
    } else {
      uncertBox.style.display = "none";
    }
  }

  renderLanguageContent();
}

function setFieldValue(elementId, value, isHighlight = false) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (value && String(value).trim().length > 0) {
    el.textContent = value;
    el.className = isHighlight ? "field-value highlight" : "field-value";
  } else {
    el.textContent = "Not legible or unprinted on packaging";
    el.className = "field-value null-value";
  }
}

function renderLanguageContent() {
  if (!currentResultData || !currentResultData.explanations) return;
  const expl = currentResultData.explanations[selectedLanguage] || currentResultData.explanations.en;

  const summaryEl = document.getElementById("res-farmer-summary");
  if (summaryEl && expl) {
    summaryEl.innerHTML = `<strong>${expl.signal}:</strong> ${expl.summary} <br><span style="color: #10b981;">${expl.waitingPeriod}</span>`;
  }

  // Update PPE Chips
  const ppeContainer = document.getElementById("res-ppe-chips");
  if (ppeContainer && expl?.ppeNeeded) {
    ppeContainer.innerHTML = "";
    expl.ppeNeeded.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "ppe-chip";
      chip.innerHTML = `🛡️ ${item}`;
      ppeContainer.appendChild(chip);
    });
  }
}

function triggerSpeechReadout() {
  if (!currentResultData) return;
  const expl = currentResultData.explanations?.[selectedLanguage] || currentResultData.explanations?.en;
  const textToRead = `${expl?.title || ""}. ${expl?.summary || ""}. ${expl?.waitingPeriod || ""}. ${currentResultData.first_aid_text ? "First aid: " + currentResultData.first_aid_text : ""}`;
  speech.speak(textToRead, selectedLanguage);
}

function showErrorScreen(title, message) {
  const tEl = document.getElementById("error-title");
  const mEl = document.getElementById("error-message");
  if (tEl) tEl.textContent = title;
  if (mEl) mEl.textContent = message;
  showScreen("error");
}

async function loadBenchmarkPresets() {
  const container = document.getElementById("presets-container");
  if (!container) return;

  try {
    const res = await fetch("/api/test-samples");
    if (!res.ok) return;
    const data = await res.json();
    const cases = data.test_cases || [];

    container.innerHTML = "";
    cases.forEach((tc) => {
      const card = document.createElement("div");
      card.className = "preset-card";
      card.innerHTML = `
        <img class="preset-img" src="${tc.imageUrl}" alt="${tc.id}" loading="lazy" />
        <div class="preset-name">${tc.category.replace(/_/g, " ")}</div>
        <div class="preset-meta">${tc.id.substring(0, 18)}...</div>
      `;
      card.addEventListener("click", () => {
        // Load preset into preview directly
        currentCapturedImage = tc.imageUrl;
        previewImg.src = tc.imageUrl;
        showScreen("preview");
      });
      container.appendChild(card);
    });
  } catch (err) {
    console.warn("Could not load benchmark presets:", err);
  }
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    const pill = document.getElementById("header-status-pill");
    const text = document.getElementById("header-status-text");

    if (pill && text) {
      if (data.environment?.has_hf_token) {
        text.textContent = "Gemma 4 Ready";
      } else {
        text.textContent = "Local OCR Mode";
      }
    }
  } catch {
    // offline
  }
}

// Start
document.addEventListener("DOMContentLoaded", init);
