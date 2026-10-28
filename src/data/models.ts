import { z } from 'zod';
import { isValidDayKey } from '../domain/time';
import { MAX_HEARTS } from '../domain/gamification/hearts';
export { MAX_HEARTS };

/** Persisted data models. Zod schemas double as validation for import files. */

const dayKey = z.string().refine(isValidDayKey, 'Dia inválido (use AAAA-MM-DD).');
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.');

export const dailyGoalOptions = [10, 20, 30, 50] as const;

export const profileSchema = z.object({
  id: z.literal('me'),
  createdAt: isoDate,
  onboardingDone: z.boolean(),
  placement: z.object({ score: z.number().min(0).max(1), skippedUnit1: z.boolean() }).optional(),
  totalXp: z.number().int().nonnegative(),
  hearts: z.number().int().min(0).max(MAX_HEARTS),
  heartsUpdatedAt: isoDate,
  streak: z.object({
    current: z.number().int().nonnegative(),
    longest: z.number().int().nonnegative(),
    lastActiveDay: dayKey.optional(),
    freezes: z.number().int().min(0).max(2),
    xpTowardFreeze: z.number().int().nonnegative(),
  }),
  lastGoalCelebratedDay: dayKey.optional(),
});

export const settingsSchema = z.object({
  id: z.literal('me'),
  dailyGoalXp: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(50)]),
  sound: z.boolean(),
  haptics: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  reminder: z.object({ enabled: z.boolean(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  speakDisabledUntil: isoDate.optional(),
});

export const lessonProgressSchema = z.object({
  lessonId: z.string().min(1),
  completedCount: z.number().int().positive(),
  bestAccuracy: z.number().min(0).max(1),
  firstCompletedAt: isoDate,
});

export const lessonResultSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  kind: z.enum(['lesson', 'review', 'practice', 'placement']),
  day: dayKey,
  finishedAt: isoDate,
  xp: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
  durationMs: z.number().nonnegative(),
  mistakes: z.number().int().nonnegative(),
  perfect: z.boolean(),
  itemOutcomes: z.array(z.object({ itemId: z.string().min(1), q: z.number().int().min(0).max(5) })),
});

export const srsCardSchema = z.object({
  itemId: z.string().min(1),
  ease: z.number().min(1.3),
  intervalDays: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  dueDay: dayKey,
  lastReviewDay: dayKey,
});

export const dailyStatsSchema = z.object({
  day: dayKey,
  xp: z.number().int().nonnegative(),
  lessons: z.number().int().nonnegative(),
  goalMet: z.boolean(),
});

export const unlockedAchievementSchema = z.object({ id: z.string().min(1), unlockedAt: isoDate });

export const EXPORT_SCHEMA_VERSION = 1;

export const exportFileSchema = z.object({
  app: z.literal('falae'),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: isoDate,
  data: z.object({
    profile: profileSchema,
    settings: settingsSchema,
    lessonProgress: z.array(lessonProgressSchema),
    results: z.array(lessonResultSchema),
    srs: z.array(srsCardSchema),
    daily: z.array(dailyStatsSchema),
    achievements: z.array(unlockedAchievementSchema),
  }),
});

export type Profile = z.infer<typeof profileSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type DailyGoal = Settings['dailyGoalXp'];
export type LessonProgress = z.infer<typeof lessonProgressSchema>;
export type LessonResult = z.infer<typeof lessonResultSchema>;
export type SrsCard = z.infer<typeof srsCardSchema>;
export type DailyStats = z.infer<typeof dailyStatsSchema>;
export type UnlockedAchievement = z.infer<typeof unlockedAchievementSchema>;
export type ExportFile = z.infer<typeof exportFileSchema>;

export function defaultProfile(nowIso: string): Profile {
  return {
    id: 'me',
    createdAt: nowIso,
    onboardingDone: false,
    totalXp: 0,
    hearts: MAX_HEARTS,
    heartsUpdatedAt: nowIso,
    streak: { current: 0, longest: 0, freezes: 0, xpTowardFreeze: 0 },
  };
}

export function defaultSettings(): Settings {
  return {
    id: 'me',
    dailyGoalXp: 20,
    sound: true,
    haptics: true,
    theme: 'system',
    reminder: { enabled: false, time: '19:00' },
  };
}
