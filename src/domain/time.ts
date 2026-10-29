/** Day helpers. A "day key" is YYYY-MM-DD in the user's local time zone. */

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid day key: ${key}`);
  const date = new Date(y, m - 1, d);
  // Reject impossible dates such as 2026-02-30 (Date would roll them over).
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    throw new Error(`Invalid day key: ${key}`);
  }
  return date;
}

/** Adds calendar days (DST-safe because it works on local dates, not milliseconds). */
export function addDays(key: DayKey, days: number): DayKey {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date.getTime());
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  const da = parseDayKey(a);
  const db = parseDayKey(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  try {
    parseDayKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Day of the week of a day key: 0 = Sunday … 6 = Saturday. */
export function weekday(key: DayKey): number {
  return parseDayKey(key).getDay();
}
