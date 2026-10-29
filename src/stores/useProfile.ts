import { create } from 'zustand';
import { loadCourse } from '../content/loader';
import { repository } from '../data';
import { onDataReplaced } from '../data/events';
import type { AppliedCommit, CommitContext } from '../data/repository';
import {
  defaultProfile,
  type DailyGoal,
  type LessonResult,
  type Profile,
  type UnlockedAchievement,
} from '../data/models';
import { newlyUnlocked, type AchievementStats } from '../domain/gamification/achievements';
import {
  goalProgress,
  shouldCelebrateGoal,
  type GoalProgress,
} from '../domain/gamification/dailyGoal';
import { loseHeart, refillHearts } from '../domain/gamification/hearts';
import { applyActivity, type StreakChange } from '../domain/gamification/streak';
import type { LessonState, LessonSummary } from '../domain/lesson/engine';
import { clock } from '../services/clock';

/** What the finish screen needs to show. */
export type CommitSummary = {
  result: LessonResult;
  /** null for placement, or when the run had already been recorded. */
  streak: StreakChange | null;
  goal: { progress: GoalProgress; celebrate: boolean };
  newAchievements: string[];
};

type ProfileState = {
  profile: Profile;
  loaded: boolean;
  load: () => Promise<void>;
  /** Hearts with lazy refill applied (does not persist). */
  heartsNow: () => { hearts: number; nextHeartInMs: number | null };
  spendHeart: () => Promise<void>;
  commitLesson: (
    state: LessonState,
    summary: LessonSummary,
    dailyGoalXp: DailyGoal,
  ) => Promise<CommitSummary>;
};

/** Called after a successful commit (the progress store subscribes to refresh the path). */
const commitListeners = new Set<() => void>();
export function onLessonCommitted(listener: () => void): () => void {
  commitListeners.add(listener);
  return () => commitListeners.delete(listener);
}

/** Cards with reps ≥ 1 and interval ≥ 3 days count as learned words. */
const LEARNED_MIN_INTERVAL_DAYS = 3;

export const useProfile = create<ProfileState>((set, get) => ({
  profile: defaultProfile(clock.iso()),
  loaded: false,

  load: async () => {
    try {
      set({ profile: await repository.getProfile(), loaded: true });
    } catch (err) {
      console.error('[falae] Could not load profile', err);
      set({ loaded: true });
    }
  },

  heartsNow: () => {
    const { hearts, nextHeartInMs } = refillHearts(get().profile, clock.now());
    return { hearts, nextHeartInMs };
  },

  spendHeart: async () => {
    const profile = { ...get().profile, ...loseHeart(get().profile, clock.now()) };
    set({ profile });
    try {
      await repository.saveProfile(profile);
    } catch (err) {
      console.error('[falae] Could not save hearts', err);
    }
  },

  commitLesson: async (state, summary, dailyGoalXp) => {
    const now = clock.now();
    const today = clock.today();
    const current = get().profile;
    const isStudy = state.kind !== 'placement';
    const result: LessonResult = {
      // Deterministic id: re-committing the same lesson run (reload mid-save) is a no-op.
      id: `${state.lessonId}-${state.startedAt}`,
      lessonId: state.lessonId,
      kind: state.kind,
      day: today,
      finishedAt: new Date(now).toISOString(),
      xp: summary.xp,
      accuracy: summary.accuracy,
      durationMs: summary.durationMs,
      mistakes: summary.mistakes,
      perfect: summary.perfect,
      itemOutcomes: summary.itemOutcomes,
    };

    const { course } = loadCourse();
    const isReview = (id: string) => course.lessons.get(id)?.skill === null;
    const localHour = clock.localHour();

    type Meta = { streak: StreakChange | null; celebrate: boolean; xpAfter: number };
    // Pure rules, run by the repository inside the transaction on freshly read data.
    const apply = (ctx: CommitContext): AppliedCommit<Meta> => {
      const stored = ctx.profile;
      const xpAfter = (ctx.dailyBefore?.xp ?? 0) + result.xp;
      const lastActive = stored.streak.lastActiveDay;
      const clockBack = lastActive !== undefined && today < lastActive;
      const { hearts, heartsUpdatedAt } = refillHearts(stored, now);
      const streak = isStudy ? applyActivity(stored.streak, today, result.xp) : null;
      const celebrate =
        isStudy &&
        shouldCelebrateGoal(xpAfter, dailyGoalXp, stored.lastGoalCelebratedDay, today, lastActive);
      const profile: Profile = {
        ...stored,
        hearts,
        heartsUpdatedAt,
        totalXp: stored.totalXp + result.xp,
        streak: streak?.streak ?? stored.streak,
        ...(celebrate ? { lastGoalCelebratedDay: today } : {}),
      };
      const completedIds = new Set(ctx.lessonProgress.map((p) => p.lessonId));
      if (result.kind === 'lesson' || result.kind === 'review') completedIds.add(result.lessonId);
      const goalDays = new Set(ctx.goalMetDays);
      if (!clockBack && xpAfter >= dailyGoalXp) goalDays.add(today);
      const stats: AchievementStats = {
        totalXp: profile.totalXp,
        streakLongest: profile.streak.longest,
        lessonsCompleted: completedIds.size,
        unitsCompleted: [...completedIds].filter(isReview).length,
        goalDaysMet: goalDays.size,
        wordsLearned: ctx.srsCards.filter(
          (c) => c.reps >= 1 && c.intervalDays >= LEARNED_MIN_INTERVAL_DAYS,
        ).length,
        last: { perfect: result.perfect, localHour, kind: result.kind },
      };
      const newAchievements: UnlockedAchievement[] = newlyUnlocked(stats, ctx.unlockedIds).map(
        (id) => ({ id, unlockedAt: result.finishedAt }),
      );
      return { profile, newAchievements, meta: { streak, celebrate, xpAfter } };
    };

    // One atomic write.
    const saved = await repository.recordLessonResult<Meta>({
      result,
      profile: current,
      srsCards: [],
      newAchievements: [],
      dailyGoalXp,
      apply,
    });

    if (!saved.applied || !saved.meta) {
      // Already recorded (e.g. reload mid-save): trust the database, not a recomputed state.
      const stored = await repository.getProfile();
      const rows = await repository.getDailyStats(today, today);
      set({ profile: stored });
      commitListeners.forEach((l) => l());
      return {
        result,
        streak: null,
        goal: { progress: goalProgress(rows[0]?.xp ?? 0, dailyGoalXp), celebrate: false },
        newAchievements: [],
      };
    }

    const { streak, celebrate, xpAfter } = saved.meta;
    set({ profile: saved.profile });
    commitListeners.forEach((l) => l());
    return {
      result,
      streak,
      goal: { progress: goalProgress(xpAfter, dailyGoalXp), celebrate },
      newAchievements: saved.newAchievements.map((a) => a.id),
    };
  },
}));

// Import/reset replaced everything: reload.
onDataReplaced(() => void useProfile.getState().load());
