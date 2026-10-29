import { applyActivity, displayStreak, MAX_FREEZES, type Streak } from './streak';

const base: Streak = { current: 0, longest: 0, freezes: 0, xpTowardFreeze: 0 };
const s = (patch: Partial<Streak>): Streak => ({ ...base, ...patch });

describe('applyActivity — day rules', () => {
  it('first activity ever starts at 1', () => {
    const r = applyActivity(base, '2026-10-29', 10);
    expect(r).toMatchObject({ event: 'first', increased: true, freezeUsed: false });
    expect(r.streak).toMatchObject({ current: 1, longest: 1, lastActiveDay: '2026-10-29' });
  });

  it('same day changes nothing in the count', () => {
    const r = applyActivity(
      s({ current: 4, longest: 6, lastActiveDay: '2026-10-29' }),
      '2026-10-29',
      10,
    );
    expect(r).toMatchObject({ event: 'sameDay', increased: false });
    expect(r.streak).toMatchObject({ current: 4, longest: 6, lastActiveDay: '2026-10-29' });
  });

  it('yesterday continues +1', () => {
    const r = applyActivity(
      s({ current: 4, longest: 4, lastActiveDay: '2026-10-28' }),
      '2026-10-29',
      10,
    );
    expect(r).toMatchObject({ event: 'continued', increased: true });
    expect(r.streak).toMatchObject({ current: 5, longest: 5, lastActiveDay: '2026-10-29' });
  });

  it('one missed day with a freeze: freeze covers it and the streak grows', () => {
    const r = applyActivity(
      s({ current: 4, longest: 9, lastActiveDay: '2026-10-27', freezes: 1 }),
      '2026-10-29',
      10,
    );
    expect(r).toMatchObject({ event: 'frozen', increased: true, freezeUsed: true });
    expect(r.streak).toMatchObject({ current: 5, longest: 9, freezes: 0 });
  });

  it('one missed day without a freeze resets to 1', () => {
    const r = applyActivity(
      s({ current: 4, longest: 4, lastActiveDay: '2026-10-27' }),
      '2026-10-29',
      10,
    );
    expect(r).toMatchObject({ event: 'reset', freezeUsed: false });
    expect(r.streak).toMatchObject({ current: 1, longest: 4, lastActiveDay: '2026-10-29' });
  });

  it('two or more missed days reset and keep the freezes', () => {
    const r = applyActivity(
      s({ current: 8, longest: 8, lastActiveDay: '2026-10-26', freezes: 2 }),
      '2026-10-29',
      0,
    );
    expect(r).toMatchObject({ event: 'reset', freezeUsed: false });
    expect(r.streak).toMatchObject({ current: 1, longest: 8, freezes: 2 });
  });

  it('clock went back: count and lastActiveDay untouched, XP still counts toward a freeze', () => {
    const r = applyActivity(
      s({ current: 3, longest: 3, lastActiveDay: '2026-10-29', xpTowardFreeze: 95 }),
      '2026-10-28',
      10,
    );
    expect(r).toMatchObject({ event: 'clockBack', increased: false, freezesEarned: 1 });
    expect(r.streak).toMatchObject({
      current: 3,
      lastActiveDay: '2026-10-29',
      freezes: 1,
      xpTowardFreeze: 5,
    });
  });

  it('longest keeps the record', () => {
    const r = applyActivity(
      s({ current: 2, longest: 10, lastActiveDay: '2026-10-28' }),
      '2026-10-29',
      0,
    );
    expect(r.streak.longest).toBe(10);
  });

  it('works across month, year and leap day boundaries', () => {
    expect(
      applyActivity(s({ current: 1, lastActiveDay: '2026-10-31' }), '2026-11-01', 0).event,
    ).toBe('continued');
    expect(
      applyActivity(s({ current: 1, lastActiveDay: '2026-12-31' }), '2027-01-01', 0).event,
    ).toBe('continued');
    expect(
      applyActivity(s({ current: 1, lastActiveDay: '2028-02-28' }), '2028-02-29', 0).event,
    ).toBe('continued');
    expect(
      applyActivity(s({ current: 1, lastActiveDay: '2028-02-29' }), '2028-03-01', 0).event,
    ).toBe('continued');
    expect(
      applyActivity(s({ current: 1, lastActiveDay: '2028-02-28', freezes: 1 }), '2028-03-01', 0)
        .event,
    ).toBe('frozen');
  });
});

