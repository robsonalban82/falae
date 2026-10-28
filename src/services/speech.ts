/**
 * Web Speech API wrappers (docs/ARQUITETURA.md §9). Every function degrades gracefully:
 * callers check `ttsSupported()` / `sttSupported()` first and get rejections, not crashes.
 */

export function ttsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'));
  const us = voices.filter((v) => v.lang.toLowerCase() === 'en-us');
  const pool = us.length ? us : voices;
  return (
    pool.find((v) => v.localService && /natural|enhanced|premium/i.test(v.name)) ??
    pool.find((v) => v.localService) ??
    pool[0]
  );
}

export function speak(text: string, options: { slow?: boolean } = {}): Promise<void> {
  if (!ttsSupported()) return Promise.reject(new Error('tts-unsupported'));
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = options.slow ? 0.6 : 1;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = (e) =>
      e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error(e.error));
    synth.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// Minimal typings: SpeechRecognition is still prefixed in some browsers.
type RecognitionAlternative = { transcript: string };
type RecognitionResultEvent = { results: ArrayLike<ArrayLike<RecognitionAlternative>> };
type Recognition = {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported(): boolean {
  return recognitionCtor() !== null;
}

export type Listening = { result: Promise<string[]>; abort: () => void };

/** Listens once in en-US and resolves with up to 5 alternative transcripts. */
export function listen(): Listening {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.reject(new Error('stt-unsupported')), abort: () => {} };
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.maxAlternatives = 5;
  rec.interimResults = false;
  rec.continuous = false;
  const result = new Promise<string[]>((resolve, reject) => {
    let settled = false;
    rec.onresult = (e) => {
      settled = true;
      const first = e.results[0];
      const transcripts: string[] = [];
      if (first)
        for (let i = 0; i < first.length; i++) transcripts.push(first[i]?.transcript ?? '');
      resolve(transcripts.filter(Boolean));
    };
    rec.onerror = (e) => {
      settled = true;
      reject(new Error(e.error)); // 'not-allowed', 'no-speech', 'aborted'…
    };
    rec.onend = () => {
      if (!settled) resolve([]);
    };
  });
  rec.start();
  return { result, abort: () => rec.abort() };
}
