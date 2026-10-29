import { dayKey, type DayKey } from '../domain/time';

/**
 * Single source of "now" for business rules. In dev/E2E builds the time can be
 * overridden through window.__falae so tests can simulate other days.
 */
let offsetMs = 0;
let fixedMs: number | null = null;

export const clock = {
  now(): number {
    return fixedMs ?? Date.now() + offsetMs;
  },
  today(): DayKey {
    return dayKey(clock.now());
  },
  /** Local hour 0–23 (for achievements such as early-bird). */
  localHour(): number {
    return new Date(clock.now()).getHours();
  },
  iso(): string {
    return new Date(clock.now()).toISOString();
  },
  /** Test-only controls. */
  setNow(value: string | number | null): void {
    if (value === null) {
      fixedMs = null;
      return;
    }
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) throw new Error(`clock.setNow: invalid date "${String(value)}"`);
    fixedMs = ms;
  },
  advance(ms: number): void {
    if (fixedMs !== null) fixedMs += ms;
    else offsetMs += ms;
  },
  reset(): void {
    fixedMs = null;
    offsetMs = 0;
  },
};

declare global {
  interface Window {
    __falae?: {
      setNow: (value: string | number | null) => void;
      advanceDays: (days: number) => void;
      advanceHours: (hours: number) => void;
      reset: () => void;
      /** Local day key of the (simulated) clock. */
      today: () => string;
      /** E2E only: replaces all data with a validated export file. */
      importForTest?: (file: unknown) => Promise<void>;
    };
  }
}

const CLOCK_STORAGE_KEY = 'falae-test-clock';

/** Simulated time must survive page.reload() in E2E: mirror it in sessionStorage. */
function persistTestClock(): void {
  try {
    sessionStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify({ fixedMs, offsetMs }));
  } catch {
    // ignore
  }
}

function restoreTestClock(): void {
  try {
    const raw = sessionStorage.getItem(CLOCK_STORAGE_KEY);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (saved && typeof saved === 'object' && 'fixedMs' in saved && 'offsetMs' in saved) {
      fixedMs = typeof saved.fixedMs === 'number' ? saved.fixedMs : null;
      offsetMs = typeof saved.offsetMs === 'number' ? saved.offsetMs : 0;
    }
  } catch {
    // ignore
  }
}

export function exposeClockForTesting(): void {
  if (!(import.meta.env.DEV || import.meta.env.VITE_E2E === '1')) return;
  restoreTestClock();
  const persisting =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      fn(...args);
      persistTestClock();
    };
  window.__falae = {
    ...window.__falae,
    setNow: persisting(clock.setNow),
    advanceDays: persisting((days: number) => clock.advance(days * 86_400_000)),
    advanceHours: persisting((hours: number) => clock.advance(hours * 3_600_000)),
    reset: persisting(clock.reset),
    today: clock.today,
  };
}
