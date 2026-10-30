import {
  NO_VOICE_TIMEOUT_MS,
  currentVoice,
  disposeSpeech,
  hasNoVoice,
  pickEnglishVoice,
  speak,
} from './speech';

const v = (lang: string, localService = true, name = lang) =>
  ({ lang, localService, name }) as SpeechSynthesisVoice; // test double: only these fields are read

describe('pickEnglishVoice', () => {
  it.each([
    ['en-US local', [v('pt-BR'), v('en-US', false, 'remote'), v('en-US', true, 'local')], 'local'],
    [
      'natural en-US local first',
      [v('en-US', true, 'a'), v('en-US', true, 'Ava (Enhanced)')],
      'Ava (Enhanced)',
    ],
    ['en-US remote over en-GB', [v('en-GB'), v('en-US', false, 'us-remote')], 'us-remote'],
    ['underscore form', [v('pt-BR'), v('en_US', true, 'android')], 'android'],
    ['other en-* (local first)', [v('en-GB', false, 'gb-r'), v('en-AU', true, 'au')], 'au'],
  ])('%s', (_label, voices, expected) => {
    expect(pickEnglishVoice(voices)?.name).toBe(expected);
  });

  it('no English voice → undefined', () => {
    expect(pickEnglishVoice([v('pt-BR'), v('es-ES')])).toBeUndefined();
    expect(pickEnglishVoice([])).toBeUndefined();
  });
});

describe('speak() and voiceschanged', () => {
  let voices: SpeechSynthesisVoice[];
  let listeners: (() => void)[];
  let spoken: SpeechSynthesisUtterance[];
  let silent: boolean;

  beforeEach(() => {
    voices = [];
    listeners = [];
    spoken = [];
    silent = false;
    class FakeUtterance {
      lang = '';
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => voices,
      cancel: () => {},
      speak: (u: SpeechSynthesisUtterance) => {
        spoken.push(u);
        if (!silent) u.onend?.(new Event('end') as SpeechSynthesisEvent); // test double event
      },
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: (_: string, fn: () => void) => {
        listeners = listeners.filter((l) => l !== fn);
      },
    });
  });
  afterEach(() => {
    disposeSpeech();
    vi.unstubAllGlobals();
  });

  it('speaks right away with lang only, then uses the English voice after voiceschanged', async () => {
    await speak('hello');
    expect(spoken[0]?.lang).toBe('en-US');
    expect(spoken[0]?.voice).toBeNull();

    voices = [v('pt-BR'), v('en-US', true, 'us')];
    listeners.forEach((l) => l());
    await speak('hi');
    expect(spoken[1]?.voice?.name).toBe('us');
    expect(currentVoice()?.name).toBe('us');
  });

  it('registers a single listener and removes it on dispose', async () => {
    await speak('a');
    await speak('b');
    expect(listeners).toHaveLength(1);
    disposeSpeech();
    expect(listeners).toHaveLength(0);
  });

  it('rejects with no-voice and flags it when speech never starts without voices', async () => {
    vi.useFakeTimers();
    silent = true;
    const result = speak('hello');
    const assertion = expect(result).rejects.toThrow('no-voice');
    vi.advanceTimersByTime(NO_VOICE_TIMEOUT_MS);
    await assertion;
    expect(hasNoVoice()).toBe(true);
    vi.useRealTimers();
  });

  it('keeps waiting when voices exist but start is slow', async () => {
    vi.useFakeTimers();
    silent = true;
    voices = [v('en-US')];
    void speak('hello');
    vi.advanceTimersByTime(NO_VOICE_TIMEOUT_MS);
    expect(hasNoVoice()).toBe(false);
    vi.useRealTimers();
  });

  it('does not flag no-voice when speech ends normally', async () => {
    await speak('hello');
    expect(hasNoVoice()).toBe(false);
  });
});
