import { gainHeart, HEART_REFILL_MS, loseHeart, MAX_HEARTS, refillHearts } from './hearts';

const T0 = Date.parse('2026-10-28T10:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('hearts', () => {
  it('full hearts never refill beyond max and have no timer', () => {
    expect(
      refillHearts({ hearts: 5, heartsUpdatedAt: iso(T0) }, T0 + 99 * HEART_REFILL_MS),
    ).toMatchObject({
      hearts: MAX_HEARTS,
      nextHeartInMs: null,
    });
  });

  it('losing the first heart starts the refill clock', () => {
    const s = loseHeart({ hearts: 5, heartsUpdatedAt: iso(T0 - 10 * HEART_REFILL_MS) }, T0);
    expect(s).toEqual({ hearts: 4, heartsUpdatedAt: iso(T0) });
    expect(refillHearts(s, T0 + HEART_REFILL_MS - 1)).toMatchObject({
      hearts: 4,
      nextHeartInMs: 1,
    });
    expect(refillHearts(s, T0 + HEART_REFILL_MS).hearts).toBe(5);
  });

  it('keeps the running period when losing more hearts', () => {
    let s = loseHeart({ hearts: 5, heartsUpdatedAt: iso(T0) }, T0);
    s = loseHeart(s, T0 + 60_000);
    expect(s).toEqual({ hearts: 3, heartsUpdatedAt: iso(T0) });
  });

  it('refills one heart per period and carries the remainder', () => {
    const s = { hearts: 1, heartsUpdatedAt: iso(T0) };
    const later = refillHearts(s, T0 + 2.5 * HEART_REFILL_MS);
    expect(later.hearts).toBe(3);
    expect(later.heartsUpdatedAt).toBe(iso(T0 + 2 * HEART_REFILL_MS));
    expect(later.nextHeartInMs).toBe(0.5 * HEART_REFILL_MS);
  });

  it('caps at max after a long time away', () => {
    expect(
      refillHearts({ hearts: 0, heartsUpdatedAt: iso(T0) }, T0 + 30 * HEART_REFILL_MS).hearts,
    ).toBe(5);
  });

  it('never goes below zero', () => {
    expect(loseHeart({ hearts: 0, heartsUpdatedAt: iso(T0) }, T0).hearts).toBe(0);
  });

  it('gainHeart adds one (practice reward) and stops the clock at max', () => {
    expect(gainHeart({ hearts: 2, heartsUpdatedAt: iso(T0) }, T0 + 1000)).toEqual({
      hearts: 3,
      heartsUpdatedAt: iso(T0),
    });
    expect(gainHeart({ hearts: 4, heartsUpdatedAt: iso(T0) }, T0 + 1000)).toEqual({
      hearts: 5,
      heartsUpdatedAt: iso(T0 + 1000),
    });
  });

  it('clock going backwards does not add hearts', () => {
    expect(refillHearts({ hearts: 2, heartsUpdatedAt: iso(T0) }, T0 - HEART_REFILL_MS).hearts).toBe(
      2,
    );
  });

  it('next heart is never more than one refill period away (future timestamp)', () => {
    // Regression: heartsUpdatedAt ~23 h in the future showed "próximo em 27 h".
    const r = refillHearts({ hearts: 3, heartsUpdatedAt: iso(T0 + 23 * 3_600_000) }, T0);
    expect(r.hearts).toBe(3);
    expect(r.nextHeartInMs).toBe(HEART_REFILL_MS);
    expect(r.heartsUpdatedAt).toBe(iso(T0));
  });
});
