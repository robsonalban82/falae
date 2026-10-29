import { addDays, dayKey, diffDays, parseDayKey } from './time';

describe('time', () => {
  it('formats local day keys', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 6, 0, 0).getTime())).toBe('2026-01-06');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('computes calendar day differences', () => {
    expect(diffDays('2026-10-28', '2026-10-28')).toBe(0);
    expect(diffDays('2026-10-28', '2026-10-30')).toBe(2);
    expect(diffDays('2026-10-30', '2026-10-28')).toBe(-2);
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2); // DST weekend in some zones
  });

  it('rejects invalid keys', () => {
    expect(() => parseDayKey('nope')).toThrow();
  });
});

describe('weekday', () => {
  it('returns 0 (Sunday) to 6 (Saturday) from the day key', async () => {
    const { weekday } = await import('./time');
    expect(weekday('2026-10-25')).toBe(0);
    expect(weekday('2026-10-29')).toBe(4);
    expect(weekday('2026-10-31')).toBe(6);
  });
});
