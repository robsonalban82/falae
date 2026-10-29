/** Weekly chart data for the profile (pure). */
import { addDays, weekday, type DayKey } from '../time';

export type DayRow = { day: DayKey; xp: number; goalMet: boolean };
export type WeekDay = { day: DayKey; xp: number; goalMet: boolean; weekdayIndex: number };

/** Always 7 entries, from today − 6 to today; missing days have 0 XP; rows outside are ignored. */
export function lastSevenDays(rows: readonly DayRow[], today: DayKey, goal: number): WeekDay[] {
  void goal; // goalMet comes from the stored row (raising the goal never rewrites past days)
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const row = byDay.get(day);
    return {
      day,
      xp: row?.xp ?? 0,
      goalMet: row?.goalMet ?? false,
      weekdayIndex: weekday(day),
    };
  });
}

/** Chart scale: the biggest bar or the goal, whichever is higher (never 0). */
export function weekScale(days: readonly WeekDay[], goal: number): number {
  return Math.max(goal, ...days.map((d) => d.xp), 1);
}
