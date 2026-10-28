import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { Tuca } from '../../ui/Mascot/Tuca';

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return t.time.hoursMinutes(Math.floor(minutes / 60), minutes % 60);
}

const linkButton =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full px-7 py-3 font-display text-lg font-semibold';

export function OutOfHearts({ nextHeartInMs }: { nextHeartInMs: number | null }) {
  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Tuca mood="sad" size={170} />
      <h1 className="text-3xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
        {t.lesson.outOfHearts.title}
      </h1>
      <p className="text-ink-muted">{t.lesson.outOfHearts.body}</p>
      {nextHeartInMs !== null && (
        <p className="flex items-center gap-2 font-bold text-ink">
          <span aria-hidden="true">⏱️</span>
          {t.lesson.outOfHearts.next(formatWait(nextHeartInMs))}
        </p>
      )}
      {/* "Praticar e ganhar coração" comes back with the Practice screen (Phase 6). */}
      <Link to={paths.path} className={`${linkButton} bg-primary text-on-primary`}>
        {t.lesson.outOfHearts.back}
      </Link>
    </section>
  );
}
