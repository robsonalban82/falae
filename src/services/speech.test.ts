import {
  LISTEN_MAX_MS,
  LISTEN_SILENCE_MS,
  listen,
  NO_VOICE_TIMEOUT_MS,
  SPEAK_DELAY_MS,
  stopSpeaking,
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

  it('Apple: skips novelty voices and picks Samantha', () => {
    const mac = ['Albert', 'Bahh', 'Zarvox', 'Eddy (English (US))', 'Samantha'].map((n) =>
      v('en-US', true, n),
    );
    expect(pickEnglishVoice([v('en-GB', true, 'Daniel'), ...mac])?.name).toBe('Samantha');
  });

  it('Apple: enhanced voice beats compact, en-US beats en-GB', () => {
    const voices = [
      v('en-GB', true, 'Daniel'),
      v('en-US', true, 'Samantha'),
      v('en-US', true, 'Ava (Enhanced)'),
    ];
    expect(pickEnglishVoice(voices)?.name).toBe('Ava (Enhanced)');
  });

  it('Apple with only novelty voices → undefined (browser default)', () => {
    expect(
      pickEnglishVoice([v('en-US', true, 'Albert'), v('en-US', true, 'Zarvox')]),
    ).toBeUndefined();
  });

  it('Chrome: local Samantha beats network Google US English', () => {
    const voices = [v('en-US', false, 'Google US English'), v('en-US', true, 'Samantha')];
    expect(pickEnglishVoice(voices)?.name).toBe('Samantha');
  });

  it('Chrome online: Google US English beats compact Samantha, but not an enhanced voice', () => {
    const voices = [v('en-US', true, 'Samantha'), v('en-US', false, 'Google US English')];
    expect(pickEnglishVoice(voices, true)?.name).toBe('Google US English');
    expect(pickEnglishVoice([...voices, v('en-US', true, 'Ava (Premium)')], true)?.name).toBe(
      'Ava (Premium)',
    );
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
    vi.advanceTimersByTime(SPEAK_DELAY_MS + NO_VOICE_TIMEOUT_MS);
    await assertion;
    expect(hasNoVoice()).toBe(true);
    vi.useRealTimers();
  });

  it('resolves quietly (no flag) when voices exist but speech never starts', async () => {
    vi.useFakeTimers();
    silent = true;
    voices = [v('en-US')];
    const result = speak('hello');
    vi.advanceTimersByTime(SPEAK_DELAY_MS + NO_VOICE_TIMEOUT_MS);
    await expect(result).resolves.toBeUndefined();
    expect(hasNoVoice()).toBe(false);
    vi.useRealTimers();
  });

  it('only the latest of rapid calls plays; earlier ones resolve without speaking', async () => {
    vi.useFakeTimers();
    const all = [speak('a'), speak('b'), speak('c')];
    vi.advanceTimersByTime(SPEAK_DELAY_MS);
    await Promise.all(all);
    expect(spoken.map((u) => (u as unknown as { text: string }).text)).toEqual(['c']); // fake keeps text
    vi.useRealTimers();
  });

  it('a started utterance settles when superseded, even if the engine never reports it', async () => {
    vi.useFakeTimers();
    silent = true; // started but no end/error ever fires
    voices = [v('en-US')];
    let firstDone = false;
    void speak('a').then(() => (firstDone = true));
    vi.advanceTimersByTime(SPEAK_DELAY_MS);
    expect(spoken).toHaveLength(1);
    void speak('b');
    await vi.advanceTimersByTimeAsync(0);
    expect(firstDone).toBe(true);
    stopSpeaking();
    vi.useRealTimers();
  });

  it('stopSpeaking() during the delay prevents the pending speech', async () => {
    vi.useFakeTimers();
    const result = speak('a');
    stopSpeaking();
    vi.advanceTimersByTime(SPEAK_DELAY_MS);
    await result;
    expect(spoken).toHaveLength(0);
    vi.useRealTimers();
  });

  it('clears the no-voice flag once voices arrive', async () => {
    vi.useFakeTimers();
    silent = true;
    const result = speak('hello').catch(() => {});
    vi.advanceTimersByTime(SPEAK_DELAY_MS + NO_VOICE_TIMEOUT_MS);
    await result;
    expect(hasNoVoice()).toBe(true);
    voices = [v('en-US', true, 'Samantha')];
    listeners.forEach((l) => l());
    expect(hasNoVoice()).toBe(false);
    vi.useRealTimers();
  });

  it('does not flag no-voice when speech ends normally', async () => {
    await speak('hello');
    expect(hasNoVoice()).toBe(false);
  });
});

