import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { getCourseManifest } from '../../content/loader';
import {
  emptyFilters,
  filterMaps,
  filterOptions,
  parseMapFilters,
  toSearchParams,
  type MapFilters as Filters,
} from '../../domain/mindmap/filter';
import { t } from '../../i18n/pt-BR';
import { useMapProgress } from '../../stores/useMapProgress';
import { Tuca } from '../../ui/Mascot/Tuca';
import { CollectionShelf } from './CollectionShelf';
import { MapFilters } from './MapFilters';
import { MapListItem } from './MapListItem';

/** Route /mapas: collection shelf + map list from the manifest (no map JSON is loaded). */
export function MapsScreen() {
  const manifest = getCourseManifest();
  const [params, setParams] = useSearchParams();
  const failed = useMapProgress((s) => s.failed);
  const progress = useMapProgress((s) => s.progress);
  const load = useMapProgress((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(() => filterOptions(manifest.maps), [manifest]);
  const unitTitles = useMemo(() => new Map(manifest.units.map((u) => [u.id, u.title])), [manifest]);
  const studiedIds = useMemo(() => new Set(progress.map((p) => p.mapId)), [progress]);
  const filters = parseMapFilters(params, options);
  // Without readable progress the "studied" filter is ignored.
  const effective = failed ? { ...filters, studied: undefined } : filters;
  const visible = filterMaps(manifest.maps, effective, studiedIds);
  const studiedTotal = manifest.maps.filter((m) => studiedIds.has(m.id)).length;

  // Typing replaces the history entry; other changes are normal steps.
  const update = (next: Filters) =>
    setParams(toSearchParams(next), { replace: next.q !== filters.q });
  const clear = () => setParams(toSearchParams(emptyFilters()));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Tuca mood="happy" size={88} decorative />
        <div>
          <h1 className="text-3xl font-semibold">{t.maps.title}</h1>
          <p className="text-ink-muted">{t.maps.intro}</p>
        </div>
      </header>

      <CollectionShelf collections={manifest.collections} />

      <section aria-labelledby="maps-title" className="space-y-4">
        <h2 id="maps-title" className="text-xl font-semibold">
          {t.maps.listTitle}
        </h2>
        {manifest.maps.length === 0 ? (
          <p className="rounded-card border-2 border-line bg-surface p-4 text-ink-muted">
            {t.maps.empty}
          </p>
        ) : (
          <>
            {failed && (
              <p role="status" className="text-sm text-ink-muted">
                {t.maps.progressError}
              </p>
            )}
            <MapFilters
              filters={filters}
              options={options}
              unitTitles={unitTitles}
              hideStudied={failed}
              onChange={update}
              onClear={clear}
            />
            {!failed && (
              <p className="text-sm font-bold text-ink-muted">
                {t.maps.studiedCount(studiedTotal, manifest.maps.length)}
              </p>
            )}
            <p role="status" aria-live="polite" className="text-sm font-bold text-ink">
              {t.maps.resultCount(visible.length)}
            </p>
            {visible.length === 0 ? (
              <p className="rounded-card border-2 border-line bg-surface p-4 text-ink-muted">
                {t.maps.noResults}
              </p>
            ) : (
              <ul className="space-y-3">
                {visible.map((m) => (
                  <MapListItem
                    key={m.id}
                    map={m}
                    unitTitle={m.unitId ? unitTitles.get(m.unitId) : undefined}
                    studied={studiedIds.has(m.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
