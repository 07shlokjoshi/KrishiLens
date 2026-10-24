import { CameraController } from "./camera.js";
import { LabelDetector } from "./detector.js";
import { SpeechReader } from "./speech.js";
import { YoloBBoxRenderer, runYoloDetect, checkYoloHealth } from "./yoloBBox.js";

// DOM Elements
const videoEl = document.getElementById("camera-video");
const canvasEl = document.getElementById("detector-canvas");
const previewImg = document.getElementById("preview-img");
const fileInput = document.getElementById("file-input");
const detectionPill = document.getElementById("detection-pill");
const detectionBox = document.getElementById("detection-box");
const appToast = document.getElementById("app-toast");

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
let toastTimeout = null;

// YOLO State
let yoloPreviewRenderer = null;
let yoloResultRenderer = null;
let lastYoloResult = null;

// Initialize
async function init() {
  setupNavigation();
  setupCamera();
  setupYolo();
  setupClickToCopy();
  loadBenchmarkPresets();
  checkHealth();
}

function showScreen(name) {
  Object.keys(screens).forEach((key) => {
    if (screens[key]) {
      screens[key].classList.toggle("active", key === name);
    }
  });

  // Stop camera if leaving camera screen
  if (name !== "camera" && camera) {
    detector?.stop();
    camera.stop();
  }

  // Stop any active speech on screen change
  if (name !== "results") {
    speech.stop();
    updateSpeechButtonState(false);
  }

  // Smooth scroll to top of view
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  if (!appToast) return;
  if (toastTimeout) clearTimeout(toastTimeout);

  appToast.textContent = message;
  appToast.classList.add("visible");

  toastTimeout = setTimeout(() => {
    appToast.classList.remove("visible");
  }, 2400);
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
    showToast(isOn ? "Flashlight Activated" : "Flashlight Off");
  });

  document.getElementById("btn-flip-cam")?.addEventListener("click", async () => {
    await camera?.switchCamera();
    showToast("Camera Switched");
  });

  // Preview buttons
  document.getElementById("btn-retake")?.addEventListener("click", () => {
    showScreen("home");
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
    tab.addEventListener("click", () => {
      document.querySelectorAll(".lang-tab").forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      selectedLanguage = tab.dataset.lang || "en";
      renderLanguageContent();

      // If speech was playing, restart in new language
      if (speech.isSpeaking) {
        speech.stop();
        triggerSpeechReadout();
      }
    });
  });
}

function setupClickToCopy() {
  document.querySelectorAll(".spec-card").forEach((card) => {
    card.style.cursor = "pointer";
    card.setAttribute("title", "Click to copy field to clipboard");
    card.addEventListener("click", () => {
      const valEl = card.querySelector(".spec-value");
      if (valEl && valEl.textContent && !valEl.classList.contains("null-value")) {
        navigator.clipboard?.writeText(valEl.textContent.trim()).then(() => {
          showToast(`Copied: "${valEl.textContent.trim().substring(0, 24)}..."`);
        }).catch(() => {});
      }
    });
  });
}

function setupYolo() {
  // Preview YOLO button
  document.getElementById("btn-run-yolo")?.addEventListener("click", () => {
    if (currentCapturedImage) {
      runYoloOnPreview(currentCapturedImage);
    } else {
      showToast("No image loaded — capture or upload first.");
    }
  });

  // Initialize preview renderer
  const previewImg = document.getElementById("preview-img");
  const previewCanvas = document.getElementById("yolo-bbox-canvas");
  if (previewImg && previewCanvas) {
    yoloPreviewRenderer = new YoloBBoxRenderer(previewImg, previewCanvas);
  }

  // Initialize results renderer
  const resultImg = document.getElementById("yolo-result-img");
  const resultCanvas = document.getElementById("yolo-result-canvas");
  if (resultImg && resultCanvas) {
    yoloResultRenderer = new YoloBBoxRenderer(resultImg, resultCanvas);
  }
}

