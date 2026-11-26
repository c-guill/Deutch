let cachedGermanVoice: SpeechSynthesisVoice | null = null;

function pickGermanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedGermanVoice;

  const exactDe =
    voices.find((v) => v.lang.toLowerCase() === 'de-de' && v.localService) ||
    voices.find((v) => v.lang.toLowerCase() === 'de-de') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('de'));

  cachedGermanVoice = exactDe || null;
  return cachedGermanVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    pickGermanVoice();
  };
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakGerman(text: string, rate = 0.92): void {
  if (!isSpeechSupported() || !text.trim()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = 'de-DE';
  utterance.rate = rate;
  utterance.pitch = 1;

  const voice = pickGermanVoice();
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}
