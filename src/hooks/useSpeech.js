import { useState, useEffect, useCallback, useRef } from "react";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const synthRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        const available = synthRef.current.getVoices();
        setVoices(available);
      };

      updateVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text, lang = "en") => {
      if (!synthRef.current || !text) return;

      stop();

      const utterance = new SpeechSynthesisUtterance(text);

      let targetLang = "en-IN";
      if (lang === "hi") targetLang = "hi-IN";
      if (lang === "mr") targetLang = "mr-IN";

      utterance.lang = targetLang;
      utterance.rate = 0.95; // Slightly measured pace for statutory safety announcements
      utterance.pitch = 1.0;

      // Find matching voice if available
      const voice = voices.find(
        (v) => v.lang === targetLang || v.lang.startsWith(targetLang.substring(0, 2))
      );
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    },
    [voices, stop]
  );

  return {
    speak,
    stop,
    isSpeaking,
    hasSpeechSupport: typeof window !== "undefined" && "speechSynthesis" in window
  };
}
