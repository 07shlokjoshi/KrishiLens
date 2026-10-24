/**
 * Real-Time Edge & Packaging Label Detector
 * Executes lightweight computer vision in a background canvas (12 FPS)
 * to locate packaging boundaries and measure camera stability.
 */
export class LabelDetector {
  constructor(videoElement, canvasElement, options = {}) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.isRunning = false;
    this.animationId = null;

    this.onDetectionChange = options.onDetectionChange || (() => {});
    this.onAutoCapture = options.onAutoCapture || (() => {});

    // Detection state
    this.isDetected = false;
    this.stabilityScore = 0; // 0 to 100
    this.lastProcessTime = 0;
    this.processInterval = 80; // ~12 fps to preserve mobile battery
    this.currentRect = { x: 0.1, y: 0.18, width: 0.8, height: 0.64 };
  }

  start() {
    this.isRunning = true;
    this.stabilityScore = 0;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  loop(timestamp = 0) {
    if (!this.isRunning) return;

    if (timestamp - this.lastProcessTime >= this.processInterval) {
      this.lastProcessTime = timestamp;
      this.processFrame();
    }

    this.animationId = requestAnimationFrame((ts) => this.loop(ts));
  }

  processFrame() {
    if (!this.video || this.video.readyState !== 4) return;

    const width = this.canvas.width = this.video.videoWidth || 640;
    const height = this.canvas.height = this.video.videoHeight || 480;

    // Use a small offscreen canvas for fast pixel analysis
    const sampleWidth = 160;
    const sampleHeight = 120;
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCanvas.width = sampleWidth;
      this.offscreenCanvas.height = sampleHeight;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }

    this.offscreenCtx.drawImage(this.video, 0, 0, sampleWidth, sampleHeight);
    const frameData = this.offscreenCtx.getImageData(0, 0, sampleWidth, sampleHeight);
    const pixels = frameData.data;

    // 1. Analyze center region for gradient contrast & text-like high frequency patterns
    let totalGradient = 0;
    let samplePoints = 0;
    let luminanceVariance = 0;
    let sumLum = 0;
    let lumValues = [];

    const startX = Math.floor(sampleWidth * 0.2);
    const endX = Math.floor(sampleWidth * 0.8);
    const startY = Math.floor(sampleHeight * 0.25);
    const endY = Math.floor(sampleHeight * 0.75);

    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * sampleWidth + x) * 4;
        const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        sumLum += lum;
        lumValues.push(lum);

        // Simple horizontal gradient
        const nextIdx = (y * sampleWidth + (x + 1)) * 4;
        const nextLum = 0.299 * pixels[nextIdx] + 0.587 * pixels[nextIdx + 1] + 0.114 * pixels[nextIdx + 2];
        totalGradient += Math.abs(lum - nextLum);
        samplePoints++;
      }
    }

    const avgLum = sumLum / samplePoints;
    let varSum = 0;
    for (let i = 0; i < lumValues.length; i++) {
      varSum += Math.pow(lumValues[i] - avgLum, 2);
    }
    luminanceVariance = Math.sqrt(varSum / samplePoints);
    const avgGradient = totalGradient / samplePoints;

    // Blurry check: very low gradient (< 4) in central region
    const isBlurry = avgGradient < 5.0 && luminanceVariance > 10;
    // Label detection heuristic: adequate edge density + good contrast
    const detected = avgGradient > 8.5 && luminanceVariance > 18;

    if (detected) {
      this.stabilityScore = Math.min(100, this.stabilityScore + 8);
    } else {
      this.stabilityScore = Math.max(0, this.stabilityScore - 12);
    }

    this.isDetected = this.stabilityScore > 40;

    // Render bounding box overlay
    this.drawOverlay(width, height, this.isDetected, this.stabilityScore);

    // Notify listeners
    this.onDetectionChange({
      detected: this.isDetected,
      stability: this.stabilityScore,
      isBlurry,
      avgGradient: Math.round(avgGradient),
      rect: this.currentRect,
    });

    // Auto-capture trigger when highly stable
    if (this.stabilityScore >= 95) {
      this.onAutoCapture({ rect: this.currentRect });
      this.stabilityScore = 0; // reset
    }
  }

  drawOverlay(w, h, detected, stability) {
    this.ctx.clearRect(0, 0, w, h);

    const rx = this.currentRect.x * w;
    const ry = this.currentRect.y * h;
    const rw = this.currentRect.width * w;
    const rh = this.currentRect.height * h;

    const cornerLength = Math.min(rw, rh) * 0.15;
    const color = detected ? "#10b981" : stability > 15 ? "#f59e0b" : "rgba(255, 255, 255, 0.4)";

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = detected ? 4 : 2;
    this.ctx.lineCap = "round";

    // Draw 4 corner reticles
    // Top-Left
    this.ctx.beginPath();
    this.ctx.moveTo(rx, ry + cornerLength);
    this.ctx.lineTo(rx, ry);
    this.ctx.lineTo(rx + cornerLength, ry);
    this.ctx.stroke();

    // Top-Right
    this.ctx.beginPath();
    this.ctx.moveTo(rx + rw - cornerLength, ry);
    this.ctx.lineTo(rx + rw, ry);
    this.ctx.lineTo(rx + rw, ry + cornerLength);
    this.ctx.stroke();

    // Bottom-Left
    this.ctx.beginPath();
    this.ctx.moveTo(rx, ry + rh - cornerLength);
    this.ctx.lineTo(rx, ry + rh);
    this.ctx.lineTo(rx + cornerLength, ry + rh);
    this.ctx.stroke();

    // Bottom-Right
    this.ctx.beginPath();
    this.ctx.moveTo(rx + rw - cornerLength, ry + rh);
    this.ctx.lineTo(rx + rw, ry + rh);
    this.ctx.lineTo(rx + rw, ry + rh - cornerLength);
    this.ctx.stroke();

    if (detected) {
      // Glow effect
      this.ctx.shadowColor = "#10b981";
      this.ctx.shadowBlur = 12;
      this.ctx.strokeRect(rx, ry, rw, rh);
      this.ctx.shadowBlur = 0;
    }
  }
}
