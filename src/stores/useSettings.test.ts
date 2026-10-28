import { repository } from '../data';
import { defaultSettings } from '../data/models';
import { THEME_STORAGE_KEY } from '../services/theme';
import { useSettings } from './useSettings';

beforeEach(async () => {
  await repository.resetAll();
  localStorage.clear();
  useSettings.setState({ settings: defaultSettings(), loaded: false, revision: 0 });
});
afterEach(() => vi.restoreAllMocks());

describe('useSettings', () => {
  it('loads saved settings and mirrors the theme', async () => {
    await repository.saveSettings({ ...defaultSettings(), theme: 'dark' });
    await useSettings.getState().load();
    expect(useSettings.getState()).toMatchObject({ loaded: true, settings: { theme: 'dark' } });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('persists updates', async () => {
    await useSettings.getState().update({ theme: 'light', dailyGoalXp: 50 });
    expect(await repository.getSettings()).toMatchObject({ theme: 'light', dailyGoalXp: 50 });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('a slow initial load does not overwrite a newer choice', async () => {
    await repository.saveSettings({ ...defaultSettings(), theme: 'dark' });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = repository.getSettings.bind(repository);
    vi.spyOn(repository, 'getSettings').mockImplementation(async () => {
      await gate;
      return real();
    });
    const loading = useSettings.getState().load();
    await useSettings.getState().update({ theme: 'light' });
    release();
    await loading;
    expect(useSettings.getState().settings.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('rolls back state and mirror when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(repository, 'saveSettings').mockRejectedValue(new Error('disk full'));
    await useSettings.getState().update({ theme: 'dark' });
    expect(useSettings.getState().settings.theme).toBe('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('rejects invalid patches without corrupting the stored row', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await useSettings.getState().update({ dailyGoalXp: 25 as never });
    expect(useSettings.getState().settings.dailyGoalXp).toBe(20);
    expect((await repository.getSettings()).dailyGoalXp).toBe(20);
  });

  it('load() falls back to defaults with loaded:true when the repository fails (fixed)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(repository, 'getSettings').mockRejectedValue(new Error('IndexedDB disabled'));
    await expect(useSettings.getState().load()).resolves.toBeUndefined();
    expect(useSettings.getState()).toMatchObject({ loaded: true, settings: defaultSettings() });
  });

  it('load() prefers the localStorage mirror when it differs and writes it back (reload race fix)', async () => {
    await repository.saveSettings({ ...defaultSettings(), theme: 'system' });
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    await useSettings.getState().load();
    expect(useSettings.getState().settings.theme).toBe('dark');
    await vi.waitFor(async () => expect((await repository.getSettings()).theme).toBe('dark'));
  });

  it('load() ignores a garbage mirror value', async () => {
    await repository.saveSettings({ ...defaultSettings(), theme: 'light' });
    localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    await useSettings.getState().load();
    expect(useSettings.getState().settings.theme).toBe('light');
    expect((await repository.getSettings()).theme).toBe('light');
  });
});
