import { sessionXp } from './xp';

describe('sessionXp', () => {
  it.each([
    ['lesson', false, 0, 10],
    ['lesson', true, 2, 17],
    ['lesson', true, 99, 20],
    ['review', true, 0, 20],
    ['practice', false, 1, 9],
    ['placement', true, 5, 0],
  ] as const)('%s perfect=%s combo=%s → %s', (kind, perfect, combo, xp) => {
    expect(sessionXp(kind, perfect, combo)).toBe(xp);
  });
});
