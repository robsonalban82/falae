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

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'name'>;

const langOf = (v: VoiceLike) => v.lang.toLowerCase().replace('_', '-');

/**
 * Pure: en-US local (natural/enhanced first) → en-US any → other en-* (local first) → undefined
 * (then the utterance relies on `lang = 'en-US'` alone).
 */
export function pickEnglishVoice<V extends VoiceLike>(voices: readonly V[]): V | undefined {
  const us = voices.filter((v) => langOf(v) === 'en-us');
  const en = voices.filter((v) => langOf(v) === 'en' || langOf(v).startsWith('en-'));
  const nice = (v: VoiceLike) => /natural|enhanced|premium/i.test(v.name);
  return (
    us.find((v) => v.localService && nice(v)) ??
    us.find((v) => v.localService) ??
    us[0] ??
    en.find((v) => v.localService) ??
    en[0]
  );
}

// Chrome returns [] from getVoices() until `voiceschanged`: keep one cached pick, refreshed by a
// single listener. speak() never waits for voices; before they load it uses `lang` only.
let cachedVoice: SpeechSynthesisVoice | undefined;
let voicesListener: (() => void) | null = null;

function refreshVoice() {
  cachedVoice = pickEnglishVoice(window.speechSynthesis.getVoices());
}

function ensureVoices() {
  if (voicesListener || !ttsSupported()) return;
  voicesListener = refreshVoice;
  window.speechSynthesis.addEventListener?.('voiceschanged', voicesListener);
  refreshVoice();
}

/** Removes the voices listener (tests, teardown). */
export function disposeSpeech(): void {
  if (voicesListener && ttsSupported())
    window.speechSynthesis.removeEventListener?.('voiceschanged', voicesListener);
  voicesListener = null;
  cachedVoice = undefined;
}

/** Voice speak() would use now (undefined = `lang` only). */
export function currentVoice(): SpeechSynthesisVoice | undefined {
  ensureVoices();
  if (!cachedVoice) refreshVoice();
  return cachedVoice;
}

export function speak(text: string, options: { slow?: boolean } = {}): Promise<void> {
  if (!ttsSupported()) return Promise.reject(new Error('tts-unsupported'));
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = options.slow ? 0.6 : 1;
    const voice = currentVoice();
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
