import { Link } from 'react-router';
import { t } from '../i18n/pt-BR';
import { Button } from '../ui/Button';
import { Tuca } from '../ui/Mascot/Tuca';
import { paths } from './routes';

/** Root route error screen. Never shows the error or its stack. */
export function RouteError() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Tuca mood="sad" size={120} decorative />
      <h1 className="text-3xl font-semibold">{t.routeError.title}</h1>
      <p className="text-ink-muted">{t.routeError.body}</p>
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => window.location.reload()}>{t.routeError.reload}</Button>
        <Link to={paths.path} className="font-bold text-secondary underline underline-offset-4">
          {t.routeError.back}
        </Link>
      </div>
    </main>
  );
}
