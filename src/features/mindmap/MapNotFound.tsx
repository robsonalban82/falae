import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { Tuca } from '../../ui/Mascot/Tuca';

/** Unknown map (or collection) id: say so and go back to the list (no loader call). */
export function MapNotFound({
  title = t.maps.viewer.notFoundTitle,
  body = t.maps.viewer.notFoundBody,
}: {
  title?: string;
  body?: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  return (
    <section className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <Tuca mood="thinking" size={120} decorative />
      <h1 ref={titleRef} className="text-2xl font-semibold" tabIndex={-1}>
        {title}
      </h1>
      <p className="text-ink-muted">{body}</p>
      <Link
        to={paths.maps}
        className="inline-flex min-h-11 items-center rounded-lg font-bold text-secondary-shade underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus dark:text-secondary"
      >
        {t.maps.backToMaps}
      </Link>
    </section>
  );
}
