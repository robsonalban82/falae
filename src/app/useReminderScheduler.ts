import { useEffect } from 'react';
import { repository } from '../data';
import { t } from '../i18n/pt-BR';
import { clock } from '../services/clock';
import {
  currentPermission,
  msUntilNext,
  readLastShownDay,
  shouldNotify,
  showReminder,
} from '../services/notifications';
import { useSettings } from '../stores/useSettings';

const RECHECK_MS = 5 * 60_000;

/**
 * Best-effort daily reminder while the app is open: a timer until the next reminder time,
 * re-armed when the time changes, when the app comes back to the foreground and periodically
 * (day change, simulated clock). Shows at most one reminder per day, only if nothing was studied.
 */
export function useReminderScheduler(): void {
  const loaded = useSettings((s) => s.loaded);
  const enabled = useSettings((s) => s.settings.reminder.enabled);
  const time = useSettings((s) => s.settings.reminder.time);

  useEffect(() => {
    if (!loaded || !enabled || currentPermission() !== 'granted') return;
    let timer: number | undefined;

    const check = async () => {
      const nowMs = clock.now();
      const today = clock.today();
      try {
        const rows = await repository.getDailyStats(today, today);
        const studiedToday = (rows[0]?.lessons ?? 0) > 0;
        if (shouldNotify({ time, nowMs, studiedToday, lastShownDay: readLastShownDay() })) {
          await showReminder(t.reminder, nowMs);
        }
      } catch (err) {
        console.error('[falae] Reminder check failed', err);
      }
    };
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          void check();
          arm();
        },
        Math.min(msUntilNext(time, clock.now()) + 1000, RECHECK_MS),
      );
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void check();
      arm();
    };

    void check();
    arm();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loaded, enabled, time]);
}