async function runYoloOnPreview(imageDataUri) {
  const yoloBtn = document.getElementById("btn-run-yolo");
  const panel = document.getElementById("yolo-preview-panel");
  const badge = document.getElementById("yolo-badge");
  const list = document.getElementById("yolo-detections-list");
  const offlineNotice = document.getElementById("yolo-offline-notice");

  if (yoloBtn) {
    yoloBtn.disabled = true;
    yoloBtn.querySelector(".btn-text").textContent = "Detecting...";
  }

  if (panel) panel.style.display = "block";
  if (offlineNotice) offlineNotice.style.display = "none";
  if (list) list.innerHTML = `<div class="yolo-loading"><span class="preset-spinner"></span> Running YOLO inference...</div>`;

  try {
    const result = await runYoloDetect(imageDataUri);
    lastYoloResult = result;

    if (!result.available || result.error === "YOLO_SERVER_OFFLINE") {
      if (offlineNotice) offlineNotice.style.display = "flex";
      if (list) list.innerHTML = "";
      if (badge) badge.textContent = "Server offline";
      badge.className = "yolo-badge yolo-badge-error";
      showToast("⚠️ YOLO server offline — run the Python sidecar");
      return;
    }

    if (result.error) {
      if (list) list.innerHTML = `<p class="yolo-error">${result.message}</p>`;
      if (badge) { badge.textContent = "Error"; badge.className = "yolo-badge yolo-badge-error"; }
      return;
    }

    // Render bounding boxes on preview
    if (yoloPreviewRenderer) {
      // Wait for image to be fully loaded before rendering
      const img = document.getElementById("preview-img");
      if (img.complete) {
        yoloPreviewRenderer.render(result);
      } else {
        img.onload = () => yoloPreviewRenderer.render(result);
      }
    }

    // Update badge
    const n = result.num_detections || 0;
    if (badge) {
      badge.textContent = `${n} object${n !== 1 ? "s" : ""} detected`;
      badge.className = n > 0 ? "yolo-badge yolo-badge-ok" : "yolo-badge yolo-badge-warn";
    }

    // Render detection list
    if (list) {
      if (n === 0) {
        list.innerHTML = `<p class="yolo-no-detect">No objects detected above threshold. Try lowering confidence or improving image quality.</p>`;
      } else {
        list.innerHTML = result.detections.map(d => `
          <div class="yolo-det-row" style="border-left:3px solid ${d.color};">
            <span class="yolo-det-class" style="color:${d.color};">${formatClassName(d.class_name)}</span>
            <span class="yolo-det-conf">${Math.round(d.confidence * 100)}%</span>
            <span class="yolo-det-coords">cx=${d.bbox_norm[0].toFixed(3)} cy=${d.bbox_norm[1].toFixed(3)} w=${d.bbox_norm[2].toFixed(3)} h=${d.bbox_norm[3].toFixed(3)}</span>
          </div>
        `).join("");
      }
    }

    showToast(`YOLO: ${n} object${n !== 1 ? "s" : ""} detected (${result.latency_ms}ms)`);
  } catch (err) {
    if (list) list.innerHTML = `<p class="yolo-error">Error: ${err.message}</p>`;
    if (badge) { badge.textContent = "Failed"; badge.className = "yolo-badge yolo-badge-error"; }
    console.error("YOLO detect error:", err);
  } finally {
    if (yoloBtn) {
      yoloBtn.disabled = false;
      yoloBtn.querySelector(".btn-text").textContent = "Run YOLO Detection";
    }
  }
}

function formatClassName(name) {
  const map = {
    pesticide_package: "Pesticide Package",
    cibrc_label: "CIB&RC Label",
    toxicity_triangle: "Toxicity Triangle",
    cibrc_reg_stamp: "Registration Stamp",
  };
  return map[name] || name;
}

