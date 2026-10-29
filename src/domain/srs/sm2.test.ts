import {
  applyOutcomes,
  isLearned,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  newCard,
  review,
  seedTestedOut,
  type Card,
} from './sm2';

const D0 = '2026-10-01';
const D1 = '2026-10-02';
const card = (patch: Partial<Card> = {}): Card => ({
  itemId: 'a',
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
  dueDay: '2026-09-30',
  lastReviewDay: '2026-09-30',
  ...patch,
});

describe('review', () => {
  it.each([
    // reps, interval, q → reps, interval, lapses, ease
    [0, 0, 5, 1, 1, 0, 2.6],
    [0, 0, 4, 1, 1, 0, 2.5],
    [0, 0, 2, 0, 1, 1, 2.18],
    [0, 0, 1, 0, 1, 1, 1.96],
    [1, 1, 5, 2, 3, 0, 2.6],
    [1, 1, 4, 2, 3, 0, 2.5],
    [1, 1, 2, 0, 1, 1, 2.18],
    [2, 3, 5, 3, 8, 0, 2.6], // round(3 × 2.5) with the previous ease
    [2, 3, 4, 3, 8, 0, 2.5],
    [2, 3, 1, 0, 1, 1, 1.96],
    [5, 20, 5, 6, 50, 0, 2.6],
    [5, 20, 4, 6, 50, 0, 2.5],
    [5, 20, 2, 0, 1, 1, 2.18],
    [5, 20, 1, 0, 1, 1, 1.96],
  ])('reps %i interval %i q %i', (reps, interval, q, eReps, eInterval, eLapses, eEase) => {
    const out = review(card({ reps, intervalDays: interval }), q, D1);
    expect(out).toMatchObject({
      reps: eReps,
      intervalDays: eInterval,
      lapses: eLapses,
      ease: eEase,
      lastReviewDay: D1,
    });
    expect(out.dueDay).toBe(
      { 1: '2026-10-03', 3: '2026-10-05', 8: '2026-10-10', 50: '2026-11-21' }[eInterval],
    );
  });

  it('ease never goes below 1.3', () => {
    let c = card({ ease: 1.35 });
    for (let i = 0; i < 5; i++) c = review({ ...c, lastReviewDay: '2026-01-01' }, 1, D1);
    expect(c.ease).toBe(MIN_EASE);
  });

  it('interval is capped at 180 days', () => {
    const out = review(card({ reps: 6, intervalDays: 150, ease: 2.5 }), 5, D1);
    expect(out.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it('out-of-set q values are handled by range', () => {
    expect(review(card(), 0, D1).reps).toBe(0);
    expect(review(card(), 3, D1).reps).toBe(1);
  });

  it('a second success on the same day does not advance the card', () => {
    const first = review(card({ reps: 1, intervalDays: 1 }), 5, D1);
    expect(review(first, 5, D1)).toBe(first);
  });

  it('a failure on the same day still counts', () => {
    const first = review(card({ reps: 1, intervalDays: 1 }), 5, D1);
    expect(review(first, 1, D1)).toMatchObject({ reps: 0, lapses: 1, intervalDays: 1 });
  });

  it('clock going back leaves the card untouched', () => {
    const c = card({ lastReviewDay: D1, reps: 2, intervalDays: 3 });
    expect(review(c, 5, D0)).toBe(c);
  });

  it('a card that failed today is not penalized again nor advanced the same day', () => {
    const failed = review(card({ reps: 2, intervalDays: 3 }), 1, D1);
    expect(review(failed, 5, D1)).toBe(failed);
    expect(review(failed, 1, D1)).toBe(failed);
    expect(review(failed, 1, D1).lapses).toBe(1);
    const fromNew = review(newCard('a', D1), 1, D1);
    expect(review(fromNew, 5, D1)).toEqual(fromNew);
  });

  it('a new card advances on its first success the same day', () => {
    expect(review(newCard('a', D1), 5, D1)).toMatchObject({ reps: 1, intervalDays: 1 });
  });
});

describe('applyOutcomes', () => {
  it('creates cards for new items and aggregates repeated items by the lowest q', () => {
    const out = applyOutcomes(
      [],
      [
        { itemId: 'b', q: 5 },
        { itemId: 'a', q: 5 },
        { itemId: 'b', q: 2 },
      ],
      D1,
    );
    expect(out.map((c) => c.itemId)).toEqual(['b', 'a']);
    expect(out[0]).toMatchObject({ reps: 0, lapses: 1 });
    expect(out[1]).toMatchObject({ reps: 1, intervalDays: 1 });
  });

  it('returns only changed cards', () => {
    const today = review(card({ reps: 1, intervalDays: 1 }), 5, D1);
    expect(applyOutcomes([today], [{ itemId: 'a', q: 5 }], D1)).toEqual([]);
  });
});

describe('seedTestedOut', () => {
  it('creates interval-3 cards only for items without a card', () => {
    const existing = card({ itemId: 'a', reps: 0, lapses: 2 });
    const out = seedTestedOut([existing], ['a', 'b', 'b'], D1);
    expect(out).toEqual([
      {
        itemId: 'b',
        ease: 2.5,
        intervalDays: 3,
        reps: 2,
        lapses: 0,
        dueDay: '2026-10-05',
        lastReviewDay: D1,
      },
    ]);
    expect(isLearned(out[0] as Card)).toBe(true);
  });

  it('next success after seeding follows round(3 × ease)', () => {
    const [seeded] = seedTestedOut([], ['x'], D0);
    expect(review(seeded as Card, 5, '2026-10-04').intervalDays).toBe(8);
  });
});

describe('isLearned', () => {
  it('needs reps ≥ 1 and interval ≥ 3', () => {
    expect(isLearned(card({ reps: 1, intervalDays: 3 }))).toBe(true);
    expect(isLearned(card({ reps: 1, intervalDays: 1 }))).toBe(false);
    expect(isLearned(card({ reps: 0, intervalDays: 3 }))).toBe(false);
  });
});
