import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Exercise } from '../../../content/schema';
import { resetRecorderPolicy } from '../../../services/recorder';
import { LISTEN_MAX_MS } from '../../../services/speech';
import { ExerciseView } from './exerciseRegistry';

/** QA: "Ouvir minha voz" playback of the learner's own recording. */

const sp: Exercise = {
  id: 'q-sv',
  type: 'speak',
  itemIds: ['x'],
  textEn: 'Hello, my name is Ana.',
};

type Result = { transcript: string }[] & { isFinal?: boolean };
const res = (text: string): Result => Object.assign([{ transcript: text }], { isFinal: true });

class FakeSR {
  static all: FakeSR[] = [];
  onresult: ((e: { results: Result[] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeSR.all.push(this);
  }
  start() {}
  abort() {}
  stop() {}
}

class FakeMR {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['v']) });
    this.onstop?.();
  }
}

class FakeAudio {
  static all: FakeAudio[] = [];
  paused = 0;
  played = 0;
  onended: (() => void) | null = null;
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  play() {
    this.played++;
    return Promise.resolve();
  }
  pause() {
    this.paused++;
  }
}

let trackStops: number;
let streams: number;
let gum: ReturnType<typeof vi.fn>;
let urlSeq: number;
let revoked: string[];
let created: string[];

const mic = (name: string) => screen.getByRole('button', { name });
const playBtn = () => screen.queryByRole('button', { name: 'Ouvir minha voz' });
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));
const click = (el: HTMLElement) => act(async () => void fireEvent.click(el));

function setup(disabled = false) {
  const onChange = vi.fn();
  const onSkip = vi.fn();
  const ui = (d: boolean) => (
    <ExerciseView
      exercise={sp}
      disabled={d}
      onChange={onChange}
      onSubmit={vi.fn()}
      onSkip={onSkip}
      sound={false}
    />
  );
  const utils = render(ui(disabled));
  return { ...utils, onChange, onSkip, setDisabled: (d: boolean) => utils.rerender(ui(d)) };
}

async function speakOnce(text = 'hello') {
  await click(mic('Toque para falar'));
  await flush();
  await act(async () => FakeSR.all.at(-1)!.onresult!({ results: [res(text)] }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetRecorderPolicy();
  Object.defineProperty(navigator, 'permissions', {
    value: { query: () => Promise.resolve({ state: 'granted' }) },
    configurable: true,
  });
  FakeSR.all = [];
  FakeAudio.all = [];
  trackStops = 0;
  streams = 0;
  urlSeq = 0;
  revoked = [];
  created = [];
  gum = vi.fn(() => {
    streams++;
    return Promise.resolve({ getTracks: () => [{ stop: () => trackStops++ }] });
  });
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
  vi.stubGlobal('MediaRecorder', FakeMR);
  vi.stubGlobal('Audio', FakeAudio);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: gum },
    configurable: true,
  });
  URL.createObjectURL = vi.fn(() => {
    const u = `blob:fake/${++urlSeq}`;
    created.push(u);
    return u;
  });
  URL.revokeObjectURL = vi.fn((u: string) => void revoked.push(u));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(navigator, 'permissions');
});

