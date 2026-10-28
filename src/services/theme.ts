import type { Settings } from '../data/models';

/** Mirrored in localStorage so index.html can apply the theme before React mounts (no flash). */
export const THEME_STORAGE_KEY = 'falae-theme';

export function resolveDark(theme: Settings['theme'], systemDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemDark);
}

export function rememberTheme(theme: Settings['theme']): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode); the theme still applies for this session.
  }
}

export function readRememberedTheme(): Settings['theme'] | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'system' || value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Applies the theme to <html> and keeps following the OS while on "system". Returns a cleanup. */
export function applyTheme(theme: Settings['theme']): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    const root = document.documentElement;
    const dark = resolveDark(theme, mq.matches);
    root.classList.toggle('dark', dark);
    // Prefer the live token; fall back when CSS is not loaded (tests, very early boot).
    const bg =
      getComputedStyle(root).getPropertyValue('--bg').trim() || (dark ? '#14152b' : '#fff8ef');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  };
  update();
  if (theme !== 'system') return () => {};
  mq.addEventListener('change', update);
  return () => mq.removeEventListener('change', update);
}
