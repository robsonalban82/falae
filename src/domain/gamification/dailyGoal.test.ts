import { goalProgress, shouldCelebrateGoal } from './dailyGoal';

describe('goalProgress', () => {
  it('computes ratio and met', () => {
    expect(goalProgress(12, 20)).toEqual({ xp: 12, goal: 20, ratio: 0.6, met: false });
    expect(goalProgress(20, 20)).toMatchObject({ ratio: 1, met: true });
  });
  it('clamps the ratio to 0–1', () => {
    expect(goalProgress(45, 20).ratio).toBe(1);
    expect(goalProgress(0, 10).ratio).toBe(0);
  });
});

describe('shouldCelebrateGoal', () => {
  const today = '2026-10-29';
  it('celebrates when crossing the goal', () => {
    expect(shouldCelebrateGoal(20, 20, undefined, today)).toBe(true);
  });
  it('does not celebrate below the goal', () => {
    expect(shouldCelebrateGoal(19, 20, undefined, today)).toBe(false);
  });
  it('celebrates only once per day', () => {
    expect(shouldCelebrateGoal(35, 20, today, today)).toBe(false);
  });
  it('celebrates again on a new day', () => {
    expect(shouldCelebrateGoal(20, 20, '2026-10-28', today)).toBe(true);
  });
  it('celebrates once if the goal was lowered below XP already earned', () => {
    expect(shouldCelebrateGoal(45, 10, undefined, today)).toBe(true);
  });
});
