import { describe, expect, it } from 'vitest';
import { goalProgress, shouldCelebrateGoal } from './dailyGoal';

describe('daily goal edge cases', () => {
  it('exact goal is met, one below is not', () => {
    expect(goalProgress(20, 20).met).toBe(true);
    expect(goalProgress(19, 20).met).toBe(false);
  });
  it('ratio is clamped and negative XP floors at 0', () => {
    expect(goalProgress(500, 20).ratio).toBe(1);
    expect(goalProgress(-5, 20)).toMatchObject({ xp: 0, ratio: 0 });
  });
  it('celebrates once per day, again next day', () => {
    expect(shouldCelebrateGoal(20, 20, undefined, '2026-10-29')).toBe(true);
    expect(shouldCelebrateGoal(40, 20, '2026-10-29', '2026-10-29')).toBe(false);
    expect(shouldCelebrateGoal(20, 20, '2026-10-29', '2026-10-30')).toBe(true);
  });
  it('clock back to a day before the last celebration: does not celebrate (DECISOES)', () => {
    expect(shouldCelebrateGoal(20, 20, '2026-10-29', '2026-10-28')).toBe(false);
  });
  it('clock back to a day before the last activity: does not celebrate', () => {
    expect(shouldCelebrateGoal(20, 20, undefined, '2026-10-28', '2026-10-29')).toBe(false);
  });
});
