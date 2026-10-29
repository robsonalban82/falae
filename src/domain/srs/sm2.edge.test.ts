import { addDays } from '../time';
import { applyOutcomes, isLearned, newCard, review, seedTestedOut, type Card } from './sm2';
import { dueCount, learnedAfter, selectForPractice } from './selection';

const D = '2026-10-29';
const card = (p: Partial<Card> = {}): Card => ({ ...newCard('a', '2026-10-01'), ...p });

describe('sm2 — QA edge cases', () => {
  it('cards come due after simulated days and are learned only after 3-day interval', () => {
    let c = review(newCard('a', D), 5, D); // reps1 interval1
    expect(c.dueDay).toBe(addDays(D, 1));
    expect(dueCount([c], D)).toBe(0);
    let day = addDays(D, 1);
    expect(dueCount([c], day)).toBe(1);
    c = review(c, 5, day); // reps2 interval3
    expect(isLearned(c)).toBe(true);
    day = addDays(day, 3);
    expect(dueCount([c], day)).toBe(1);
    c = review(c, 5, day);
    expect(c.intervalDays).toBe(Math.round(3 * 2.6));
  });

  it('long run of q=5 caps at 180 days and never yields NaN', () => {
    let c = newCard('a', D);
    let day = D;
    for (let i = 0; i < 40; i++) {
      c = review(c, 5, day);
      day = c.dueDay;
    }
    expect(c.intervalDays).toBe(180);
    expect(Number.isFinite(c.ease)).toBe(true);
  });

  it('repeated failures hold ease at 1.3 floor, 2 decimals', () => {
    let c = card();
    let day = D;
    for (let i = 0; i < 20; i++) {
      c = review(c, 0, day);
      day = addDays(day, 1);
    }
    expect(c.ease).toBe(1.3);
    expect(c.lapses).toBe(20);
  });

  it('weird q values (0, 3, 2.5, 6) do not throw', () => {
    for (const q of [0, 3, 2.5, 6, -1]) expect(() => review(card(), q, D)).not.toThrow();
    expect(review(card(), 3, D).reps).toBe(1);
    expect(review(card(), 2.5, D).reps).toBe(0);
  });

  it('same day: reviewing a passed card again does not advance it', () => {
    const c1 = review(card({ reps: 1, intervalDays: 1, lastReviewDay: addDays(D, -1) }), 5, D);
    expect(review(c1, 5, D)).toEqual(c1);
    expect(applyOutcomes([c1], [{ itemId: 'a', q: 5 }], D)).toEqual([]);
  });

  it('clock going back leaves cards intact (applyOutcomes returns nothing)', () => {
    const c = card({ reps: 2, intervalDays: 3, lastReviewDay: D });
    expect(applyOutcomes([c], [{ itemId: 'a', q: 1 }], addDays(D, -2))).toEqual([]);
  });

  it('seedTestedOut with duplicated ids creates one card each', () => {
    const out = seedTestedOut([], ['x', 'x', 'y'], D);
    expect(out.map((c) => c.itemId)).toEqual(['x', 'y']);
  });

  it('learnedAfter does not hide an inconsistent count and counts the 50th learned word', () => {
    // `before` = 0 but a learned card existed: the inconsistency shows up as −1 (not clamped).
    expect(
      learnedAfter(0, [card({ reps: 2, intervalDays: 3 })], [card({ reps: 0, intervalDays: 1 })]),
    ).toBe(-1);
    expect(
      learnedAfter(49, [card({ reps: 1, intervalDays: 1 })], [card({ reps: 2, intervalDays: 3 })]),
    ).toBe(50);
  });

  it('practice selection: no cards + no fallback → empty, never throws', () => {
    expect(selectForPractice([], D, [], new Set())).toEqual([]);
  });

  it('practice selection: unknown cards are ignored and fallback fills without duplicates', () => {
    const cards = [card({ itemId: 'gone', dueDay: D }), card({ itemId: 'k1', dueDay: D })];
    const ids = selectForPractice(
      cards,
      D,
      ['k1', 'k2', 'k2', 'gone', 'k3', 'k4'],
      new Set(['k1', 'k2', 'k3', 'k4']),
    );
    expect(ids).toEqual(['k1', 'k2', 'k3', 'k4']);
  });

  it('practice selection: 30 overdue cards → exactly 12', () => {
    const cards = Array.from({ length: 30 }, (_, i) => card({ itemId: `i${i}`, dueDay: D }));
    expect(selectForPractice(cards, D, [], new Set(cards.map((c) => c.itemId)))).toHaveLength(12);
  });
});
