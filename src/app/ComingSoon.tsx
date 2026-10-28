import { Link } from 'react-router';
import { t } from '../i18n/pt-BR';
import { Tuca } from '../ui/Mascot/Tuca';
import { paths } from './routes';

export function ComingSoon() {
  return (
    <section className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <Tuca mood="thinking" size={120} decorative />
      <h1 className="text-3xl font-semibold">{t.comingSoon.title}</h1>
      <p className="text-ink-muted">{t.comingSoon.body}</p>
      <Link to={paths.path} className="font-bold text-secondary underline underline-offset-4">
        {t.comingSoon.back}
      </Link>
    </section>
  );
}
