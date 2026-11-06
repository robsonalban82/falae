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

// Known natural English voices. Apple also ships novelty voices tagged en-US (Albert, Zarvox,
// Bahh…, with localized names), so on Apple only these are trusted.
const GOOD_VOICES = [
  /^Google US English/i,
  /^Microsoft (Aria|Jenny|Guy|Ava|Andrew|Emma|Brian).*Natural/i,
  /^(Samantha|Ava|Allison|Susan|Zoe|Nicky|Joelle|Noelle|Evan|Nathan|Tom|Alex|Aaron)\b/i,
  /^(Daniel|Kate|Serena|Oliver|Karen|Moira|Tessa)\b/i,
];
const APPLE_MARKERS = /^(Samantha|Daniel|Karen|Moira|Tessa|Alex|Fred|Albert|Zarvox)\b/i;

const goodRank = (v: VoiceLike) => GOOD_VOICES.findIndex((re) => re.test(v.name));
const nice = (v: VoiceLike) => /natural|enhanced|premium/i.test(v.name);

/**
 * Pure: best known-good voice (en-US first; natural/enhanced, then local unless `online` (network
 * voices like Google US English sound better than compact local ones), then list order). On
 * Apple, nothing else (undefined = browser default for `lang`). Elsewhere, falls back to
 * en-US local → en-US any → other en-* (local first).
 */
export function pickEnglishVoice<V extends VoiceLike>(
  voices: readonly V[],
  online = false,
): V | undefined {
  const isEn = (v: VoiceLike) => langOf(v) === 'en' || langOf(v).startsWith('en-');
  const isUs = (v: VoiceLike) => langOf(v) === 'en-us';
  const score = (v: V) =>
    (isUs(v) ? 0 : 1000) + (nice(v) ? 0 : 100) + (v.localService || online ? 0 : 10) + goodRank(v);
  const good = voices
    .filter((v) => isEn(v) && goodRank(v) >= 0)
    .sort((x, y) => score(x) - score(y));
  if (good[0]) return good[0];
  if (voices.some((v) => APPLE_MARKERS.test(v.name))) return undefined;
  const us = voices.filter(isUs);
  const en = voices.filter(isEn);
  return (
    us.find((v) => v.localService && nice(v)) ??
    us.find((v) => v.localService) ??
    us[0] ??
    en.find((v) => v.localService) ??
    en[0]
  );
}

// Chrome returns [] from getVoices() until `voiceschanged`: one listener keeps the pick fresh, and
// speak() re-picks too (online/offline changes). Before voices load it uses `lang` only.
let cachedVoice: SpeechSynthesisVoice | undefined;
let voicesListener: (() => void) | null = null;

function refreshVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) setNoVoice(false);
  cachedVoice = pickEnglishVoice(voices, navigator.onLine);
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
  setNoVoice(false);
}

/** Voice speak() would use now (undefined = `lang` only). */
export function currentVoice(): SpeechSynthesisVoice | undefined {
  ensureVoices();
  refreshVoice(); // cheap; also follows online/offline changes
  return cachedVoice;
}

// Set once speech never starts with no voices installed (e.g. some embedded browsers).
let noVoice = false;
const noVoiceListeners = new Set<() => void>();

export function hasNoVoice(): boolean {
  return noVoice;
}

export function subscribeNoVoice(listener: () => void): () => void {
  noVoiceListeners.add(listener);
  return () => noVoiceListeners.delete(listener);
}

function setNoVoice(value: boolean) {
  if (noVoice === value) return;
  noVoice = value;
  noVoiceListeners.forEach((l) => l());
}

/** How long speak() waits for `start` before deciding there is no voice. */
export const NO_VOICE_TIMEOUT_MS = 2500;
/** Chrome silently ignores speak() issued right after cancel(), so every start is deferred. */
export const SPEAK_DELAY_MS = 50;

// Chrome drops an utterance whose object is garbage-collected before `end`: keep a reference to
// the latest one (an older one is settled by the newer call and needs no event).
let activeUtterance: SpeechSynthesisUtterance | null = null;
// The current speak() call, started or not: superseding speak() or stopSpeaking() settles it
// right away, since some engines never fire `error` for an utterance dropped by cancel().
let cancelPending: (() => void) | null = null;

