import { lastSevenDays, weekScale } from './week';

describe('week — edges', () => {
  it('crosses DST/month/year boundaries with 7 distinct days', () => {
    for (const today of ['2027-01-02', '2026-03-01', '2026-11-02', '2024-02-29']) {
      const days = lastSevenDays([], today, 20);
      expect(new Set(days.map((d) => d.day)).size).toBe(7);
      expect(days[6]?.day).toBe(today);
    }
  });
  it('ignores rows outside and in the future', () => {
    const days = lastSevenDays(
      [
        { day: '2026-10-30', xp: 99, goalMet: true },
        { day: '2026-10-22', xp: 5, goalMet: false },
      ],
      '2026-10-29',
      20,
    );
    expect(days.reduce((s, d) => s + d.xp, 0)).toBe(0);
  });
  it('scale is never 0', () => {
    expect(weekScale(lastSevenDays([], '2026-10-29', 0), 0)).toBeGreaterThan(0);
  });
});
