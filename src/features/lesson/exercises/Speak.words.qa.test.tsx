import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Exercise } from '../../../content/schema';
import { ExerciseView } from './exerciseRegistry';

/** QA: word-by-word feedback in the speak exercise. */

const sp: Exercise = { id: 'q-w', type: 'speak', itemIds: ['x'], textEn: 'Hello, my name is Ana.' };

type Alt = { transcript: string };
type Result = Alt[] & { isFinal?: boolean };

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

const click = (el: HTMLElement) => act(async () => void fireEvent.click(el));

async function speak(alts: string[]) {
  render(
    <ExerciseView
      exercise={sp}
      disabled={false}
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      onSkip={vi.fn()}
      sound={false}
    />,
  );
  await click(screen.getByRole('button', { name: 'Toque para falar' }));
  const r: Result = Object.assign(
    alts.map((transcript) => ({ transcript })),
    { isFinal: true },
  );
  await act(async () => FakeSR.all[0]!.onresult!({ results: [r] }));
  await act(async () => void (await Promise.resolve()));
}

beforeEach(() => {
  FakeSR.all = [];
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
});
afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe('speak word feedback', () => {
  it('marks only the missed words, with sr-only text for screen readers', async () => {
    await speak(['hello name is']);
    const marks = document.querySelectorAll('mark');
    expect([...marks].map((m) => m.firstChild?.textContent)).toEqual(['my', 'Ana.']);
    for (const m of marks) {
      const sr = m.querySelector('.sr-only');
      expect(sr).not.toBeNull();
      expect(sr?.textContent).toContain('não entendi');
    }
    expect(document.querySelectorAll('mark .sr-only')).toHaveLength(2);
    expect(screen.getByText(/Em verde, o que eu entendi/)).toBeInTheDocument();
  });

  it('full match: no marks', async () => {
    await speak(['Hello my name is Ana']);
    expect(document.querySelectorAll('mark')).toHaveLength(0);
    expect(document.querySelectorAll('.sr-only')).toHaveLength(0);
  });

  it('picks the alternative that matches the most words, not the first', async () => {
    await speak(['yellow bee name', 'hello my name is Ana']);
    expect(document.querySelectorAll('mark')).toHaveLength(0);
    expect(screen.getByText(/Entendi:/).parentElement?.textContent).toContain(
      'hello my name is Ana',
    );
  });

  it('tie keeps the first alternative', async () => {
    await speak(['hello', 'my']);
    expect(screen.getByText(/Entendi:/).parentElement?.textContent).toContain('“hello”');
  });

  it('nothing heard: no word list', async () => {
    render(
      <ExerciseView
        exercise={sp}
        disabled={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        sound={false}
      />,
    );
    await click(screen.getByRole('button', { name: 'Toque para falar' }));
    await act(async () => FakeSR.all[0]!.onerror!({ error: 'no-speech' }));
    expect(document.querySelectorAll('mark')).toHaveLength(0);
    expect(screen.queryByText(/Em verde/)).toBeNull();
  });

  it('new turn clears the word list', async () => {
    await speak(['hello']);
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(0);
    await click(screen.getByRole('button', { name: 'Toque para falar' }));
    expect(document.querySelectorAll('mark')).toHaveLength(0);
  });
});
