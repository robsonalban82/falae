import { lastSevenDays, weekScale } from './week';

describe('lastSevenDays', () => {
  it('returns 7 days ending today, filling gaps with 0 and ignoring rows outside', () => {
    const out = lastSevenDays(
      [
        { day: '2026-10-29', xp: 30, goalMet: true },
        { day: '2026-10-24', xp: 5, goalMet: false },
        { day: '2026-10-22', xp: 99, goalMet: true }, // outside
        { day: '2026-10-30', xp: 99, goalMet: true }, // future
      ],
      '2026-10-29',
      20,
    );
    expect(out.map((d) => d.day)).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
    ]);
    expect(out.map((d) => d.xp)).toEqual([0, 5, 0, 0, 0, 0, 30]);
    expect(out[6]).toMatchObject({ goalMet: true, weekdayIndex: 4 });
    expect(out[2]?.weekdayIndex).toBe(0);
  });

  it('works across a DST change and a month boundary', () => {
    const out = lastSevenDays([], '2026-11-03', 20);
    expect(out[0]?.day).toBe('2026-10-28');
    expect(out.every((d) => d.xp === 0)).toBe(true);
  });
});

describe('weekScale', () => {
  it('uses the goal or the biggest day', () => {
    const days = lastSevenDays([{ day: '2026-10-29', xp: 45, goalMet: true }], '2026-10-29', 20);
    expect(weekScale(days, 20)).toBe(45);
    expect(weekScale(lastSevenDays([], '2026-10-29', 20), 20)).toBe(20);
  });
});
