import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import {
  currentPermission,
  requestPermission,
  type ReminderPermission,
} from '../../services/notifications';
import { useSettings } from '../../stores/useSettings';
import { Switch } from '../../ui/Switch';
import { sectionClass } from './styles';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
// 5-minute steps: fine enough for a study reminder, short enough to scan on a phone.
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const selectClass =
  'min-h-11 rounded-xl border-2 border-line-strong bg-surface px-2 font-bold text-ink tabular disabled:cursor-not-allowed disabled:border-dashed disabled:bg-surface-2 disabled:text-ink-muted';

/** Daily reminder: permission is requested only here, when the switch is turned on. */
export function ReminderSection() {
  const reminder = useSettings((s) => s.settings.reminder);
  const update = useSettings((s) => s.update);
  const [permission, setPermission] = useState<ReminderPermission>(() => currentPermission());
  const [asking, setAsking] = useState(false);

  const supported = permission !== 'unsupported';
  const denied = permission === 'denied';
  const enabled = reminder.enabled && permission === 'granted';

  const [hour = '19', minute = '00'] = reminder.time.split(':');
  // Keep an off-grid saved minute (e.g. set with the old time field) selectable.
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();
  const setTime = (h: string, m: string) => {
    const time = `${h}:${m}`;
    if (TIME_RE.test(time)) void update({ reminder: { ...reminder, time } });
  };

  const toggle = async (on: boolean) => {
    if (!on) {
      void update({ reminder: { ...reminder, enabled: false } });
      return;
    }
    setAsking(true);
    const answer = await requestPermission();
    setAsking(false);
    setPermission(answer);
    void update({ reminder: { ...reminder, enabled: answer === 'granted' } });
  };

  return (
    <section aria-labelledby="reminder-title" className={sectionClass}>
      <h2 id="reminder-title" className="text-xl font-semibold">
        {t.settings.reminder}
      </h2>
      {supported ? (
        <Switch
          id="setting-reminder"
          label={t.settings.reminderSwitch}
          checked={enabled}
          disabled={denied || asking}
          onChange={(on) => void toggle(on)}
        />
      ) : (
        <p className="font-bold text-ink">{t.settings.reminderUnsupported}</p>
      )}
      {denied ? (
        // Blocked by the browser: nothing to edit here, so show the saved time as plain text.
        <p className="flex items-center justify-between gap-4 text-ink-muted">
          <span className="font-bold">{t.settings.reminderTime}</span>
          <span className="tabular font-bold">{reminder.time}</span>
        </p>
      ) : (
        <fieldset className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* A legend can't join a flex row: sr-only legend plus a visual twin. */}
          <legend className="sr-only">{t.settings.reminderTime}</legend>
          <span
            aria-hidden="true"
            className={`font-bold ${enabled ? 'text-ink' : 'text-ink-muted'}`}
          >
            {t.settings.reminderTime}
          </span>
          {/* Two selects instead of type=time: the native field follows the OS locale (AM/PM). */}
          <div className="flex items-center gap-1">
            <label htmlFor="setting-reminder-hour" className="sr-only">
              {t.settings.reminderHour}
            </label>
            <select
              id="setting-reminder-hour"
              value={hour}
              disabled={!enabled}
              onChange={(e) => setTime(e.target.value, minute)}
              className={selectClass}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="font-bold">
              :
            </span>
            <label htmlFor="setting-reminder-minute" className="sr-only">
              {t.settings.reminderMinute}
            </label>
            <select
              id="setting-reminder-minute"
              value={minute}
              disabled={!enabled}
              onChange={(e) => setTime(hour, e.target.value)}
              className={selectClass}
            >
              {minutes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      )}
      {supported && (
        <p role="status" className="min-h-6 font-bold text-ink">
          {denied ? t.settings.reminderDenied : enabled ? t.settings.reminderOn(reminder.time) : ''}
        </p>
      )}
      <p className="text-sm text-ink-muted">{t.settings.reminderLimits}</p>
    </section>
  );
}
