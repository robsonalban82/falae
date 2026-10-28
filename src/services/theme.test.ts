import { applyTheme, rememberTheme, resolveDark, THEME_STORAGE_KEY } from './theme';

type Listener = () => void;

/** Minimal controllable matchMedia for (prefers-color-scheme: dark). */
function mockSystem(initialDark: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: initialDark,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  window.matchMedia = vi.fn().mockReturnValue(mq) as unknown as typeof window.matchMedia;
  return {
    set(dark: boolean) {
      mq.matches = dark;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

const isDark = () => document.documentElement.classList.contains('dark');
const themeColor = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

beforeEach(() => {
  document.documentElement.className = '';
  document.head.innerHTML = '<meta name="theme-color" content="#FF8A1F" />';
});

describe('resolveDark', () => {
  it.each([
    ['dark', false, true],
    ['dark', true, true],
    ['light', true, false],
    ['light', false, false],
    ['system', true, true],
    ['system', false, false],
  ] as const)('%s with system dark=%s -> %s', (theme, sys, expected) => {
    expect(resolveDark(theme, sys)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('"system" follows the OS live and updates the theme-color meta', () => {
    const os = mockSystem(false);
    const cleanup = applyTheme('system');
    expect(isDark()).toBe(false);
    expect(themeColor()?.toLowerCase()).toBe('#fff8ef');
    os.set(true);
    expect(isDark()).toBe(true);
    expect(themeColor()?.toLowerCase()).toBe('#14152b');
    os.set(false);
    expect(isDark()).toBe(false);
    cleanup();
    expect(os.listenerCount()).toBe(0);
  });

  it('explicit themes ignore OS changes and register no listener', () => {
    const os = mockSystem(true);
    applyTheme('light');
    expect(isDark()).toBe(false);
    os.set(false);
    os.set(true);
    expect(isDark()).toBe(false);
    expect(os.listenerCount()).toBe(0);

    applyTheme('dark');
    os.set(false);
    expect(isDark()).toBe(true);
  });

  it('switching from system to light stops following the OS after cleanup', () => {
    const os = mockSystem(false);
    const cleanup = applyTheme('system');
    cleanup();
    applyTheme('light');
    os.set(true);
    expect(isDark()).toBe(false);
  });

  it('does not crash when the theme-color meta is missing', () => {
    document.head.innerHTML = '';
    mockSystem(true);
    expect(() => applyTheme('system')).not.toThrow();
    expect(isDark()).toBe(true);
  });
});

describe('rememberTheme', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mirrors the theme in localStorage for the pre-paint script in index.html', () => {
    rememberTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    rememberTheme('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => rememberTheme('dark')).not.toThrow();
  });
});
