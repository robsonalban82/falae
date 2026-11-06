import { create } from 'zustand';
import { isReviewLesson } from '../content/loader';
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
import { gainHeart, loseHeart, MAX_HEARTS, refillHearts } from '../domain/gamification/hearts';
import { applyActivity, type StreakChange } from '../domain/gamification/streak';
import {
  finalSessionXp,
  sessionCountsAsStudy,
  sessionGainsHeart,
  sessionCompletesLesson,
  type SessionKind,
} from '../domain/gamification/xp';
import type { LessonContext, LessonState, LessonSummary } from '../domain/lesson/engine';
import { learnedAfter } from '../domain/srs/selection';
import { applyOutcomes, seedTestedOut } from '../domain/srs/sm2';
import { clock } from '../services/clock';

/** What the finish screen needs to show. */
export type CommitSummary = {
  result: LessonResult;
  /** null for placement, or when the run had already been recorded. */
  streak: StreakChange | null;
  goal: { progress: GoalProgress; celebrate: boolean };
  newAchievements: string[];
  /** Practice only: +1 heart was added (false when already full). */
  heartGained: boolean;
};

/** Placement outcome, decided by the placement screen. */
export type PlacementCommit = {
  score: number;
  passed: boolean;
  /** Unit 1 items seeded into the SRS when passed. */
  unitItemIds: string[];
};

/** A finished session of any kind (lesson, practice, map study, cards): what the commit needs. */
export type SessionCommit = {
  lessonId: string;
  kind: SessionKind;
  context?: LessonContext;
  /** Run start; with `lessonId` it makes the deterministic result id. */
  startedAt: number;
  summary: LessonSummary;
};

type ProfileState = {
  profile: Profile;
  loaded: boolean;
  load: () => Promise<void>;
  /** Hearts with lazy refill applied (does not persist). */
  heartsNow: () => { hearts: number; nextHeartInMs: number | null };
  /**
   * Spends one heart: optimistic UI plus a transactional write. Returns the hearts count expected
   * after the write (`target`) right away, so callers can record it before the write lands.
   */
  spendHeart: () => { target: number; saved: Promise<boolean> };
  /** Re-applies a heart spend whose write may have been lost (reload): lowers hearts to `target`. */
  reconcileHearts: (target: number) => Promise<void>;
  /** Marks the welcome flow as done (transactional read-modify-write). */
  completeOnboarding: () => Promise<void>;
  /** The single write path of a finished session (ADR-015, ADR-019 c). */
  commitSession: (
    session: SessionCommit,
    dailyGoalXp: DailyGoal,
    placement?: PlacementCommit,
  ) => Promise<CommitSummary>;
  /** Facade over `commitSession` for the lesson player. */
  commitLesson: (
    state: LessonState,
    summary: LessonSummary,
    dailyGoalXp: DailyGoal,
    placement?: PlacementCommit,
  ) => Promise<CommitSummary>;
};

