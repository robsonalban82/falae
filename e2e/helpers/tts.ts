import type { Page } from '@playwright/test';

/** Fake speechSynthesis: speak() fires start, then end after `ms` (records text in window.__spoken). */
export async function fakeTts(page: Page, ms = 300) {
  await page.addInitScript((delay) => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [] as string[];
    class Utt {
      text: string;
      lang = '';
      rate = 1;
      voice = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const voice = { lang: 'en-US', name: 'Fake', localService: true, default: true, voiceURI: 'f' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const synth = {
      paused: false,
      speaking: false,
      pending: false,
      getVoices: () => [voice],
      addEventListener() {},
      removeEventListener() {},
      resume() {},
      cancel() {
        clearTimeout(timer);
      },
      speak(u: Utt) {
        (w.__spoken as string[]).push(u.text);
        u.onstart?.();
        timer = setTimeout(() => u.onend?.(), delay);
      },
    };
    w.SpeechSynthesisUtterance = Utt;
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  }, ms);
}

/** Browser without Web Speech: removes speechSynthesis and SpeechSynthesisUtterance. */
export async function noTts(page: Page) {
  await page.addInitScript(() => {
    for (const name of ['speechSynthesis', 'SpeechSynthesisUtterance']) {
      let o: object | null = window;
      while (o) {
        try {
          Reflect.deleteProperty(o, name);
        } catch {
          /* ignore */
        }
        o = Object.getPrototypeOf(o) as object | null;
      }
    }
  });
}
