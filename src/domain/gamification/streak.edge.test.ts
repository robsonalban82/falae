import { describe, expect, it } from 'vitest';
import { applyActivity, displayStreak, type Streak } from './streak';

const s = (p: Partial<Streak> = {}): Streak => ({
  current: 4,
  longest: 4,
  lastActiveDay: '2026-10-28',
  freezes: 0,
  xpTowardFreeze: 0,
  ...p,
});

describe('streak edge cases', () => {
  it('year boundary: 31/12 -> 01/01 continues', () => {
    expect(applyActivity(s({ lastActiveDay: '2026-12-31' }), '2027-01-01', 10).event).toBe(
      'continued',
    );
  });
  it('anteontem across a leap day with a freeze', () => {
    const r = applyActivity(s({ lastActiveDay: '2028-02-28', freezes: 1 }), '2028-03-01', 10);
    expect(r.event).toBe('frozen');
    expect(r.streak.current).toBe(5);
    expect(r.streak.freezes).toBe(0);
  });
  it('anteontem without freeze resets and keeps longest', () => {
    const r = applyActivity(s({ lastActiveDay: '2026-10-27', longest: 9 }), '2026-10-29', 10);
    expect(r.streak).toMatchObject({ current: 1, longest: 9 });
    expect(r.event).toBe('reset');
  });
  it('3+ days gap never spends freezes, even with 2', () => {
    const r = applyActivity(s({ lastActiveDay: '2026-10-20', freezes: 2 }), '2026-10-29', 0);
    expect(r.streak.freezes).toBe(2);
    expect(r.freezeUsed).toBe(false);
  });
  it('freeze spent then the same lesson earns it back (spent before XP)', () => {
    const r = applyActivity(
      s({ lastActiveDay: '2026-10-27', freezes: 2, xpTowardFreeze: 0 }),
      '2026-10-29',
      100,
    );
    expect(r.freezeUsed).toBe(true);
    expect(r.streak.freezes).toBe(2);
    expect(r.freezesEarned).toBe(1);
    expect(r.streak.xpTowardFreeze).toBe(0);
  });
  it('clock going back keeps lastActiveDay and does not shrink the streak; XP still earns', () => {
    const r = applyActivity(s({ xpTowardFreeze: 90 }), '2026-10-20', 15);
    expect(r.event).toBe('clockBack');
    expect(r.increased).toBe(false);
    expect(r.streak.lastActiveDay).toBe('2026-10-28');
    expect(r.streak.current).toBe(4);
    expect(r.streak.freezes).toBe(1);
    expect(r.streak.xpTowardFreeze).toBe(5);
  });
  it('clock back then forward again to the original next day still continues', () => {
    const back = applyActivity(s(), '2026-10-20', 10).streak;
    expect(applyActivity(back, '2026-10-29', 10).event).toBe('continued');
  });
  it('same day twice is idempotent in count', () => {
    const a = applyActivity(s(), '2026-10-29', 10).streak;
    const b = applyActivity(a, '2026-10-29', 10);
    expect(b.event).toBe('sameDay');
    expect(b.streak.current).toBe(5);
  });
  it('does not mutate the input', () => {
    const input = s({ freezes: 1, lastActiveDay: '2026-10-27' });
    const copy = structuredClone(input);
    applyActivity(input, '2026-10-29', 250);
    expect(input).toEqual(copy);
  });
  it('display: clock back shows current, not "done today" flag wrongly at risk', () => {
    const d = displayStreak(s(), '2026-10-20');
    expect(d.value).toBe(4);
    expect(d.atRisk).toBe(false);
  });
  it('display: anteontem with 0 freezes shows 0 (would reset)', () => {
    expect(displayStreak(s({ lastActiveDay: '2026-10-27' }), '2026-10-29').value).toBe(0);
  });
  it('display and apply agree for gap 0..5 with/without freezes', () => {
    for (let gap = 0; gap <= 5; gap++)
      for (const freezes of [0, 1, 2]) {
        const st = s({ lastActiveDay: '2026-10-20', freezes });
        const day = `2026-10-${20 + gap}`;
        const d = displayStreak(st, day);
        const a = applyActivity(st, day, 0);
        // If the display shows a non-zero streak, the lesson must keep it (+1 or same).
        if (d.value > 0) expect(a.streak.current).toBeGreaterThanOrEqual(d.value);
        else expect(a.streak.current).toBe(1);
        expect(d.willUseFreeze).toBe(a.freezeUsed);
      }
  });
});
