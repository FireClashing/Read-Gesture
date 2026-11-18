

import type { SignaLanguage } from "./types";

export function speakText(
  text: string,
  language: SignaLanguage
) {
  if (typeof window === "undefined" || !text.trim()) return;

  if (!("speechSynthesis" in window)) {
    console.error("Speech synthesis is not supported.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();

  const matchingVoice = voices.find(
    (voice) => voice.lang.toLowerCase() === utterance.lang.toLowerCase()
  );

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