describe('applyActivity — earning freezes', () => {
  const today = '2026-10-29';
  it('carries the remainder (95 + 30 → 1 freeze, 25 left)', () => {
    const r = applyActivity(s({ xpTowardFreeze: 95 }), today, 30);
    expect(r.freezesEarned).toBe(1);
    expect(r.streak).toMatchObject({ freezes: 1, xpTowardFreeze: 25 });
  });

  it('can earn two at once (210 XP)', () => {
    const r = applyActivity(base, today, 210);
    expect(r.freezesEarned).toBe(2);
    expect(r.streak).toMatchObject({ freezes: 2, xpTowardFreeze: 0 });
  });

  it('caps at 2 with no hidden credit', () => {
    const r = applyActivity(s({ freezes: 1, xpTowardFreeze: 90 }), today, 150);
    expect(r.freezesEarned).toBe(1);
    expect(r.streak).toMatchObject({ freezes: MAX_FREEZES, xpTowardFreeze: 0 });
    const again = applyActivity(r.streak, today, 50);
    expect(again.streak).toMatchObject({ freezes: 2, xpTowardFreeze: 0 });
    expect(again.freezesEarned).toBe(0);
  });

  it('a freeze is spent before this lesson earns one back', () => {
    const r = applyActivity(
      s({ current: 3, lastActiveDay: '2026-10-27', freezes: 2, xpTowardFreeze: 0 }),
      today,
      100,
    );
    expect(r).toMatchObject({ freezeUsed: true, freezesEarned: 1 });
    expect(r.streak).toMatchObject({ freezes: 2, xpTowardFreeze: 0, current: 4 });
  });

  it('after spending one at the cap, credit restarts from zero', () => {
    const r = applyActivity(
      s({ current: 3, lastActiveDay: '2026-10-27', freezes: 2, xpTowardFreeze: 0 }),
      today,
      15,
    );
    expect(r.streak).toMatchObject({ freezes: 1, xpTowardFreeze: 15 });
  });

  it('0 XP changes nothing', () => {
    const r = applyActivity(s({ xpTowardFreeze: 40, freezes: 1 }), today, 0);
    expect(r.freezesEarned).toBe(0);
    expect(r.streak).toMatchObject({ freezes: 1, xpTowardFreeze: 40 });
  });
});

describe('displayStreak', () => {
  const today = '2026-10-29';
  it('never studied → 0', () => {
    expect(displayStreak(base, today)).toEqual({
      value: 0,
      doneToday: false,
      atRisk: false,
      willUseFreeze: false,
    });
  });
  it('studied today → done', () => {
    expect(displayStreak(s({ current: 5, lastActiveDay: today }), today)).toMatchObject({
      value: 5,
      doneToday: true,
      atRisk: false,
    });
  });
  it('clock went back → shows current, not done', () => {
    expect(displayStreak(s({ current: 5, lastActiveDay: '2026-10-30' }), today)).toMatchObject({
      value: 5,
      doneToday: false,
    });
  });
  it('yesterday → at risk', () => {
    expect(displayStreak(s({ current: 5, lastActiveDay: '2026-10-28' }), today)).toMatchObject({
      value: 5,
      atRisk: true,
      willUseFreeze: false,
    });
  });
  it('one missed day with freeze → will use freeze', () => {
    expect(
      displayStreak(s({ current: 5, lastActiveDay: '2026-10-27', freezes: 1 }), today),
    ).toMatchObject({ value: 5, atRisk: true, willUseFreeze: true });
  });
  it('one missed day without freeze → 0', () => {
    expect(displayStreak(s({ current: 5, lastActiveDay: '2026-10-27' }), today).value).toBe(0);
  });
  it('two missed days even with freezes → 0', () => {
    expect(
      displayStreak(s({ current: 5, lastActiveDay: '2026-10-26', freezes: 2 }), today).value,
    ).toBe(0);
  });
});
