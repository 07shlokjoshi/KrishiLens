import React, { useState } from "react";
import { Header } from "./components/Header.jsx";
import { ApertureDeck } from "./components/ApertureDeck.jsx";
import { CameraScanner } from "./components/CameraScanner.jsx";
import { PreviewScreen } from "./components/PreviewScreen.jsx";
import { ProcessingScreen } from "./components/ProcessingScreen.jsx";
import { ResultsScreen } from "./components/ResultsScreen.jsx";
import { ErrorScreen } from "./components/ErrorScreen.jsx";
import { scanPesticideLabel } from "./services/apiClient.js";

export function App() {
  const [screen, setScreen] = useState("deck"); // "deck" | "camera" | "preview" | "processing" | "results" | "error"
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const handleSelectImage = (imageDataUrl, imageName) => {
    setSelectedImage(imageDataUrl);
    setSelectedImageName(imageName || "Specimen Image");
    setScreen("preview");
  };

  const handleStartCamera = () => {
    setScreen("camera");
  };

  const handleCameraCapture = (frameDataUrl, frameName) => {
    setSelectedImage(frameDataUrl);
    setSelectedImageName(frameName);
    setScreen("preview");
  };

  const handleRunInference = async (mode = "full") => {
    if (!selectedImage) return;

    setScreen("processing");
    setErrorMessage("");

    try {
      const response = await scanPesticideLabel(selectedImage, mode);

      if (!response || response.status === "API_FAILURE" || response.status === "SERVER_ERROR") {
        setErrorMessage(response?.error_message || response?.error || "Inference pipeline failed.");
        setScreen("error");
        return;
      }

      setScanResult(response);
      setScreen("results");
    } catch (err) {
      console.error("Scan error:", err);
      setErrorMessage(err.message || "Failed to communicate with KrishiLens neural backend.");
      setScreen("error");
    }
  };

  const handleCopyText = (text, label) => {
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text);
      showToast(`Copied ${label} to clipboard!`);
    }
  };

  const handleResetToDeck = () => {
    setScreen("deck");
    setSelectedImage(null);
    setSelectedImageName("");
    setScanResult(null);
    setErrorMessage("");
  };

  return (
    <div className="krishilens-chassis-shell">
      {/* Background Agricultural Ambient Grain */}
      <div className="ambient-grain" aria-hidden="true"></div>

      {/* Persistent Tactile Header */}
      <Header onHomeClick={handleResetToDeck} currentScreen={screen} />

      {/* Screen Router */}
      <main className="main-viewport-content">
        {screen === "deck" && (
          <ApertureDeck
            onStartCamera={handleStartCamera}
            onSelectImage={handleSelectImage}
          />
        )}

        {screen === "camera" && (
          <CameraScanner
            onCapture={handleCameraCapture}
            onClose={() => setScreen("deck")}
          />
        )}

        {screen === "preview" && (
          <PreviewScreen
            imageSrc={selectedImage}
            imageName={selectedImageName}
            onConfirm={handleRunInference}
            onRetake={() => setScreen("deck")}
          />
        )}

        {screen === "processing" && <ProcessingScreen />}

        {screen === "results" && scanResult && (
          <ResultsScreen
            result={scanResult}
            imageSrc={selectedImage}
            onNewScan={handleResetToDeck}
            onCopyText={handleCopyText}
          />
        )}

        {screen === "error" && (
          <ErrorScreen
            error={errorMessage}
            onRetry={() => {
              if (selectedImage) {
                setScreen("preview");
              } else {
                setScreen("deck");
              }
            }}
            onHome={handleResetToDeck}
          />
        )}
      </main>

      {/* Toast Notification Container */}
      {toast && (
        <div className="tactile-toast-popup" role="status">
          <span className="toast-icon">✓</span>
          <span className="toast-message">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default App;
