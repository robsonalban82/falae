import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Exercise } from '../../../content/schema';
import { LISTEN_MAX_MS, LISTEN_SILENCE_MS } from '../../../services/speech';
import { ExerciseView } from './exerciseRegistry';

/** QA: the speak exercise must never stay stuck on "listening" (iOS Safari). */

const sp: Exercise = {
  id: 'q-sp',
  type: 'speak',
  itemIds: ['x'],
  textEn: 'Hello, my name is Ana.',
};

type Result = { transcript: string }[] & { isFinal?: boolean };
const res = (text: string, isFinal?: boolean): Result =>
  Object.assign([{ transcript: text }], isFinal === undefined ? {} : { isFinal });

class Fake {
  static all: Fake[] = [];
  static throwOnStart: Error | null = null;
  onresult: ((e: { results: Result[] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  aborts = 0;
  constructor() {
    Fake.all.push(this);
  }
  start() {
    if (Fake.throwOnStart) throw Fake.throwOnStart;
  }
  abort() {
    this.aborts++;
  }
}

function setup() {
  const onChange = vi.fn();
  const onSkip = vi.fn();
  const user = {
    click: async (el: HTMLElement) => void (await act(async () => void fireEvent.click(el))),
    dblClick: async (el: HTMLElement) => {
      await act(async () => void fireEvent.click(el));
      await act(async () => void fireEvent.click(el));
    },
  };
  const utils = render(
    <ExerciseView
      exercise={sp}
      disabled={false}
      onChange={onChange}
      onSubmit={vi.fn()}
      onSkip={onSkip}
      sound={false}
    />,
  );
  return { ...utils, user, onChange, onSkip };
}
const mic = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers();
  Fake.all = [];
  Fake.throwOnStart = null;
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Fake;
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe('speak never gets stuck on listening', () => {
  it('no event at all: leaves "Ouvindo" after LISTEN_MAX_MS', async () => {
    const { user, onChange } = setup();
    await user.click(mic('Toque para falar'));
    expect(screen.getByText('Ouvindo… fale agora')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_MAX_MS - 1);
    });
    expect(screen.getByText('Ouvindo… fale agora')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByText('Ouvindo… fale agora')).toBeNull();
    expect(screen.getByText(/Não ouvi nada/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(mic('Toque para falar')).toBeEnabled();
  });

  it('only interim results: finishes after silence with the latest text', async () => {
    const { user, onChange } = setup();
    await user.click(mic('Toque para falar'));
    await act(async () => Fake.all[0]!.onresult!({ results: [res('hello my', false)] }));
    await act(async () =>
      Fake.all[0]!.onresult!({ results: [res('hello my name is Ana', false)] }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_SILENCE_MS);
    });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'speech',
      transcripts: ['hello my name is Ana'],
    });
    expect(screen.getByText(/Entendi:/)).toBeInTheDocument();
  });

  it('tapping the mic while listening ends the turn with what was heard', async () => {
    const { user, onChange } = setup();
    await user.click(mic('Toque para falar'));
    await act(async () => Fake.all[0]!.onresult!({ results: [res('hello', false)] }));
    await user.click(mic('Toque para terminar'));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'speech', transcripts: ['hello'] });
    expect(mic('Toque para falar')).toBeEnabled();
  });

  it('double tap quickly: one recognizer, ends as "nothing", no crash', async () => {
    const { user } = setup();
    const b = mic('Toque para falar');
    await user.dblClick(b);
    expect(Fake.all).toHaveLength(1);
    expect(screen.getByText(/Não ouvi nada/)).toBeInTheDocument();
    // can start again afterwards
    await user.click(mic('Toque para falar'));
    expect(Fake.all).toHaveLength(2);
    expect(screen.getByText('Ouvindo… fale agora')).toBeInTheDocument();
  });

  it('"Não posso falar agora" while listening calls onSkip and the turn still ends', async () => {
    const { user, onSkip } = setup();
    await user.click(mic('Toque para falar'));
    await user.click(screen.getByRole('button', { name: 'Não posso falar agora' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_MAX_MS);
    });
    expect(screen.queryByText('Ouvindo… fale agora')).toBeNull();
  });

  it('unmounting while listening aborts, with no late state update or error', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { user, unmount, onChange } = setup();
    await user.click(mic('Toque para falar'));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_MAX_MS * 2);
    });
    expect(Fake.all[0]!.aborts).toBeGreaterThan(0);
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'speech' }));
    expect(errors).toEqual([]);
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
    spy.mockRestore();
  });

  it('start() throwing: leaves "Ouvindo" right away', async () => {
    Fake.throwOnStart = new Error('InvalidStateError');
    const { user, onChange } = setup();
    await user.click(mic('Toque para falar'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText('Ouvindo… fale agora')).toBeNull();
    expect(screen.getByText(/Não ouvi nada/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('not-allowed shows the denied message (skip offered)', async () => {
    const { user } = setup();
    await user.click(mic('Toque para falar'));
    await act(async () => Fake.all[0]!.onerror!({ error: 'not-allowed' }));
    expect(screen.getByText(/Sem acesso ao microfone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Não posso falar agora' })).toBeEnabled();
  });

  it('a stale turn cannot overwrite a newer one', async () => {
    const { user } = setup();
    await user.click(mic('Toque para falar'));
    await user.click(mic('Toque para terminar')); // turn 1 ends
    await user.click(mic('Toque para falar')); // turn 2
    expect(Fake.all[0]!.onresult).toBeNull(); // old recognizer is detached
    expect(screen.getByText('Ouvindo… fale agora')).toBeInTheDocument();
  });
});
