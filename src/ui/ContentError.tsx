import { Link } from 'react-router';
import { paths } from '../app/routes';
import { t } from '../i18n/pt-BR';
import { Button } from './Button';
import { Tuca } from './Mascot/Tuca';

/** Unit content failed to load or is invalid: never a blank screen. */
export function ContentError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <Tuca mood="thinking" size={120} decorative />
      <div role="alert" className="space-y-3 sm:space-y-4">
        <h1 className="text-2xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
          {t.errors.contentTitle}
        </h1>
        <p className="text-ink-muted">{t.errors.contentBody}</p>
      </div>
      <Button onClick={onRetry}>{t.errors.contentRetry}</Button>
      <Link to={paths.path} className="font-bold text-secondary underline underline-offset-4">
        {t.errors.contentBack}
      </Link>
    </section>
  );
}
