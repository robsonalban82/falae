import type { LessonSummary } from '../../domain/lesson/engine';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { ArrowRightIcon } from '../../ui/icons';
import { Tuca } from '../../ui/Mascot/Tuca';

type Props = {
  summary: LessonSummary;
  saving: boolean;
  saveError: boolean;
  onRetry: () => void;
  onContinue: () => void;
};

function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  return t.time.minutesSeconds(Math.floor(total / 60), total % 60);
}

export function LessonComplete({ summary, saving, saveError, onRetry, onContinue }: Props) {
  const stats = [
    { label: t.lesson.complete.xp, value: `+${summary.xp}`, tone: 'bg-xp text-on-xp' },
    {
      label: t.lesson.complete.accuracy,
      value: `${Math.round(summary.accuracy * 100)}%`,
      tone: 'bg-success-soft text-success',
    },
    {
      label: t.lesson.complete.time,
      value: formatDuration(summary.durationMs),
      tone: 'bg-surface-2 text-ink',
    },
  ];
  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <Tuca mood="celebrating" size={180} />
      <h1 className="text-4xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
        {t.lesson.complete.title}
      </h1>
      {summary.perfect && <p className="font-bold text-secondary">{t.lesson.complete.perfect}</p>}
      <dl className="grid w-full grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-card p-3 ${s.tone}`}>
            <dt className="text-sm font-bold">{s.label}</dt>
            <dd className="tabular font-display text-3xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div aria-live="polite" className="min-h-6">
        {saving && <p className="text-ink-muted">{t.lesson.complete.saving}</p>}
        {saveError && <p className="font-bold text-danger">{t.lesson.complete.saveError}</p>}
      </div>
      {saveError ? (
        <Button block onClick={onRetry}>
          {t.lesson.complete.retry}
        </Button>
      ) : (
        <Button block disabled={saving} onClick={onContinue} trailing={<ArrowRightIcon />}>
          {t.lesson.continue}
        </Button>
      )}
    </section>
  );
}
