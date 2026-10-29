import { seededRandom, shuffle } from './random';

describe('seededRandom', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(90);
  });

  it('different seeds give different sequences', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('handles seeds beyond 32 bits (clock.now())', () => {
    const x = seededRandom(1_793_000_000_000)();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});

describe('shuffle', () => {
  it('keeps every item and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRandom(7));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shuffle(input, seededRandom(7))).toEqual(out);
  });
});
