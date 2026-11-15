import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { PlayIcon } from '../../ui/icons';

/** Card on the Maps tab that opens the animated story. */
export function StoryEntry() {
  return (
    <section aria-labelledby="story-entry-title" className="space-y-3">
      <h2 id="story-entry-title" className="text-xl font-semibold">
        {t.story.entryHeading}
      </h2>
      <Link
        to={paths.story}
        className="flex min-h-11 items-center gap-3 rounded-card border-2 border-line-strong bg-surface p-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <PlayIcon />
        </span>
        <span>
          <span className="block font-display text-lg leading-tight font-semibold">
            {t.story.title}
          </span>
          <span className="text-sm text-ink-muted">{t.story.entryMeta}</span>
        </span>
      </Link>
    </section>
  );
}
