import type { StreakDisplay } from '../../domain/gamification/streak';
import { t } from '../../i18n/pt-BR';
import { FlameIcon, FreezeIcon } from '../../ui/icons';

/** Streak flame + freezes. Grey flame when today's lesson is still pending. */
export function StreakBadge({ display, freezes }: { display: StreakDisplay; freezes: number }) {
  const hint = display.willUseFreeze
    ? t.header.willUseFreeze
    : display.atRisk
      ? t.header.streakAtRisk
      : display.doneToday
        ? t.header.streakDoneToday
        : undefined;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="img"
        aria-label={
          hint ? `${t.header.streak(display.value)}. ${hint}` : t.header.streak(display.value)
        }
        title={hint}
        className={`inline-flex items-center gap-1 font-display text-xl font-semibold ${
          display.doneToday ? 'text-primary-shade dark:text-primary' : 'text-ink-muted'
        }`}
      >
        <FlameIcon />
        <span className="tabular" aria-hidden="true">
          {display.value}
        </span>
      </span>
      {freezes > 0 && (
        <span
          role="img"
          aria-label={t.header.freezes(freezes)}
          className="inline-flex items-center gap-0.5 font-display text-base font-semibold text-secondary"
        >
          <FreezeIcon size={20} />
          <span className="tabular" aria-hidden="true">
            {freezes}
          </span>
        </span>
      )}
    </span>
  );
}