function renderYoloResults(imageDataUri, yoloData) {
  const panel = document.getElementById("yolo-results-panel");
  const offlineEl = document.getElementById("yolo-res-offline");
  const badge = document.getElementById("yolo-res-badge");
  const metricEl = document.getElementById("yolo-model-metrics");
  const list = document.getElementById("yolo-res-detections");
  const resultImg = document.getElementById("yolo-result-img");

  if (!panel) return;
  panel.style.display = "block";

  if (!yoloData || !yoloData.available || yoloData.error === "YOLO_SERVER_OFFLINE") {
    if (offlineEl) offlineEl.style.display = "flex";
    if (badge) { badge.textContent = "Server offline"; badge.className = "yolo-badge yolo-badge-error"; }
    return;
  }

  if (offlineEl) offlineEl.style.display = "none";

  // Show annotated image
  if (resultImg) {
    resultImg.src = imageDataUri;
    resultImg.onload = () => {
      if (yoloResultRenderer && yoloData.num_detections > 0) {
        yoloResultRenderer.render(yoloData);
      }
    };
  }

  // Badge
  const n = yoloData.num_detections || 0;
  if (badge) {
    badge.textContent = `${n} object${n !== 1 ? "s" : ""} (${yoloData.latency_ms}ms)`;
    badge.className = n > 0 ? "yolo-badge yolo-badge-ok" : "yolo-badge yolo-badge-warn";
  }

  // Model metrics
  if (metricEl) {
    const m = yoloData.model_metrics || {};
    const items = [];
    if (m.val_mAP50 != null) items.push(`mAP@50: ${(m.val_mAP50 * 100).toFixed(1)}%`);
    if (m.val_mAP50_95 != null) items.push(`mAP@50-95: ${(m.val_mAP50_95 * 100).toFixed(1)}%`);
    if (m.val_precision != null) items.push(`P: ${(m.val_precision * 100).toFixed(1)}%`);
    if (m.val_recall != null) items.push(`R: ${(m.val_recall * 100).toFixed(1)}%`);
    if (m.winning_experiment) items.push(`Model: ${m.winning_experiment}`);
    metricEl.innerHTML = items.map(i => `<span class="yolo-metric-pill">${i}</span>`).join("");
  }

  // Detections list
  if (list) {
    if (n === 0) {
      list.innerHTML = `<p class="yolo-no-detect">No objects detected above threshold (conf≥0.25).</p>`;
    } else {
      list.innerHTML = yoloData.detections.map(d => `
        <div class="yolo-det-row" style="border-left:3px solid ${d.color};">
          <span class="yolo-det-class" style="color:${d.color};">${formatClassName(d.class_name)}</span>
          <span class="yolo-det-conf">${Math.round(d.confidence * 100)}%</span>
          <span class="yolo-det-bbox">x1=${d.bbox_pixels.x1.toFixed(0)} y1=${d.bbox_pixels.y1.toFixed(0)} ${d.bbox_pixels.width.toFixed(0)}×${d.bbox_pixels.height.toFixed(0)}px</span>
        </div>
      `).join("");
    }
  }
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
    showErrorScreen("Camera Permission Error", res.message || "Could not access device camera. Please grant camera permissions or use the upload button.");
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
    detectionPill.innerHTML = `
      <span class="pill-dot" style="background:#10B981;box-shadow:0 0 6px #10B981"></span>
      <span class="pill-msg">🟢 LABEL LOCKED (${stability}% STABLE)</span>
    `;
  } else if (stability > 15) {
    detectionBox.className = "detection-box scanning";
    detectionPill.innerHTML = `
      <span class="pill-dot" style="background:#E4A13B;box-shadow:0 0 6px #E4A13B"></span>
      <span class="pill-msg">🟡 TRACKING PACKAGING (${stability}%)</span>
    `;
  } else if (isBlurry) {
    detectionBox.className = "detection-box";
    detectionPill.innerHTML = `
      <span class="pill-dot" style="background:#B83A32;box-shadow:0 0 6px #B83A32"></span>
      <span class="pill-msg">⚠️ HOLD STEADY — IMAGE BLURRY</span>
    `;
  } else {
    detectionBox.className = "detection-box";
    detectionPill.innerHTML = `
      <span class="pill-dot"></span>
      <span class="pill-msg">ALIGN PESTICIDE LABEL IN RETICLE</span>
    `;
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
      showErrorScreen("No Pesticide Packaging Detected", data.safety_advisory || "The optical sensor could not locate a recognized pesticide container or statutory label in this image.");
      return;
    }

    renderResults(data);
    showScreen("results");
  } catch (err) {
    console.error("Analysis failed:", err);
    showErrorScreen("Network or Analysis Error", "Failed to analyze image: " + err.message);
    return;
  }

  // Run YOLO detection in parallel (non-blocking, never fails the main flow)
  runYoloDetect(currentCapturedImage || imageDataUri)
    .then(yoloResult => {
      lastYoloResult = yoloResult;
      renderYoloResults(currentCapturedImage || imageDataUri, yoloResult);
    })
    .catch(err => {
      console.warn("YOLO detection failed silently:", err);
      renderYoloResults(currentCapturedImage || imageDataUri, { available: false, error: "YOLO_SERVER_OFFLINE" });
    });
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
  }, 950);

  setTimeout(() => {
    if (step3) step3.className = "step-item done";
    if (step4) step4.className = "step-item active";
  }, 1500);
}

