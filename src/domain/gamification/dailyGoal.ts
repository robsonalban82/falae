/** Daily XP goal (docs/ARQUITETURA.md §8). */
import type { DayKey } from '../time';

export type GoalProgress = { xp: number; goal: number; ratio: number; met: boolean };

export function goalProgress(xpToday: number, goal: number): GoalProgress {
  const xp = Math.max(0, xpToday);
  const ratio = goal > 0 ? Math.min(1, xp / goal) : 1;
  return { xp, goal, ratio, met: xp >= goal };
}

/**
 * Celebrate once per day when the goal is reached (no "xpBefore < goal" requirement:
 * if the goal was lowered below today's XP, the next session celebrates once).
 * Clock went back (today before the last activity or the last celebration): never celebrate.
 */
export function shouldCelebrateGoal(
  xpAfter: number,
  goal: number,
  lastGoalCelebratedDay: DayKey | undefined,
  today: DayKey,
  lastActiveDay?: DayKey,
): boolean {
  if (lastGoalCelebratedDay !== undefined && lastGoalCelebratedDay > today) return false;
  if (lastActiveDay !== undefined && lastActiveDay > today) return false;
  return xpAfter >= goal && lastGoalCelebratedDay !== today;
}
