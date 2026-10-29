import { create } from 'zustand';
import { repository } from '../data';
import { onDataReplaced } from '../data/events';
import type { DailyStats, UnlockedAchievement } from '../data/models';
import { wordsLearned } from '../domain/srs/selection';
import { addDays } from '../domain/time';
import { clock } from '../services/clock';
import { onLessonCommitted } from './useProfile';

type StatsState = {
  loaded: boolean;
  wordsLearned: number;
  /** Daily rows of the last 7 days (index range read, never the whole table). */
  week: DailyStats[];
  /** Day key `week` ends on. */
  today: string;
  achievements: UnlockedAchievement[];
  load: () => Promise<void>;
};

/** Profile numbers that are not in the profile row itself. */
export const useStats = create<StatsState>((set) => ({
  loaded: false,
  wordsLearned: 0,
  week: [],
  today: '',
  achievements: [],
  load: async () => {
    try {
      const today = clock.today();
      const [cards, week, achievements] = await Promise.all([
        repository.getSrsCards(),
        repository.getDailyStats(addDays(today, -6), today),
        repository.getAchievements(),
      ]);
      set({ loaded: true, wordsLearned: wordsLearned(cards), week, today, achievements });
    } catch (err) {
      console.error('[falae] Could not load stats', err);
      set({ loaded: true });
    }
  },
}));

onLessonCommitted(() => void useStats.getState().load());
onDataReplaced(() => void useStats.getState().load());
