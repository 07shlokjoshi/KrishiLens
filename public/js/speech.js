/**
 * Web Speech API Voice Reader for Indian Farmers
 * Reads pesticide safety instructions aloud in Hindi, English, or Marathi
 */
export class SpeechReader {
  constructor() {
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.isSpeaking = false;
    this.voices = [];
    this.onStateChange = null;

    if (this.synth) {
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  speak(text, lang = "hi", stateCallback = null) {
    if (!this.synth) return;

    if (this.isSpeaking) {
      this.stop();
      return;
    }

    if (!text || text.trim().length === 0) return;

    this.onStateChange = stateCallback;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for crisp clarity
    utterance.pitch = 1.0;

    let langCode = "en-IN";
    if (lang === "hi") langCode = "hi-IN";
    if (lang === "mr") langCode = "mr-IN";
    utterance.lang = langCode;

    // Pick best matching voice
    const matchedVoice = this.voices.find(v => v.lang.startsWith(langCode) || v.lang.startsWith(lang));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onStateChange) this.onStateChange(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onStateChange) this.onStateChange(false);
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.onStateChange) this.onStateChange(false);
    };

    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth && (this.synth.speaking || this.isSpeaking)) {
      this.synth.cancel();
      this.isSpeaking = false;
      if (this.onStateChange) this.onStateChange(false);
    }
  }
}
