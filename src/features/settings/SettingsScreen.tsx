import { dailyGoalOptions, type Settings } from '../../data/models';
import { t } from '../../i18n/pt-BR';
import { vibrationSupported } from '../../services/haptics';
import { playSound } from '../../services/sound';
import { useSettings } from '../../stores/useSettings';
import { RadioPills } from '../../ui/RadioPills';
import { Switch } from '../../ui/Switch';
import { BackupSection } from './BackupSection';
import { ReminderSection } from './ReminderSection';
import { ResetSection } from './ResetSection';
import { sectionClass } from './styles';

const themes: Settings['theme'][] = ['system', 'light', 'dark'];

/** Route /config — preferences, reminder, backup and reset. */
export function SettingsScreen() {
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);
  const update = useSettings((s) => s.update);

  if (!loaded) {
    return (
      <div aria-busy="true" aria-label={t.settings.loading} className="animate-pulse space-y-4">
        <div className="h-9 w-40 rounded-card bg-surface-2" />
        <div className="h-64 rounded-card bg-surface-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t.settings.title}</h1>

      <section aria-labelledby="prefs-title" className={sectionClass}>
        <h2 id="prefs-title" className="text-xl font-semibold">
          {t.settings.preferences}
        </h2>
        <div className="divide-y-2 divide-line">
          <Switch
            id="setting-sound"
            label={t.settings.sound}
            hint={t.settings.soundHint}
            checked={settings.sound}
            onChange={(sound) => {
              void update({ sound });
              // A sample so the learner hears what was turned on.
              if (sound) playSound('correct', true);
            }}
          />
          {vibrationSupported() ? (
            <Switch
              id="setting-haptics"
              label={t.settings.haptics}
              hint={t.settings.hapticsHint}
              checked={settings.haptics}
              onChange={(haptics) => void update({ haptics })}
            />
          ) : (
            <p className="py-3 text-sm text-ink-muted">{t.settings.noVibration}</p>
          )}
        </div>
        <RadioPills
          name="daily-goal"
          legend={t.settings.goal}
          hint={t.settings.goalHint}
          options={dailyGoalOptions.map((xp) => ({ value: xp, label: t.settings.goalOption(xp) }))}
          value={settings.dailyGoalXp}
          onChange={(dailyGoalXp) => void update({ dailyGoalXp })}
        />
        <RadioPills
          name="theme"
          legend={t.settings.theme}
          options={themes.map((value) => ({ value, label: t.settings.themes[value] }))}
          value={settings.theme}
          onChange={(theme) => void update({ theme })}
        />
      </section>

      <ReminderSection />
      <BackupSection />
      <ResetSection />
    </div>
  );
}