/** Called after a successful commit (the progress store subscribes to refresh the path). */
const commitListeners = new Set<() => void>();
export function onLessonCommitted(listener: () => void): () => void {
  commitListeners.add(listener);
  return () => commitListeners.delete(listener);
}

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

  spendHeart: () => {
    const now = clock.now();
    // Optimistic UI, then a read-modify-write on the stored profile (another tab may have changed it).
    const optimistic = loseHeart(get().profile, now);
    set({ profile: { ...get().profile, ...optimistic } });
    const saved = repository
      .updateProfile((p) => ({ ...p, ...loseHeart(p, now) }))
      .then(
        (profile) => {
          set({ profile });
          return true;
        },
        (err: unknown) => {
          console.error('[falae] Could not save hearts', err);
          return false;
        },
      );
    return { target: optimistic.hearts, saved };
  },

  reconcileHearts: async (target) => {
    const now = clock.now();
    try {
      const profile = await repository.updateProfile((p) => {
        let next = { hearts: p.hearts, heartsUpdatedAt: p.heartsUpdatedAt };
        // Only lost writes are re-applied: a stored count already at (or below) the target is kept.
        // Bounded: at most MAX_HEARTS steps.
        for (let i = 0; i < MAX_HEARTS && refillHearts(next, now).hearts > Math.max(0, target); i++)
          next = loseHeart(next, now);
        return { ...p, ...next };
      });
      set({ profile });
    } catch (err) {
      console.error('[falae] Could not reconcile hearts', err);
    }
  },

  completeOnboarding: async () => {
    const profile = await repository.updateProfile((p) => ({ ...p, onboardingDone: true }));
    set({ profile, loaded: true });
  },

  commitLesson: (state, summary, dailyGoalXp, placement) =>
    get().commitSession(
      {
        lessonId: state.lessonId,
        kind: state.kind,
        ...(state.context ? { context: state.context } : {}),
        startedAt: state.startedAt,
        summary,
      },
      dailyGoalXp,
      placement,
    ),

  commitSession: async (session, dailyGoalXp, placement) => {
    const { summary } = session;
    const now = clock.now();
    const today = clock.today();
    const current = get().profile;
    const isStudy = sessionCountsAsStudy(session.kind);
    const result: LessonResult = {
      // Deterministic id: re-committing the same run (reload mid-save) is a no-op.
      id: `${session.lessonId}-${session.startedAt}`,
      lessonId: session.lessonId,
      kind: session.kind,
      ...(session.context ? { context: session.context } : {}),
      day: today,
      finishedAt: new Date(now).toISOString(),
      xp: summary.xp,
      accuracy: summary.accuracy,
      durationMs: summary.durationMs,
      mistakes: summary.mistakes,
      perfect: summary.perfect,
      itemOutcomes: summary.itemOutcomes,
    };

    const isReview = isReviewLesson;
    const localHour = clock.localHour();

    type Meta = {
      streak: StreakChange | null;
      celebrate: boolean;
      xpAfter: number;
      xp: number;
      heartGained: boolean;
    };
    // Pure rules, run by the repository inside the transaction on freshly read data.
    const apply = (ctx: CommitContext): AppliedCommit<Meta> => {
      const stored = ctx.profile;
      // Final XP is decided here, on fresh data (a map studied twice a day earns 0).
      const xp = finalSessionXp(result.kind, result.xp, ctx.mapProgress?.lastStudiedDay, today);
      const xpAfter = (ctx.dailyBefore?.xp ?? 0) + xp;
      const lastActive = stored.streak.lastActiveDay;
      const clockBack = lastActive !== undefined && today < lastActive;
      const refilled = refillHearts(stored, now);
      const heartsBefore = refilled.hearts;
      // Practice: refill first, then +1 (cap 5; a full bar keeps its timestamp).
      const hearts =
        sessionGainsHeart(result.kind) && heartsBefore < MAX_HEARTS
          ? gainHeart(refilled, now)
          : { hearts: refilled.hearts, heartsUpdatedAt: refilled.heartsUpdatedAt };
      const streak = isStudy ? applyActivity(stored.streak, today, xp) : null;
      const celebrate =
        isStudy &&
        shouldCelebrateGoal(xpAfter, dailyGoalXp, stored.lastGoalCelebratedDay, today, lastActive);
      const profile: Profile = {
        ...stored,
        hearts: hearts.hearts,
        heartsUpdatedAt: hearts.heartsUpdatedAt,
        totalXp: stored.totalXp + xp,
        streak: streak?.streak ?? stored.streak,
        ...(celebrate ? { lastGoalCelebratedDay: today } : {}),
        ...(placement
          ? {
              // Taken once: a placement already stored (another tab) is never overwritten.
              placement: stored.placement ?? {
                score: placement.score,
                skippedUnit1: placement.passed,
              },
              onboardingDone: true,
            }
          : {}),
      };
      const srsCards = placement
        ? placement.passed && stored.placement === undefined
          ? seedTestedOut(ctx.srsCards, placement.unitItemIds, today)
          : []
        : applyOutcomes(ctx.srsCards, result.itemOutcomes, today);
      const completedIds = new Set(ctx.completedLessonIds);
      if (sessionCompletesLesson(result.kind)) completedIds.add(result.lessonId);
      const metNow = ctx.goalMetToday || (isStudy && !clockBack && xpAfter >= dailyGoalXp);
      const stats: AchievementStats = {
        totalXp: profile.totalXp,
        streakLongest: profile.streak.longest,
        lessonsCompleted: completedIds.size,
        unitsCompleted: [...completedIds].filter(isReview).length,
        goalDaysMet: ctx.goalMetCount + (metNow ? 1 : 0),
        wordsLearned: learnedAfter(ctx.wordsLearnedBefore, ctx.srsCards, srsCards),
        last: { perfect: result.perfect, localHour, kind: result.kind, heartsBefore },
      };
      // Placement is an assessment, not study: it unlocks no achievement.
      const newAchievements: UnlockedAchievement[] = !isStudy
        ? []
        : newlyUnlocked(stats, ctx.unlockedIds).map((id) => ({
            id,
            unlockedAt: result.finishedAt,
          }));
      return {
        profile,
        newAchievements,
        srsCards,
        xp,
        meta: { streak, celebrate, xpAfter, xp, heartGained: hearts.hearts > heartsBefore },
      };
    };

    // One atomic write.
    const saved = await repository.recordLessonResult<Meta>({
      result,
      profile: current,
      srsCards: [],
      newAchievements: [],
      dailyGoalXp,
      ...(placement?.passed ? { extraItemIds: placement.unitItemIds } : {}),
      apply,
    });

    if (!saved.applied || !saved.meta) {
      // Already recorded (e.g. reload mid-save): trust the database, not a recomputed state.
      const stored = await repository.getProfile();
      const rows = await repository.getDailyStats(today, today);
      set({ profile: stored });
      commitListeners.forEach((l) => l());
      return {
        // Nothing new was earned by this duplicate call.
        result: { ...result, xp: 0 },
        streak: null,
        goal: { progress: goalProgress(rows[0]?.xp ?? 0, dailyGoalXp), celebrate: false },
        newAchievements: [],
        heartGained: false,
      };
    }

    const { streak, celebrate, xpAfter, xp, heartGained } = saved.meta;
    set({ profile: saved.profile });
    commitListeners.forEach((l) => l());
    return {
      result: { ...result, xp },
      streak,
      goal: { progress: goalProgress(xpAfter, dailyGoalXp), celebrate },
      newAchievements: saved.newAchievements.map((a) => a.id),
      heartGained,
    };
  },
}));

// Import/reset replaced everything: reload.
onDataReplaced(() => void useProfile.getState().load());
