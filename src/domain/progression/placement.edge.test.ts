import { placementPassed, placementScore } from './placement';

describe('placement — threshold edges', () => {
  it('80% exact passes (12/15, 8/10, 4/5)', () => {
    for (const [c, a] of [
      [12, 15],
      [8, 10],
      [4, 5],
      [16, 20],
    ] as const)
      expect(placementPassed(placementScore({ correct: c, answered: a }))).toBe(true);
  });
  it('just under 80% fails (11/15, 79/100, 11/14)', () => {
    for (const [c, a] of [
      [11, 15],
      [79, 100],
      [11, 14],
    ] as const)
      expect(placementPassed(placementScore({ correct: c, answered: a }))).toBe(false);
  });
  it('0 answered → 0 and failed', () => {
    expect(placementScore({ correct: 0, answered: 0 })).toBe(0);
    expect(placementPassed(0)).toBe(false);
  });
});
