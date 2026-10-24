/**
 * KrishiLens Frontend API Client
 * Connects React UI to the Express backend (/api/scan, /api/detect, /api/health, /api/test-samples)
 */

export async function checkSystemHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: "offline",
      service: "KrishiLens API",
      environment: { has_hf_token: false },
      error: err.message
    };
  }
}

export async function getTestSamples() {
  try {
    const res = await fetch("/api/test-samples");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Could not fetch test samples:", err);
    return { test_cases: [] };
  }
}

export const fetchBenchmarkSamples = getTestSamples;

export async function scanPesticideLabel(imageInput, mode = "full") {
  const payload = {
    image: imageInput,
    mode: mode === "local" ? "local" : "auto",
  };

  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Server responded with HTTP ${response.status}`);
  }

  return await response.json();
}

export const analyzePesticideImage = scanPesticideLabel;

export async function detectObjects(imageInput, conf = 0.35) {
  const payload = {
    image: imageInput,
    conf
  };

  const response = await fetch("/api/detect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Server responded with HTTP ${response.status}`);
  }

  return await response.json();
}

