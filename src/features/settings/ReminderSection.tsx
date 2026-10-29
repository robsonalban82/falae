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

/** Daily reminder: permission is requested only here, when the switch is turned on. */
export function ReminderSection() {
  const reminder = useSettings((s) => s.settings.reminder);
  const update = useSettings((s) => s.update);
  const [permission, setPermission] = useState<ReminderPermission>(() => currentPermission());
  const [asking, setAsking] = useState(false);

  const supported = permission !== 'unsupported';
  const denied = permission === 'denied';
  const enabled = reminder.enabled && permission === 'granted';

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
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="setting-reminder-time"
          className={`font-bold ${enabled ? 'text-ink' : 'text-ink-muted'}`}
        >
          {t.settings.reminderTime}
        </label>
        {/* lang pt-BR: the browser shows a 24-hour clock (HH:MM). */}
        <input
          id="setting-reminder-time"
          type="time"
          lang="pt-BR"
          step={60}
          value={reminder.time}
          disabled={!enabled}
          onChange={(e) => {
            const time = e.target.value;
            if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
              void update({ reminder: { ...reminder, time } });
          }}
          className="min-h-11 rounded-xl border-2 border-line-strong bg-surface px-3 font-bold text-ink tabular disabled:cursor-not-allowed disabled:border-dashed disabled:bg-surface-2 disabled:text-ink-muted"
        />
      </div>
      {supported && (
        <p role="status" className="min-h-6 font-bold text-ink">
          {denied ? t.settings.reminderDenied : enabled ? t.settings.reminderOn(reminder.time) : ''}
        </p>
      )}
      <p className="text-sm text-ink-muted">{t.settings.reminderLimits}</p>
    </section>
  );
}
