import { create } from 'zustand';
import { pathUnits } from '../content/loader';
import { repository } from '../data';
import type { LessonProgress } from '../data/models';
import { computePathState, type PathState } from '../domain/progression/pathState';
import { clock } from '../services/clock';
import { onDataReplaced } from '../data/events';
import { onLessonCommitted } from './useProfile';

type ProgressState = {
  loaded: boolean;
  progress: LessonProgress[];
  /** XP earned today (local day of the clock). */
  xpToday: number;
  /** Day key `xpToday` refers to. */
  day: string;
  /** Recomputed only when progress or placement change. */
  pathState: PathState;
  load: () => Promise<void>;
};

const emptyPath = (): PathState => computePathState({ units: pathUnits() }, []);

/** Lesson progress and the derived path. Reloads by itself after every committed lesson. */
export const useProgress = create<ProgressState>((set) => ({
  loaded: false,
  progress: [],
  xpToday: 0,
  day: '',
  pathState: emptyPath(),

  load: async () => {
    try {
      const today = clock.today();
      const [progress, profile, daily] = await Promise.all([
        repository.getLessonProgress(),
        repository.getProfile(),
        repository.getDailyStats(today, today),
      ]);
      set({
        loaded: true,
        progress,
        xpToday: daily[0]?.xp ?? 0,
        day: today,
        pathState: computePathState({ units: pathUnits() }, progress, profile.placement),
      });
    } catch (err) {
      console.error('[falae] Could not load progress', err);
      set({ loaded: true });
    }
  },
}));

onLessonCommitted(() => void useProgress.getState().load());
onDataReplaced(() => void useProgress.getState().load());

/** Back to the app (or a new day): today's XP may be stale. */
function refreshIfStale() {
  const state = useProgress.getState();
  if (state.loaded && (document.visibilityState === 'visible' || state.day !== clock.today())) {
    void state.load();
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('focus', refreshIfStale);
  document.addEventListener('visibilitychange', refreshIfStale);
  // Day change while the app stays open.
  window.setInterval(() => {
    const state = useProgress.getState();
    if (state.loaded && state.day !== clock.today()) void state.load();
  }, 60_000);
}
