/** Achievements (docs/ARQUITETURA.md §8). Titles live in i18n (t.achievements[id]). */
import type { SessionKind } from './xp';

export type AchievementStats = {
  totalXp: number;
  streakLongest: number;
  /** Distinct lessons completed (lessonProgress). */
  lessonsCompleted: number;
  /** Unit reviews completed. */
  unitsCompleted: number;
  /** Days with daily.goalMet. */
  goalDaysMet: number;
  /** Cards with reps ≥ 1 and intervalDays ≥ 3 (0 until Phase 6). */
  wordsLearned: number;
  last: { perfect: boolean; localHour: number; kind: SessionKind };
};

export type AchievementDef = {
  /** Stable persisted key: never rename. */
  id: string;
  icon: string;
  check: (s: AchievementStats) => boolean;
};

export const achievements = [
  { id: 'first-lesson', icon: '🎉', check: (s) => s.lessonsCompleted >= 1 },
  { id: 'perfect-lesson', icon: '💎', check: (s) => s.last.perfect && s.last.kind !== 'placement' },
  { id: 'streak-3', icon: '🔥', check: (s) => s.streakLongest >= 3 },
  { id: 'streak-7', icon: '📅', check: (s) => s.streakLongest >= 7 },
  { id: 'streak-30', icon: '🏆', check: (s) => s.streakLongest >= 30 },
  { id: 'words-50', icon: '📗', check: (s) => s.wordsLearned >= 50 },
  { id: 'words-100', icon: '📘', check: (s) => s.wordsLearned >= 100 },
  { id: 'words-250', icon: '📚', check: (s) => s.wordsLearned >= 250 },
  { id: 'first-unit', icon: '🗺️', check: (s) => s.unitsCompleted >= 1 },
  { id: 'goal-7', icon: '🎯', check: (s) => s.goalDaysMet >= 7 },
  { id: 'xp-500', icon: '⭐', check: (s) => s.totalXp >= 500 },
  { id: 'xp-1000', icon: '🌟', check: (s) => s.totalXp >= 1000 },
  { id: 'early-bird', icon: '🌅', check: (s) => s.last.localHour < 8 },
] as const satisfies readonly AchievementDef[];

export type AchievementId = (typeof achievements)[number]['id'];

export function newlyUnlocked(
  stats: AchievementStats,
  already: ReadonlySet<string>,
): AchievementId[] {
  return achievements.filter((a) => !already.has(a.id) && a.check(stats)).map((a) => a.id);
}

export function findAchievement(id: string): AchievementDef | undefined {
  return achievements.find((a) => a.id === id);
}
