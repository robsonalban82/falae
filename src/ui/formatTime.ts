import { t } from '../i18n/pt-BR';

/** "1 h 23 min" (rounded up to the minute) for countdowns such as the next heart. */
export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return t.time.hoursMinutes(Math.floor(minutes / 60), minutes % 60);
}

/** "1:05" (m:ss) for lesson durations. */
export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Spoken form of a duration ("1 min 5 s"), for screen readers. */
export function formatDurationLong(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  return t.time.minutesSeconds(Math.floor(total / 60), total % 60);
}
