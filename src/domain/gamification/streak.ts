/** Streak with freezes (docs/ARQUITETURA.md §8). Only the local day key matters. */
import { diffDays, type DayKey } from '../time';

export const MAX_FREEZES = 2;
export const XP_PER_FREEZE = 100;

/** Same shape as Profile['streak'] (repeated here so domain does not import data/). */
export type Streak = {
  current: number;
  longest: number;
  lastActiveDay?: DayKey;
  freezes: number;
  xpTowardFreeze: number;
};

export type StreakEvent = 'first' | 'continued' | 'frozen' | 'reset' | 'sameDay' | 'clockBack';

export type StreakChange = {
  streak: Streak;
  event: StreakEvent;
  /** +1 today (drives the animation). True for first/continued/frozen/reset. */
  increased: boolean;
  freezeUsed: boolean;
  freezesEarned: number;
};

/** Call only for study sessions (lesson, review, practice), never for placement. */
export function applyActivity(streak: Streak, today: DayKey, xpGained: number): StreakChange {
  let { current, freezes } = streak;
  let lastActiveDay: DayKey | undefined = today;
  let event: StreakEvent;
  let freezeUsed = false;

  if (streak.lastActiveDay === undefined) {
    current = 1;
    event = 'first';
  } else {
    const gap = diffDays(streak.lastActiveDay, today);
    if (gap < 0) {
      event = 'clockBack';
      lastActiveDay = streak.lastActiveDay;
    } else if (gap === 0) event = 'sameDay';
    else if (gap === 1) {
      current += 1;
      event = 'continued';
    } else if (gap === 2 && freezes >= 1) {
      // The freeze is spent before this lesson's XP can earn a new one.
      freezes -= 1;
      current += 1;
      freezeUsed = true;
      event = 'frozen';
    } else {
      current = 1;
      event = 'reset';
    }
  }

  // Earn freezes. At the cap, no hidden credit accumulates.
  let xpTowardFreeze = freezes >= MAX_FREEZES ? 0 : streak.xpTowardFreeze;
  let freezesEarned = 0;
  if (xpGained > 0 && freezes < MAX_FREEZES) {
    xpTowardFreeze += xpGained;
    while (xpTowardFreeze >= XP_PER_FREEZE && freezes < MAX_FREEZES) {
      freezes += 1;
      freezesEarned += 1;
      xpTowardFreeze -= XP_PER_FREEZE;
    }
    if (freezes >= MAX_FREEZES) xpTowardFreeze = 0;
  }

  // A reset also shows +1: the path displayed 0 before (see displayStreak).
  const increased = event !== 'sameDay' && event !== 'clockBack';

  return {
    streak: {
      current,
      longest: Math.max(streak.longest, current),
      ...(lastActiveDay !== undefined ? { lastActiveDay } : {}),
      freezes,
      xpTowardFreeze,
    },
    event,
    increased,
    freezeUsed,
    freezesEarned,
  };
}

export type StreakDisplay = {
  value: number;
  doneToday: boolean;
  atRisk: boolean;
  willUseFreeze: boolean;
};

/** What the path shows without writing anything (consumption is lazy). */
export function displayStreak(streak: Streak, today: DayKey): StreakDisplay {
  const base = { doneToday: false, atRisk: false, willUseFreeze: false };
  if (streak.lastActiveDay === undefined) return { ...base, value: 0 };
  const gap = diffDays(streak.lastActiveDay, today);
  if (gap <= 0) return { ...base, value: streak.current, doneToday: gap === 0 };
  if (gap === 1) return { ...base, value: streak.current, atRisk: true };
  if (gap === 2 && streak.freezes >= 1)
    return { ...base, value: streak.current, atRisk: true, willUseFreeze: true };
  return { ...base, value: 0 };
}