describe('listen()', () => {
  type Alt = { transcript: string };
  type Result = Alt[] & { isFinal?: boolean };
  class FakeRecognition {
    static last: FakeRecognition | null = null;
    static throwOnStart = false;
    interimResults = false;
    onresult: ((e: { results: Result[] }) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    onaudiostart: (() => void) | null = null;
    aborted = false;
    constructor() {
      FakeRecognition.last = this;
    }
    start() {
      if (FakeRecognition.throwOnStart) throw new Error('InvalidStateError');
    }
    abort() {
      this.aborted = true;
    }
  }
  const rec = () => FakeRecognition.last!; // set by the constructor inside listen()
  const result = (texts: string[], isFinal?: boolean): Result =>
    Object.assign(
      texts.map((transcript) => ({ transcript })),
      isFinal === undefined ? {} : { isFinal },
    );

  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.throwOnStart = false;
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('asks for interim results and resolves on a final result', async () => {
    const l = listen();
    expect(rec().interimResults).toBe(true);
    rec().onresult!({ results: [result(['hello Ana', 'hello Anna'], true)] });
    await expect(l.result).resolves.toEqual(['hello Ana', 'hello Anna']);
    expect(rec().aborted).toBe(true);
  });

  it('iOS: interim results only, then silence → resolves with the latest', async () => {
    const l = listen();
    rec().onresult!({ results: [result(['good'], false)] });
    vi.advanceTimersByTime(LISTEN_SILENCE_MS - 1);
    rec().onresult!({ results: [result(['good morning Ana'], false)] });
    vi.advanceTimersByTime(LISTEN_SILENCE_MS);
    await expect(l.result).resolves.toEqual(['good morning Ana']);
  });

  it('never hangs: no event at all → resolves [] after the cap', async () => {
    const l = listen();
    vi.advanceTimersByTime(LISTEN_MAX_MS);
    await expect(l.result).resolves.toEqual([]);
    expect(rec().aborted).toBe(true);
  });

  it('the cap restarts when audio starts (after the iOS permission prompt)', async () => {
    const l = listen();
    vi.advanceTimersByTime(LISTEN_MAX_MS - 1);
    rec().onaudiostart!();
    vi.advanceTimersByTime(LISTEN_MAX_MS - 1);
    rec().onresult!({ results: [result(['hello'], true)] });
    await expect(l.result).resolves.toEqual(['hello']);
  });

  it('stop() resolves right away with what was heard', async () => {
    const l = listen();
    rec().onresult!({ results: [result(['good morning'], false)] });
    l.stop();
    await expect(l.result).resolves.toEqual(['good morning']);
  });

  it('start() throwing rejects instead of hanging', async () => {
    FakeRecognition.throwOnStart = true;
    await expect(listen().result).rejects.toThrow('InvalidStateError');
  });

  it('no-speech after an interim result keeps it; without one it rejects', async () => {
    const a = listen();
    rec().onresult!({ results: [result(['hi'], false)] });
    rec().onerror!({ error: 'no-speech' });
    await expect(a.result).resolves.toEqual(['hi']);
    const b = listen();
    rec().onerror!({ error: 'not-allowed' });
    await expect(b.result).rejects.toThrow('not-allowed');
  });

  it('joins several results into one transcript', async () => {
    const l = listen();
    rec().onresult!({ results: [result(['good morning']), result([' Ana'], true)] });
    await expect(l.result).resolves.toEqual(['good morning Ana']);
  });
});
