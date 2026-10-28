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
    };
  }
}

export function exposeClockForTesting(): void {
  if (!(import.meta.env.DEV || import.meta.env.VITE_E2E === '1')) return;
  window.__falae = {
    setNow: clock.setNow,
    advanceDays: (days) => clock.advance(days * 86_400_000),
    advanceHours: (hours) => clock.advance(hours * 3_600_000),
    reset: clock.reset,
  };
}
