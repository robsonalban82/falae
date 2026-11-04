import { create } from 'zustand';
import { repository } from '../data';
import { onDataReplaced } from '../data/events';
import type { MapProgress } from '../data/models';
import { onLessonCommitted } from './useProfile';

type MapProgressState = {
  loaded: boolean;
  /** True when the last read failed: screens show the list without "studied" badges. */
  failed: boolean;
  progress: MapProgress[];
  load: () => Promise<void>;
};

/** Only the most recent load may apply its result (a slow older read never overwrites a newer one). */
let latest = 0;

/** Which maps were studied. Imported only by the map routes; reloads after commits and restores. */
export const useMapProgress = create<MapProgressState>((set) => ({
  loaded: false,
  failed: false,
  progress: [],
  load: async () => {
    const seq = ++latest;
    try {
      const progress = await repository.getMapProgress();
      if (seq === latest) set({ loaded: true, failed: false, progress });
    } catch (err) {
      console.error('[falae] Could not load map progress', err);
      // Keep what was already loaded: a failed reload must not erase the badges.
      if (seq === latest) set({ loaded: true, failed: true });
    }
  },
}));

onLessonCommitted(() => void useMapProgress.getState().load());
onDataReplaced(() => void useMapProgress.getState().load());