function renderResults(data) {
  // Provenance Banner
  const provEl = document.getElementById("res-provenance");
  if (provEl) {
    provEl.textContent = data.inference_metadata?.source || "Gemma 4 Multimodal";
  }

  // Toxicity Card
  const toxCard = document.getElementById("res-tox-card");
  const toxSignal = document.getElementById("res-tox-signal");
  const toxDesc = document.getElementById("res-tox-desc");
  const toxBadge = document.getElementById("res-tox-badge");

  const tox = data.toxicity_category || { color: "Blue", signalWord: "DANGER", riskLevel: "Moderate Risk" };
  const colorClass = `category-${tox.color.toLowerCase()}`;

  if (toxCard) {
    toxCard.className = `toxicity-hazard-plate ${colorClass}`;
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
      warningsContainer.innerHTML = "<span class='spec-value null-value'>No specific warnings legible on packaging</span>";
    }
  }

  // Safety Advisory Disclaimer
  const advEl = document.getElementById("res-safety-advisory");
  if (advEl) {
    advEl.textContent = data.safety_advisory || "Follow statutory precautions under Insecticides Rules 1971.";
  }

  // Uncertainty Box
  const uncertBox = document.getElementById("res-uncertainty-box");
  const uncertNotes = document.getElementById("res-uncertainty-notes");
  if (uncertBox && uncertNotes) {
    if (data.unreadable_fields && data.unreadable_fields.length > 0) {
      uncertBox.style.display = "flex";
      uncertNotes.textContent = `Unreadable or missing packaging fields: ${data.unreadable_fields.join(", ")}. Notes: ${data.confidence_or_uncertainty?.notes || ""}`;
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
    el.className = isHighlight ? "spec-value product-highlight" : "spec-value";
  } else {
    el.textContent = "Not legible or unprinted on packaging";
    el.className = "spec-value null-value";
  }
}

function renderLanguageContent() {
  if (!currentResultData || !currentResultData.explanations) return;
  const expl = currentResultData.explanations[selectedLanguage] || currentResultData.explanations.en;

  const summaryEl = document.getElementById("res-farmer-summary");
  if (summaryEl && expl) {
    summaryEl.innerHTML = `<strong>${expl.signal}:</strong> ${expl.summary} <br><span style="color: #173F32; font-weight: 700; margin-top: 4px; display: inline-block;">${expl.waitingPeriod}</span>`;
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

function updateSpeechButtonState(isSpeaking) {
  const btn = document.getElementById("btn-speak-safety");
  if (!btn) return;

  const icon = btn.querySelector(".speaker-state-icon");
  const text = btn.querySelector(".speaker-btn-text");

  if (isSpeaking) {
    if (icon) icon.textContent = "◼";
    if (text) text.textContent = "Stop Voice";
    btn.style.borderColor = "#E4A13B";
  } else {
    if (icon) icon.textContent = "▶";
    if (text) text.textContent = "Read Aloud";
    btn.style.borderColor = "";
  }
}

function triggerSpeechReadout() {
  if (!currentResultData) return;

  if (speech.isSpeaking) {
    speech.stop();
    updateSpeechButtonState(false);
    return;
  }

  const expl = currentResultData.explanations?.[selectedLanguage] || currentResultData.explanations?.en;
  const textToRead = `${expl?.title || ""}. ${expl?.summary || ""}. ${expl?.waitingPeriod || ""}. ${currentResultData.first_aid_text ? "First aid: " + currentResultData.first_aid_text : ""}`;

  speech.speak(textToRead, selectedLanguage, (isSpeaking) => {
    updateSpeechButtonState(isSpeaking);
  });
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
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Load specimen: ${tc.category}`);
      card.innerHTML = `
        <img class="preset-img" src="${tc.imageUrl}" alt="${tc.id}" loading="lazy" />
        <div class="preset-name">${tc.category.replace(/_/g, " ")}</div>
        <div class="preset-meta">${tc.id.substring(0, 18)}...</div>
      `;

      const selectPreset = () => {
        currentCapturedImage = tc.imageUrl;
        previewImg.src = tc.imageUrl;
        showScreen("preview");
        showToast(`Loaded Specimen: ${tc.category.replace(/_/g, " ")}`);
      };

      card.addEventListener("click", selectPreset);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectPreset();
        }
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
      const yoloOnline = data.environment?.yolo_server === "online";
      const hasHf = data.environment?.has_hf_token;
      if (hasHf && yoloOnline) {
        text.textContent = "Gemma 4 + YOLO Online";
      } else if (hasHf) {
        text.textContent = "Gemma 4 Online";
      } else if (yoloOnline) {
        text.textContent = "YOLO Online (Local)";
      } else {
        text.textContent = "Local CIB&RC Mode";
      }
    }
  } catch {
    const text = document.getElementById("header-status-text");
    if (text) text.textContent = "Offline Mode";
  }
}

// Start
document.addEventListener("DOMContentLoaded", init);
