import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { findAchievement } from '../../domain/gamification/achievements';
import type { LessonSummary } from '../../domain/lesson/engine';
import { t } from '../../i18n/pt-BR';
import type { CommitSummary } from '../../stores/useProfile';
import { Button } from '../../ui/Button';
import { formatDuration, formatDurationLong } from '../../ui/formatTime';
import { ArrowRightIcon, FlameIcon, FreezeIcon } from '../../ui/icons';
import { Tuca } from '../../ui/Mascot/Tuca';
import { GoalRing } from '../path/GoalRing';

type Props = {
  summary: LessonSummary;
  /** Set once the lesson is saved. */
  commit: CommitSummary | null;
  saving: boolean;
  saveError: boolean;
  onRetry: () => void;
  onContinue: () => void;
};

const COUNT_MS = 700;

/** Counts up to `target` (instantly with reduced motion). */
function useCountUp(target: number, reduce: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      setValue(Math.round(target * p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce]);
  return reduce ? target : value;
}

type AchievementKey = keyof typeof t.achievements.list;
const achievementText = (id: string) =>
  id in t.achievements.list ? t.achievements.list[id as AchievementKey] : null; // `in` narrows the key

const CONFETTI = ['bg-primary', 'bg-secondary', 'bg-success', 'bg-danger', 'bg-xp'] as const;

function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 24 }, (_, i) => (
        <motion.span
          key={i}
          className={`absolute top-0 h-3 w-2 rounded-sm ${CONFETTI[i % CONFETTI.length] ?? ''}`}
          style={{ left: `${(i * 37) % 100}%` }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '100dvh', rotate: 360 + i * 20, opacity: 0 }}
          transition={{ duration: 1.6 + (i % 5) * 0.2, delay: (i % 6) * 0.08, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export function LessonComplete({ summary, commit, saving, saveError, onRetry, onContinue }: Props) {
  const reduce = useReducedMotion() ?? false;
  const xpShown = useCountUp(summary.xp, reduce);
  const accuracy = Math.round(summary.accuracy * 100);
  const streak = commit?.streak ?? null;
  const goal = commit?.goal ?? null;
  const achievements = (commit?.newAchievements ?? []).flatMap((id) => {
    const def = findAchievement(id);
    const text = achievementText(id);
    return def && text ? [{ id, icon: def.icon, ...text }] : [];
  });

  const stats = [
    { label: t.lesson.complete.xp, value: `+${xpShown}`, tone: 'bg-xp text-on-xp' },
    {
      label: t.lesson.complete.accuracy,
      value: `${accuracy}%`,
      tone: 'bg-success-soft text-success',
    },
    {
      label: t.lesson.complete.time,
      value: formatDuration(summary.durationMs),
      spoken: t.lesson.complete.timeLabel(formatDurationLong(summary.durationMs)),
      tone: 'bg-surface-2 text-ink',
    },
  ];

  // One textual summary for screen readers (animated numbers are not read one by one).
  const spoken = commit
    ? [
        t.lesson.complete.summary(summary.xp, accuracy),
        streak && t.header.streak(streak.streak.current),
        streak?.freezeUsed && t.lesson.complete.freezeUsed,
        streak &&
          streak.freezesEarned > 0 &&
          t.lesson.complete.freezeEarnedCount(streak.freezesEarned),
        goal?.celebrate &&
          goal.progress &&
          t.lesson.complete.goalMetDetail(goal.progress.xp, goal.progress.goal),
        ...achievements.map((a) => `${t.achievements.heading}: ${a.title}`),
      ]
        .filter(Boolean)
        .join('. ')
    : '';

  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      {!reduce && commit && <Confetti />}
      <Tuca mood="celebrating" size={160} />
      <h1 className="text-4xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
        {t.lesson.complete.title}
      </h1>
      {summary.perfect && <p className="font-bold text-secondary">{t.lesson.complete.perfect}</p>}
      <dl className="grid w-full grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-card p-3 ${s.tone}`}>
            <dt className="text-sm font-bold">{s.label}</dt>
            <dd className="tabular font-display text-3xl font-semibold">
              {'spoken' in s ? (
                <>
                  <span aria-hidden="true">{s.value}</span>
                  <span className="sr-only">{s.spoken}</span>
                </>
              ) : (
                s.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      {commit && (
        <div className="w-full space-y-3 text-left">
          {streak && (
            <div className="rounded-card border-2 border-line bg-surface p-3">
              <p className="flex items-center gap-2">
                <FlameIcon size={28} className="text-primary-shade dark:text-primary" />
                <span className="font-display text-xl font-semibold">
                  {t.header.streak(streak.streak.current)}
                </span>
                {streak.increased && (
                  <motion.span
                    aria-hidden="true"
                    className="rounded-full bg-primary px-2.5 py-0.5 font-display text-base font-semibold text-on-primary"
                    initial={reduce ? false : { opacity: 0, y: 12, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    {t.lesson.complete.streakIncrease}
                  </motion.span>
                )}
              </p>
              {(streak.freezeUsed || streak.freezesEarned > 0) && (
                <div className="mt-2 flex flex-wrap gap-2 pl-9">
                  {streak.freezeUsed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm font-bold text-secondary">
                      <FreezeIcon size={16} /> {t.lesson.complete.freezeUsed}
                    </span>
                  )}
                  {streak.freezesEarned > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm font-bold text-secondary">
                      <FreezeIcon size={16} />{' '}
                      {t.lesson.complete.freezeEarnedCount(streak.freezesEarned)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {goal && (
            <div
              className={`flex items-center gap-3 rounded-card border-2 p-3 ${
                goal.celebrate
                  ? 'border-success bg-success-soft text-success'
                  : 'border-line bg-surface'
              }`}
            >
              <GoalRing progress={goal.progress} />
              <p className="flex-1 font-bold">
                {goal.celebrate
                  ? t.lesson.complete.goalMetDetail(goal.progress.xp, goal.progress.goal)
                  : t.header.goal(goal.progress.xp, goal.progress.goal)}
              </p>
            </div>
          )}

          {achievements.length > 0 && (
            <div className="rounded-card border-2 border-line bg-surface p-3">
              <h2 className="mb-2 text-xl font-semibold">{t.achievements.heading}</h2>
              <ul className="space-y-2">
                {achievements.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <span aria-hidden="true" className="text-3xl">
                      {a.icon}
                    </span>
                    <span>
                      <span className="block font-bold">{a.title}</span>
                      <span className="text-sm text-ink-muted">{a.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div aria-live="polite" className="min-h-6">
        {saving && <p className="text-ink-muted">{t.lesson.complete.saving}</p>}
        {saveError && <p className="font-bold text-danger">{t.lesson.complete.saveError}</p>}
        {spoken && <p className="sr-only">{spoken}</p>}
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
