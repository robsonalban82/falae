import { Link } from 'react-router';
import { paths } from '../../app/routes';
import type { ManifestMap } from '../../content/buildManifest';
import { t } from '../../i18n/pt-BR';
import { BulbIcon, CheckIcon } from '../../ui/icons';
import { Marker } from '../../ui/notebook/Marker';
import { NotebookIcon } from '../../ui/notebook/NotebookIcon';
import { PaperSheet } from '../../ui/notebook/PaperSheet';

type Props = { map: ManifestMap; unitTitle?: string; studied: boolean };

const chip =
  'inline-flex min-h-6 items-center rounded-full border-2 border-line-strong px-2.5 text-sm font-bold text-ink';

/** One row of the map list. "Studied" is icon + text, never color alone. */
export function MapListItem({ map, unitTitle, studied }: Props) {
  return (
    <PaperSheet as="li" className="relative">
      <Link
        to={paths.map(map.id)}
        className="flex min-h-16 items-start gap-3 rounded-card p-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-secondary-shade dark:text-secondary">
          <NotebookIcon name={map.icon} size={26} />
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span
            className={`block font-display text-xl font-semibold text-ink ${map.hasQuiz ? 'pr-32' : ''}`}
          >
            <Marker>{map.title}</Marker>
          </span>
          {unitTitle && (
            <span className="block text-sm text-ink-muted">{t.maps.unit(unitTitle)}</span>
          )}
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={chip}>{map.level}</span>
            <span className={chip}>{t.maps.kinds[map.kind]}</span>
            <span className={chip}>{t.maps.cards(map.nodeCount)}</span>
            {studied && (
              <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-success-soft px-2.5 text-sm font-bold text-success-shade dark:text-success">
                <CheckIcon size={16} />
                {t.maps.studied}
              </span>
            )}
          </span>
        </span>
        {map.hasQuiz && (
          <span className="pointer-events-none absolute top-3 right-4 inline-flex items-center gap-1 text-sm text-ink-muted">
            <BulbIcon size={16} />
            {t.maps.quickTest}
          </span>
        )}
      </Link>
    </PaperSheet>
  );
}