export function speak(text: string, options: { slow?: boolean } = {}): Promise<void> {
  if (!ttsSupported()) return Promise.reject(new Error('tts-unsupported'));
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    cancelPending?.();
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance = utterance;
    utterance.lang = 'en-US';
    utterance.rate = options.slow ? 0.6 : 1;
    const voice = currentVoice();
    if (voice) utterance.voice = voice;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      if (cancelPending === supersede) cancelPending = null;
      if (activeUtterance === utterance) activeUtterance = null;
      if (error) reject(error);
      else resolve();
    };
    utterance.onstart = () => {
      if (settled) return;
      clearTimeout(watchdog);
      setNoVoice(false);
      // Safety net: some engines never fire `end`; don't leave callers waiting forever.
      watchdog = setTimeout(() => finish(), 5000 + text.length * 200);
    };
    utterance.onend = () => finish();
    utterance.onerror = (e) =>
      finish(e.error === 'interrupted' || e.error === 'canceled' ? undefined : new Error(e.error));
    const startTimer = setTimeout(() => {
      // Chrome/Safari can leave the queue paused (e.g. after the tab was hidden).
      if (synth.paused) synth.resume();
      watchdog = setTimeout(() => {
        if (synth.getVoices().length > 0) return finish(); // voices exist: give up quietly
        synth.cancel();
        setNoVoice(true);
        finish(new Error('no-voice'));
      }, NO_VOICE_TIMEOUT_MS);
      synth.speak(utterance);
    }, SPEAK_DELAY_MS);
    const supersede = () => {
      clearTimeout(startTimer);
      finish();
    };
    cancelPending = supersede;
  });
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  cancelPending?.();
  window.speechSynthesis.cancel();
}

// Minimal typings: SpeechRecognition is still prefixed in some browsers.
type RecognitionAlternative = { transcript: string };
type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal?: boolean };
type RecognitionResultEvent = { results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart?: (() => void) | null;
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

export type Listening = {
  result: Promise<string[]>;
  /** Ends now with whatever was heard so far. */
  stop: () => void;
  abort: () => void;
};

/** Hard cap on one listening turn: iOS Safari may never fire `result` or `end`. */
export const LISTEN_MAX_MS = 10_000;
/** Silence after the last interim result that ends the turn (iOS rarely sends a final one). */
export const LISTEN_SILENCE_MS = 2_000;

/** Alternatives of a single result, or alternative 0 of each result joined. */
function transcriptsOf(results: ArrayLike<RecognitionResult>): string[] {
  if (results.length === 1) {
    const first = results[0];
    const out: string[] = [];
    if (first) for (let i = 0; i < first.length; i++) out.push(first[i]?.transcript ?? '');
    return out.map((x) => x.trim()).filter(Boolean);
  }
  const joined = Array.from(results, (r) => r[0]?.transcript ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return joined ? [joined] : [];
}

/**
 * Listens once in en-US and resolves with up to 5 alternative transcripts ([] = heard nothing).
 * Always settles: on a final result, on silence after interim results, on `end`, on `stop()`, or
 * after LISTEN_MAX_MS, so the screen never stays stuck on "listening".
 */
export function listen(options: { maxMs?: number; silenceMs?: number } = {}): Listening {
  const Ctor = recognitionCtor();
  if (!Ctor)
    return {
      result: Promise.reject(new Error('stt-unsupported')),
      stop: () => {},
      abort: () => {},
    };
  // iOS shares one audio session: speech output still playing blocks the microphone.
  stopSpeaking();
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.maxAlternatives = 5;
  rec.interimResults = true;
  rec.continuous = false;
  let latest: string[] = [];
  let settle: (error?: Error) => void = () => {};
  const result = new Promise<string[]>((resolve, reject) => {
    let settled = false;
    let silence: ReturnType<typeof setTimeout> | undefined;
    const maxMs = options.maxMs ?? LISTEN_MAX_MS;
    let cap = setTimeout(() => settle(), maxMs);
    settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(cap);
      clearTimeout(silence);
      rec.onresult = rec.onerror = rec.onend = null;
      rec.onaudiostart = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      if (error) reject(error);
      else resolve(latest);
    };
    rec.onresult = (e) => {
      const transcripts = transcriptsOf(e.results);
      if (transcripts.length > 0) latest = transcripts;
      const last = e.results[e.results.length - 1];
      if (last?.isFinal !== false) return settle();
      clearTimeout(silence);
      silence = setTimeout(() => settle(), options.silenceMs ?? LISTEN_SILENCE_MS);
    };
    rec.onerror = (e) => {
      // 'no-speech' / 'aborted' after something was heard: keep it.
      if (latest.length > 0 && (e.error === 'no-speech' || e.error === 'aborted')) settle();
      else settle(new Error(e.error)); // 'not-allowed', 'no-speech', 'aborted'…
    };
    rec.onend = () => settle();
    // The first time, iOS asks for the microphone first: count the cap from when audio starts.
    rec.onaudiostart = () => {
      clearTimeout(cap);
      cap = setTimeout(() => settle(), maxMs);
    };
  });
  try {
    rec.start();
  } catch (err) {
    settle(err instanceof Error ? err : new Error('start-failed'));
  }
  return {
    result,
    stop: () => settle(),
    abort: () => settle(new Error('aborted')),
  };
}
