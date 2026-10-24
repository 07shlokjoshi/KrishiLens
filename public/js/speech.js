/**
 * Web Speech API Voice Reader for Indian Farmers
 * Reads pesticide safety instructions aloud in Hindi, English, or Marathi
 */
export class SpeechReader {
  constructor() {
    this.synth = window.speechSynthesis;
    this.isSpeaking = false;
    this.voices = [];

    if (this.synth) {
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    this.voices = this.synth.getVoices();
  }

  speak(text, lang = "hi") {
    if (!this.synth) return;
    this.stop();

    if (!text || text.trim().length === 0) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
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

    utterance.onstart = () => { this.isSpeaking = true; };
    utterance.onend = () => { this.isSpeaking = false; };
    utterance.onerror = () => { this.isSpeaking = false; };

    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }
}