describe('"Ouvir minha voz"', () => {
  it('appears after a result, plays the blob URL, and stays after disabled', async () => {
    const { setDisabled } = setup();
    expect(playBtn()).toBeNull();
    await speakOnce();
    expect(playBtn()).toBeInTheDocument();
    setDisabled(true);
    expect(playBtn()).toBeEnabled();
    await click(playBtn()!);
    expect(FakeAudio.all[0]!.src).toBe(created[0]);
    expect(FakeAudio.all[0]!.played).toBe(1);
    // while playing the same button stops it
    await click(screen.getByRole('button', { name: 'Parar minha voz' }));
    expect(FakeAudio.all[0]!.paused).toBeGreaterThan(0);
    expect(playBtn()).toBeInTheDocument();
    await click(playBtn()!);
    expect(FakeAudio.all).toHaveLength(2);
  });

  it('appears after "nothing heard" (timeout) and hides while listening', async () => {
    setup();
    await click(mic('Toque para falar'));
    await flush();
    expect(playBtn()).toBeNull();
    await act(async () => void (await vi.advanceTimersByTimeAsync(LISTEN_MAX_MS + 1)));
    await flush();
    expect(screen.getByText(/Não ouvi nada/)).toBeInTheDocument();
    expect(playBtn()).toBeInTheDocument();
  });

  it('new turn: button disappears, old URL revoked, old recording not shown', async () => {
    setup();
    await speakOnce();
    expect(playBtn()).toBeInTheDocument();
    await click(mic('Toque para falar'));
    expect(playBtn()).toBeNull();
    expect(revoked).toContain(created[0]);
    await flush();
    expect(playBtn()).toBeNull();
    await act(async () => FakeSR.all.at(-1)!.onresult!({ results: [res('again')] }));
    await flush();
    expect(playBtn()).toBeInTheDocument();
    await click(playBtn()!);
    expect(FakeAudio.all.at(-1)!.src).toBe(created[1]);
    expect(trackStops).toBe(streams); // every stream released
  });

  it('stale turn: late recording of an aborted turn does not leak into the new one', async () => {
    let release!: () => void;
    gum.mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = () => {
            streams++;
            r({ getTracks: () => [{ stop: () => trackStops++ }] });
          };
        }),
    );
    setup();
    await click(mic('Toque para falar')); // turn 1, getUserMedia pending
    await act(async () => FakeSR.all[0]!.onresult!({ results: [res('one')] }));
    await click(mic('Toque para falar')); // turn 2 starts before turn 1 mic resolves
    await flush();
    release();
    await flush();
    expect(trackStops).toBe(1); // stale stream released
    expect(created).toHaveLength(0); // no URL from the stale turn
    expect(playBtn()).toBeNull();
  });

  it('unmount before getUserMedia resolves still releases the microphone', async () => {
    let release!: () => void;
    gum.mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = () => {
            streams++;
            r({ getTracks: () => [{ stop: () => trackStops++ }] });
          };
        }),
    );
    const { unmount } = setup();
    await click(mic('Toque para falar'));
    unmount();
    release();
    await flush();
    expect(streams).toBe(1);
    expect(trackStops).toBe(1);
  });

  it('unmount revokes the URL and pauses playback', async () => {
    const { unmount } = setup();
    await speakOnce();
    await click(playBtn()!);
    unmount();
    expect(revoked).toContain(created[0]);
    expect(FakeAudio.all[0]!.paused).toBeGreaterThan(0);
    expect(trackStops).toBe(streams);
  });

  it('"Não posso falar agora" while recording releases the microphone', async () => {
    const { onSkip, unmount } = setup();
    await click(mic('Toque para falar'));
    await flush();
    await click(screen.getByRole('button', { name: 'Não posso falar agora' }));
    expect(onSkip).toHaveBeenCalled();
    unmount();
    await flush();
    expect(trackStops).toBe(streams);
  });

  it('recording that ends while the turn is still listening: mic released after unmount', async () => {
    const { unmount } = setup();
    await click(mic('Toque para falar'));
    await flush();
    expect(trackStops).toBe(0);
    unmount();
    await flush();
    expect(trackStops).toBe(1);
    expect(created).toHaveLength(0);
  });

  it('getUserMedia denied: exercise works the same, no button', async () => {
    gum.mockRejectedValue(new Error('NotAllowedError'));
    const { onChange } = setup();
    await speakOnce('hi');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'speech', transcripts: ['hi'] });
    expect(screen.getByText(/Entendi:/)).toBeInTheDocument();
    expect(playBtn()).toBeNull();
  });

  it('MediaRecorder missing: no getUserMedia call, no button, exercise works', async () => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'MediaRecorder');
    const { onChange } = setup();
    await speakOnce('hi');
    expect(gum).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'speech', transcripts: ['hi'] });
    expect(playBtn()).toBeNull();
  });

  it('audio.play() rejecting does not crash', async () => {
    vi.spyOn(FakeAudio.prototype, 'play').mockRejectedValue(new Error('NotAllowed'));
    setup();
    await speakOnce();
    await click(playBtn()!);
    expect(playBtn()).toBeInTheDocument();
  });
});

describe('recording policy', () => {
  it('first turn without mic permission: no getUserMedia, no button, speech works', async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: { query: () => Promise.resolve({ state: 'prompt' }) },
      configurable: true,
    });
    const { onChange } = setup();
    await speakOnce('hi');
    expect(gum).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'speech', transcripts: ['hi'] });
    expect(playBtn()).toBeNull();
    // speech worked once, so the next turn records (even without a granted query)
    await speakOnce('again');
    expect(gum).toHaveBeenCalledTimes(1);
    expect(playBtn()).toBeInTheDocument();
  });

  it('navigator.permissions missing or throwing: no crash, exercise works', async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: { query: () => Promise.reject(new TypeError('bad name')) },
      configurable: true,
    });
    const { onChange } = setup();
    await speakOnce('hi');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'speech', transcripts: ['hi'] });
    expect(playBtn()).toBeNull();
  });

  it('a recorded turn with nothing heard stops recording for the rest of the session', async () => {
    setup();
    await click(mic('Toque para falar'));
    await flush();
    await act(async () => void (await vi.advanceTimersByTimeAsync(LISTEN_MAX_MS + 1)));
    await flush();
    expect(gum).toHaveBeenCalledTimes(1);
    await click(mic('Toque para falar'));
    await flush();
    expect(gum).toHaveBeenCalledTimes(1);
    expect(trackStops).toBe(1);
  });

  it('playback ends by itself: button returns to "Ouvir minha voz"', async () => {
    setup();
    await speakOnce();
    await click(playBtn()!);
    expect(screen.getByRole('button', { name: 'Parar minha voz' })).toBeInTheDocument();
    await act(async () => void FakeAudio.all[0]!.onended?.());
    expect(playBtn()).toBeInTheDocument();
  });
});
