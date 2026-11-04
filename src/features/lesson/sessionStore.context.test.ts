import { startLesson } from '../../domain/lesson/engine';
import type { Exercise } from '../../content/schema';
import { clearSession, loadSession, saveSession } from './sessionStore';

const exercise: Exercise = {
  id: 'x1',
  type: 'multiple-choice',
  itemIds: ['u1-hi'],
  prompt: 'p',
  options: [{ text: 'hi' }, { text: 'bye' }, { text: 'good morning' }],
  answer: 'hi',
};
const base = startLesson({
  lessonId: 'c1',
  kind: 'map',
  exercises: [exercise],
  hearts: 5,
  nowMs: 0,
  context: { mapId: 'm', deckKey: 'd', planDay: 3 },
});

function raw(mutate: (s: Record<string, unknown>) => void): void {
  const state = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  mutate(state);
  sessionStorage.setItem('falae-lesson-session', JSON.stringify({ v: 1, state }));
}

afterEach(() => clearSession());

describe('sessionStore context robustness', () => {
  it('round-trips full context with kind map', () => {
    saveSession(base);
    expect(loadSession('c1')).toEqual(base);
  });

  it.each([
    ['mapId number', { mapId: 5 }],
    ['planDay negative', { planDay: -1 }],
    ['planDay float', { planDay: 1.5 }],
    ['context string', 'oops'],
    ['context array', []],
  ])('discards session with malformed context (%s) without crashing', (_n, ctx) => {
    raw((s) => {
      s.context = ctx;
    });
    expect(loadSession('c1')).toBeNull();
    expect(sessionStorage.getItem('falae-lesson-session')).toBeNull();
  });

  it('null context is discarded safely', () => {
    raw((s) => {
      s.context = null;
    });
    expect(loadSession('c1')).toBeNull();
  });

  it('drops unknown context keys', () => {
    raw((s) => {
      s.context = { mapId: 'm', evil: 1 };
    });
    expect(loadSession('c1')?.context).toEqual({ mapId: 'm' });
  });

  it('rejects an unknown kind', () => {
    raw((s) => {
      s.kind = 'bogus';
    });
    expect(loadSession('c1')).toBeNull();
  });

  it('keeps kind cards', () => {
    saveSession({ ...base, kind: 'cards' });
    expect(loadSession('c1')?.kind).toBe('cards');
  });
});
