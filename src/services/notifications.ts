/**
 * Daily reminder (best effort, docs/fases/FASE-6.md §6). Without Notification Triggers the
 * reminder only shows while the app (or its service worker) is alive. Times come from `clock`.
 */
import { dayKey } from '../domain/time';

/** Device-only state ("already notified today"): not part of the backup nor the data model. */
export const LAST_SHOWN_KEY = 'falae.reminder.lastShownDay';
export const REMINDER_TAG = 'falae-daily';

export type ReminderPermission = NotificationPermission | 'unsupported';

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function currentPermission(): ReminderPermission {
  return isSupported() ? Notification.permission : 'unsupported';
}

/** The ONLY place that asks for permission (called when the learner turns the reminder on). */
export async function requestPermission(): Promise<ReminderPermission> {
  if (!isSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Local timestamp of `time` (HH:MM) on the day of `nowMs`. */
export function reminderAt(time: string, nowMs: number): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const d = new Date(nowMs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Milliseconds until the next occurrence of `time` (today if still ahead, else tomorrow). */
export function msUntilNext(time: string, nowMs: number): number {
  const today = reminderAt(time, nowMs);
  if (today > nowMs) return today - nowMs;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // calendar day: DST-safe
  return tomorrow.getTime() - nowMs;
}

/** Past today's time, no study today and not shown today yet. */
export function shouldNotify(input: {
  time: string;
  nowMs: number;
  studiedToday: boolean;
  lastShownDay: string | null;
}): boolean {
  if (input.studiedToday) return false;
  if (input.lastShownDay === dayKey(input.nowMs)) return false;
  return input.nowMs >= reminderAt(input.time, input.nowMs);
}

export function readLastShownDay(): string | null {
  try {
    return localStorage.getItem(LAST_SHOWN_KEY);
  } catch {
    return null;
  }
}

export function clearLastShownDay(): void {
  try {
    localStorage.removeItem(LAST_SHOWN_KEY);
  } catch {
    // ignore
  }
}

/** Shows the reminder through the service worker (one at a time thanks to the tag). */
export async function showReminder(
  text: { title: string; body: string },
  nowMs: number,
): Promise<boolean> {
  if (!isSupported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(text.title, {
      body: text.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: REMINDER_TAG,
    });
    localStorage.setItem(LAST_SHOWN_KEY, dayKey(nowMs));
    return true;
  } catch (err) {
    console.error('[falae] Could not show the reminder', err);
    return false;
  }
}
