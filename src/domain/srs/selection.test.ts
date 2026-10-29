import { dueCount, learnedAfter, selectForPractice, wordsLearned } from './selection';
import type { Card } from './sm2';

const TODAY = '2026-10-10';
const card = (itemId: string, patch: Partial<Card> = {}): Card => ({
  itemId,
  ease: 2.5,
  intervalDays: 3,
  reps: 1,
  lapses: 0,
  dueDay: TODAY,
  lastReviewDay: '2026-10-07',
  ...patch,
});
const all = (...ids: string[]) => new Set(ids);

describe('dueCount / wordsLearned', () => {
  it('counts due and learned cards', () => {
    const cards = [card('a'), card('b', { dueDay: '2026-10-11' }), card('c', { intervalDays: 1 })];
    expect(dueCount(cards, TODAY)).toBe(2);
    expect(wordsLearned(cards)).toBe(2);
  });
});

describe('learnedAfter', () => {
  it('adjusts the count with the cards that changed', () => {
    const old = [card('a'), card('b', { intervalDays: 1 })];
    const next = [card('a', { reps: 0, intervalDays: 1 }), card('b'), card('c')];
    expect(learnedAfter(10, old, next)).toBe(10 - 1 + 2);
  });
});

describe('selectForPractice', () => {
  it('orders overdue by due day, lapses, ease, id', () => {
    const cards = [
      card('d', { dueDay: TODAY }),
      card('c', { dueDay: '2026-10-05', lapses: 1 }),
      card('b', { dueDay: '2026-10-05', lapses: 1, ease: 1.9 }),
      card('a', { dueDay: '2026-10-05', lapses: 3 }),
      card('e', { dueDay: '2026-10-01' }),
    ];
    expect(selectForPractice(cards, TODAY, [], all('a', 'b', 'c', 'd', 'e'))).toEqual([
      'e',
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('caps at 12 items', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `i${String(i).padStart(2, '0')}`);
    const out = selectForPractice(
      ids.map((id) => card(id)),
      TODAY,
      [],
      new Set(ids),
    );
    expect(out).toHaveLength(12);
  });

  it('tops up with the weakest not-due cards when fewer than 4 are due', () => {
    const cards = [
      card('due'),
      card('x', { dueDay: '2026-10-20', ease: 2.1 }),
      card('y', { dueDay: '2026-10-12', ease: 1.5 }),
      card('z', { dueDay: '2026-10-15', ease: 2.1 }),
      card('w', { dueDay: '2026-10-15', ease: 2.9 }),
    ];
    expect(selectForPractice(cards, TODAY, [], all('due', 'x', 'y', 'z', 'w'))).toEqual([
      'due',
      'y',
      'z',
      'x',
    ]);
  });

  it('without cards uses the fallback items (known, no duplicates)', () => {
    expect(
      selectForPractice(
        [card('a')],
        TODAY,
        ['a', 'gone', 'b', 'b', 'c', 'd', 'e'],
        all('a', 'b', 'c', 'd', 'e'),
      ),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores cards of items no longer in the content', () => {
    expect(selectForPractice([card('gone'), card('a')], TODAY, [], all('a'))).toEqual(['a']);
  });

  it('can be empty', () => {
    expect(selectForPractice([], TODAY, [], all())).toEqual([]);
  });
});
