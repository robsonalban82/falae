import { create } from 'zustand';
import { repository } from '../data';
import { defaultProfile, type DailyGoal, type LessonResult, type Profile } from '../data/models';
import { loseHeart, refillHearts } from '../domain/gamification/hearts';
import type { LessonState, LessonSummary } from '../domain/lesson/engine';
import { clock } from '../services/clock';

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
  ) => Promise<LessonResult>;
};

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
    const current = get().profile;
    const result: LessonResult = {
      // Deterministic id: re-committing the same lesson run (reload mid-save) is a no-op.
      id: `${state.lessonId}-${state.startedAt}`,
      lessonId: state.lessonId,
      kind: state.kind,
      day: clock.today(),
      finishedAt: new Date(now).toISOString(),
      xp: summary.xp,
      accuracy: summary.accuracy,
      durationMs: summary.durationMs,
      mistakes: summary.mistakes,
      perfect: summary.perfect,
      itemOutcomes: summary.itemOutcomes,
    };
    const { hearts, heartsUpdatedAt } = refillHearts(current, now);
    const profile: Profile = {
      ...current,
      hearts,
      heartsUpdatedAt,
      totalXp: current.totalXp + summary.xp,
    };
    // Streak (Phase 5) and SRS cards (Phase 6) plug in here.
    await repository.recordLessonResult({
      result,
      profile,
      srsCards: [],
      newAchievements: [],
      dailyGoalXp,
    });
    set({ profile });
    return result;
  },
}));
