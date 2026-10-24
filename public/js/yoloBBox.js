/**
 * KrishiLens YOLO Bounding Box Renderer
 * =======================================
 * Draws real YOLO-predicted bounding boxes over an <img> element onto a <canvas>.
 * Coordinates stay aligned even when the image is displayed at a different size.
 *
 * Usage:
 *   const renderer = new YoloBBoxRenderer(imgElement, canvasElement);
 *   renderer.render(detectionResult);   // from /api/yolo/detect
 *   renderer.clear();
 */

export class YoloBBoxRenderer {
  /**
   * @param {HTMLImageElement} imgEl  - The image being annotated
   * @param {HTMLCanvasElement} canvasEl - Overlay canvas (positioned over the img)
   */
  constructor(imgEl, canvasEl) {
    this.img = imgEl;
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this.detections = [];
    this._resizeObserver = null;
    this._setupResizeObserver();
  }

  /**
   * Class color palette matching the Python server.
   */
  static CLASS_COLORS = {
    pesticide_package:  { fill: "rgba(16,185,129,0.15)",  stroke: "#10b981", label: "#10b981" },
    cibrc_label:        { fill: "rgba(59,130,246,0.15)",  stroke: "#3b82f6", label: "#3b82f6" },
    toxicity_triangle:  { fill: "rgba(239,68,68,0.20)",   stroke: "#ef4444", label: "#ef4444" },
    cibrc_reg_stamp:    { fill: "rgba(245,158,11,0.15)",  stroke: "#f59e0b", label: "#f59e0b" },
  };

  static LABEL_DISPLAY = {
    pesticide_package: "Package",
    cibrc_label:       "Label",
    toxicity_triangle: "Toxicity △",
    cibrc_reg_stamp:   "CIB&RC Reg.",
  };

  /**
   * Render YOLO bounding boxes from a /api/yolo/detect response.
   * All coordinates are re-projected from the model's original image space
   * to the currently displayed canvas size, so alignment is always exact.
   *
   * @param {object} result - Response from /api/yolo/detect
   * @param {object} opts   - { minConf: 0.0 }
   */
  render(result, opts = {}) {
    const minConf = opts.minConf ?? 0.0;
    this.detections = (result.detections || []).filter(d => d.confidence >= minConf);
    this._syncCanvasSize();
    this._draw();
  }

  /**
   * Clear all bounding boxes.
   */
  clear() {
    this.detections = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Sync canvas pixel dimensions to match the displayed image size.
   * This is called before every draw to handle window resizes.
   */
  _syncCanvasSize() {
    if (!this.img || !this.canvas) return;
    const rect = this.img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width  = rect.width;
      this.canvas.height = rect.height;
      this.canvas.style.width  = rect.width + "px";
      this.canvas.style.height = rect.height + "px";
    }
  }

  _draw() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    if (!this.detections || this.detections.length === 0) return;

    for (const det of this.detections) {
      this._drawBox(det, cw, ch, ctx);
    }
  }

  /**
   * Draw a single detection bounding box with label badge.
   * Uses bbox_norm (cx,cy,w,h normalized) → scales to canvas.
   */
  _drawBox(det, cw, ch, ctx) {
    const colors = YoloBBoxRenderer.CLASS_COLORS[det.class_name] || {
      fill: "rgba(255,255,255,0.1)", stroke: "#ffffff", label: "#ffffff",
    };
    const displayName = YoloBBoxRenderer.LABEL_DISPLAY[det.class_name] || det.class_name;
    const confPct = Math.round(det.confidence * 100);

    // Convert normalized cx,cy,w,h → pixel x1,y1,w,h on canvas
    const [cx_n, cy_n, bw_n, bh_n] = det.bbox_norm;
    const x1 = (cx_n - bw_n / 2) * cw;
    const y1 = (cy_n - bh_n / 2) * ch;
    const bw = bw_n * cw;
    const bh = bh_n * ch;

    // ── Box fill ───────────────────────────────────────────────────────────
    ctx.fillStyle = colors.fill;
    ctx.fillRect(x1, y1, bw, bh);

    // ── Box stroke ─────────────────────────────────────────────────────────
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.strokeRect(x1, y1, bw, bh);

    // ── Corner brackets (instrument reticle style) ─────────────────────────
    const brLen = Math.min(bw, bh) * 0.18;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = colors.stroke;

    const corners = [
      [x1, y1, 1, 1], [x1 + bw, y1, -1, 1],
      [x1, y1 + bh, 1, -1], [x1 + bw, y1 + bh, -1, -1],
    ];
    for (const [ox, oy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(ox + dx * brLen, oy);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox, oy + dy * brLen);
      ctx.stroke();
    }

    // ── Label badge ────────────────────────────────────────────────────────
    const label = `${displayName} ${confPct}%`;
    const fontSize = Math.max(11, Math.min(15, bw * 0.1));
    ctx.font = `bold ${fontSize}px "JetBrains Mono", "Courier New", monospace`;
    const textMetrics = ctx.measureText(label);
    const badgeW = textMetrics.width + 12;
    const badgeH = fontSize + 8;

    // Position badge — above box if space, below if at top edge
    const badgeY = y1 >= badgeH + 4 ? y1 - badgeH - 3 : y1 + bh + 3;
    const badgeX = Math.max(0, Math.min(x1, cw - badgeW));

    // Badge background
    ctx.fillStyle = colors.stroke;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();

    // Badge text
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, badgeX + 6, badgeY + badgeH / 2);
  }

  /**
   * Auto-redraw on container resize (e.g., window resize or layout shift).
   */
  _setupResizeObserver() {
    if (typeof ResizeObserver === "undefined" || !this.img) return;
    this._resizeObserver = new ResizeObserver(() => {
      if (this.detections.length > 0) {
        this._syncCanvasSize();
        this._draw();
      }
    });
    this._resizeObserver.observe(this.img);
  }

  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    this.clear();
  }
}

/**
 * Minimal rounded rect helper (canvas path).
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Call /api/yolo/detect and return results.
 * @param {string} imageDataUri
 * @param {object} opts - { conf, iou }
 */
export async function runYoloDetect(imageDataUri, opts = {}) {
  const response = await fetch("/api/yolo/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: imageDataUri,
      conf: opts.conf ?? 0.25,
      iou:  opts.iou  ?? 0.45,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Check YOLO server status from frontend.
 */
export async function checkYoloHealth() {
  try {
    const res = await fetch("/api/yolo/health");
    return res.json();
  } catch {
    return { yolo_available: false };
  }
}
