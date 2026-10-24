/**
 * Camera Stream & Device Controller
 */
export class CameraController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.currentFacingMode = "environment";
    this.track = null;
    this.hasTorch = false;
    this.torchOn = false;
  }

  async start() {
    this.stop();

    const constraints = {
      video: {
        facingMode: { ideal: this.currentFacingMode },
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();

      this.track = this.stream.getVideoTracks()[0];
      const capabilities = this.track.getCapabilities ? this.track.getCapabilities() : {};
      this.hasTorch = Boolean(capabilities.torch);

      return {
        success: true,
        hasTorch: this.hasTorch,
        facingMode: this.currentFacingMode,
      };
    } catch (err) {
      console.error("Camera access failed:", err);
      return {
        success: false,
        error: err.name || "CameraAccessError",
        message: err.message,
      };
    }
  }

  async toggleTorch() {
    if (!this.track || !this.hasTorch) return false;
    try {
      this.torchOn = !this.torchOn;
      await this.track.applyConstraints({
        advanced: [{ torch: this.torchOn }],
      });
      return this.torchOn;
    } catch (err) {
      console.warn("Torch toggle error:", err);
      return false;
    }
  }

  async switchCamera() {
    this.currentFacingMode = this.currentFacingMode === "environment" ? "user" : "environment";
    return await this.start();
  }

  captureFrame(cropRect = null) {
    if (!this.video || !this.video.videoWidth) return null;

    const canvas = document.createElement("canvas");
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;

    if (cropRect) {
      // Crop within bounding box
      const sx = Math.max(0, Math.floor(cropRect.x * vw));
      const sy = Math.max(0, Math.floor(cropRect.y * vh));
      const sw = Math.min(vw - sx, Math.floor(cropRect.width * vw));
      const sh = Math.min(vh - sy, Math.floor(cropRect.height * vh));

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, sw, sh);
    } else {
      // Full frame
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this.video, 0, 0, vw, vh);
    }

    return canvas.toDataURL("image/jpeg", 0.92);
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.track = null;
      this.torchOn = false;
    }
  }
}
