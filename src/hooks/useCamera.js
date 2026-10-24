import { useState, useRef, useCallback, useEffect } from "react";

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [error, setError] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setHasTorch(false);
    setIsTorchOn(false);
  }, []);

  const startCamera = useCallback(
    async (mode = facingMode) => {
      stopCamera();
      setError(null);

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsStreaming(true);
        setFacingMode(mode);

        // Check torch capability
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
          if (capabilities.torch) {
            setHasTorch(true);
          }
        }
      } catch (err) {
        console.warn("Camera start error:", err);
        setError(err.name === "NotAllowedError"
          ? "Camera permission denied. Please enable camera access."
          : `Camera error: ${err.message}`
        );
        setIsStreaming(false);
      }
    },
    [facingMode, stopCamera]
  );

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextTorch = !isTorchOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setIsTorchOn(nextTorch);
      } catch (err) {
        console.warn("Torch toggle failed:", err);
      }
    }
  }, [hasTorch, isTorchOn]);

  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    await startCamera(nextMode);
  }, [facingMode, startCamera]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isStreaming,
    facingMode,
    hasTorch,
    isTorchOn,
    error,
    startCamera,
    stopCamera,
    toggleTorch,
    switchCamera,
    captureFrame
  };
}
