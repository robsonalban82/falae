import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { refillHearts } from '../../domain/gamification/hearts';
import { useProfile } from '../../stores/useProfile';
import { formatWait } from '../../ui/formatTime';
import { Tuca } from '../../ui/Mascot/Tuca';
import { useNow } from '../../ui/useNow';
import { HeartsBadge } from './HeartsBadge';

const linkButton =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full px-7 py-3 font-display text-lg font-semibold';

/** Live countdown (re-read every 30 s from the clock). */
export function OutOfHearts() {
  const profile = useProfile((s) => s.profile);
  const now = useNow(30_000);
  const { hearts, nextHeartInMs } = refillHearts(profile, now);
  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Tuca mood="sad" size={170} />
      <h1 className="text-3xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
        {t.lesson.outOfHearts.title}
      </h1>
      <HeartsBadge hearts={hearts} />
      <p className="text-ink-muted">{t.lesson.outOfHearts.body}</p>
      {nextHeartInMs !== null && (
        <p className="flex items-center gap-2 font-bold text-ink">
          <span aria-hidden="true">⏱️</span>
          {t.lesson.outOfHearts.next(formatWait(nextHeartInMs))}
        </p>
      )}
      <Link
        to={`${paths.practiceSession}?from=outOfHearts`}
        className={`${linkButton} bg-primary text-on-primary`}
      >
        {t.lesson.outOfHearts.practice}
      </Link>
      <Link
        to={paths.path}
        className={`${linkButton} border-2 border-line-strong bg-surface text-ink`}
      >
        {t.lesson.outOfHearts.back}
      </Link>
    </section>
  );
}
