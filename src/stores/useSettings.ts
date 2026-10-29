import { create } from 'zustand';
import { repository } from '../data';
import { onDataReplaced } from '../data/events';
import { defaultSettings, type Settings } from '../data/models';
import { readRememberedTheme, rememberTheme } from '../services/theme';

type SettingsState = {
  settings: Settings;
  loaded: boolean;
  /** Bumped on every update so a slow initial load cannot overwrite a newer choice. */
  revision: number;
  /** `fromStorage`: data was replaced (import/reset) — the stored row wins over the theme mirror. */
  load: (options?: { fromStorage?: boolean }) => Promise<void>;
  update: (patch: Partial<Omit<Settings, 'id'>>) => Promise<void>;
};

export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings(),
  loaded: false,
  revision: 0,
  load: async (options) => {
    const startedAt = get().revision;
    let settings: Settings;
    try {
      settings = await repository.getSettings();
    } catch (err) {
      // Storage unavailable (e.g. blocked IndexedDB): run with defaults for this session.
      console.error('[falae] Could not load settings', err);
      settings = defaultSettings();
    }
    if (get().revision !== startedAt) return;
    // The localStorage mirror is written synchronously on every change, so if a reload
    // beat the IndexedDB write, the mirror holds the newer choice.
    const remembered = readRememberedTheme();
    if (!options?.fromStorage && remembered && remembered !== settings.theme) {
      settings = { ...settings, theme: remembered };
      void repository.saveSettings(settings).catch(() => {});
    }
    rememberTheme(settings.theme);
    set({ settings, loaded: true });
  },
  update: async (patch) => {
    const previous = get().settings;
    const next = { ...previous, ...patch };
    set((s) => ({ settings: next, revision: s.revision + 1 }));
    rememberTheme(next.theme);
    try {
      await repository.saveSettings(next);
    } catch (err) {
      console.error('[falae] Could not save settings', err);
      set((s) => ({ settings: previous, revision: s.revision + 1 }));
      rememberTheme(previous.theme);
    }
  },
}));

onDataReplaced(() => void useSettings.getState().load({ fromStorage: true }));
