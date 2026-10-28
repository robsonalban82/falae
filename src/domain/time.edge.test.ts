import { addDays, dayKey, diffDays, parseDayKey } from './time';
import { clock } from '../services/clock';

/** Runs `fn` with the process time zone switched (Node re-reads TZ at runtime). */
function inZone(tz: string, fn: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

afterEach(() => clock.reset());

describe('dayKey near midnight (local time zone)', () => {
  it('uses the São Paulo day, not the UTC day', () => {
    inZone('America/Sao_Paulo', () => {
      // 23:59:59 in Brazil (UTC-3) is already the next day in UTC.
      expect(dayKey(Date.parse('2026-10-29T02:59:59Z'))).toBe('2026-10-28');
      expect(dayKey(Date.parse('2026-10-29T03:00:00Z'))).toBe('2026-10-29');
    });
  });

  it('uses the local day in a zone ahead of UTC', () => {
    inZone('Asia/Tokyo', () => {
      expect(dayKey(Date.parse('2026-10-28T14:59:59Z'))).toBe('2026-10-28');
      expect(dayKey(Date.parse('2026-10-28T15:00:00Z'))).toBe('2026-10-29');
    });
  });

  it('flips at exactly local midnight with the simulated clock', () => {
    inZone('America/Sao_Paulo', () => {
      clock.setNow('2026-10-28T23:59:59.999-03:00');
      expect(clock.today()).toBe('2026-10-28');
      clock.advance(1);
      expect(clock.today()).toBe('2026-10-29');
    });
  });

  it('handles new year at midnight', () => {
    inZone('America/Sao_Paulo', () => {
      clock.setNow('2026-12-31T23:59:59-03:00');
      expect(clock.today()).toBe('2026-12-31');
      clock.advance(1000);
      expect(clock.today()).toBe('2027-01-01');
    });
  });
});

describe('addDays / diffDays across DST transitions', () => {
  it('is DST-safe in New York (spring forward / fall back)', () => {
    inZone('America/New_York', () => {
      expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
      expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
      expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
      expect(diffDays('2026-10-25', '2026-11-08')).toBe(14);
    });
  });

  it('is DST-safe in a zone whose DST starts at midnight (old Brazil rule)', () => {
    // Brazil used to jump 00:00 -> 01:00; local midnight did not exist that day.
    inZone('America/Sao_Paulo', () => {
      expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
      expect(addDays('2018-11-04', 1)).toBe('2018-11-05');
      expect(diffDays('2018-11-03', '2018-11-05')).toBe(2);
    });
  });

  it('round-trips addDays and diffDays over a long range', () => {
    inZone('America/New_York', () => {
      let key = '2026-01-01';
      for (let i = 1; i <= 800; i++) {
        key = addDays(key, 1);
        expect(diffDays('2026-01-01', key)).toBe(i);
      }
    });
  });

  it('supports zero and negative offsets', () => {
    expect(addDays('2026-10-28', 0)).toBe('2026-10-28');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-01-01', -365)).toBe('2025-01-01');
  });
});

describe('parseDayKey validation', () => {
  it('rejects garbage', () => {
    for (const bad of ['', 'nope', '2026-10', '2026-10-28T10:00', 'aaaa-bb-cc']) {
      expect(() => parseDayKey(bad), bad).toThrow();
    }
  });

  it('rejects impossible calendar dates instead of rolling them over (fixed)', () => {
    for (const bad of [
      '2026-02-30',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2027-02-29',
      '2026-10-00',
    ]) {
      expect(() => parseDayKey(bad), bad).toThrow();
    }
  });

  it('accepts real edge dates (leap day, month ends)', () => {
    for (const ok of ['2028-02-29', '2026-12-31', '2026-01-31', '2026-04-30']) {
      expect(dayKey(parseDayKey(ok).getTime())).toBe(ok);
    }
  });
});

describe('clock edge cases', () => {
  it('setNow(0) fixes time at the epoch (0 is not treated as "unset")', () => {
    clock.setNow(0);
    expect(clock.now()).toBe(0);
  });

  it('setNow(null) goes back to real time', () => {
    clock.setNow('2020-01-01T00:00:00Z');
    clock.setNow(null);
    expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1000);
  });

  it('advance accumulates and reset clears both offset and fixed time', () => {
    clock.setNow('2026-10-28T12:00:00Z');
    clock.advance(3_600_000);
    clock.advance(-7_200_000);
    expect(clock.iso()).toBe('2026-10-28T11:00:00.000Z');
    clock.reset();
    expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1000);
  });

  it('setNow rejects an invalid date instead of storing NaN (fixed after QA report)', () => {
    clock.setNow('2026-10-28T12:00:00Z');
    expect(() => clock.setNow('not a date')).toThrow(/invalid date/);
    expect(clock.iso()).toBe('2026-10-28T12:00:00.000Z'); // previous value kept
  });
});
