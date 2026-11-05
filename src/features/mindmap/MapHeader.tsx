import { useEffect } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/routes';
import type { MindMap } from '../../content/schemas/mindmap';
import { t } from '../../i18n/pt-BR';
import { ArrowRightIcon } from '../../ui/icons';
import { Marker } from '../../ui/notebook/Marker';
import { NotebookIcon } from '../../ui/notebook/NotebookIcon';
import { MapScene } from './MapScene';

/** Map title block (icon, marker title, level, intro, doodle) and the center node. */
export function MapHeader({ map }: { map: MindMap }) {
  useEffect(() => {
    const previous = document.title;
    document.title = map.title;
    return () => {
      document.title = previous;
    };
  }, [map.title]);
  return (
    <header className="space-y-4">
      <Link
        to={paths.maps}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-bold text-secondary-shade underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus dark:text-secondary"
      >
        <ArrowRightIcon className="rotate-180" />
        {t.maps.backToMaps}
      </Link>
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-secondary-shade dark:text-secondary">
          <NotebookIcon name={map.icon} size={28} />
        </span>
        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-3xl font-semibold">
            <Marker>{map.title}</Marker>
          </h1>
          <p>
            <span className="inline-flex min-h-6 items-center rounded-full border-2 border-line-strong px-2.5 text-sm font-bold">
              {t.maps.viewer.level(map.level)}
            </span>
          </p>
        </div>
      </div>
      {map.intro && <p className="text-ink-muted">{map.intro}</p>}
      {map.doodle && <p className="font-hand">{map.doodle}</p>}
      <div className="flex items-end gap-3">
        <p className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-3xl bg-ink px-5 py-3 text-bg">
          <span lang="en" className="font-display text-3xl font-bold">
            {map.center.en}
          </span>
          <span>{map.center.pt}</span>
        </p>
        <MapScene name={map.centerArt} size="center" />
      </div>
    </header>
  );
}
