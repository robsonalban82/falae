import { useState, type ReactNode } from 'react';
import type { FilterOptions, MapFilters as Filters } from '../../domain/mindmap/filter';
import { FILTER_KINDS, FILTER_LEVELS, hasFilters } from '../../domain/mindmap/filter';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';

type Props = {
  filters: Filters;
  options: FilterOptions;
  unitTitles: ReadonlyMap<string, string>;
  /** Progress could not be read: the "studied" filter makes no sense. */
  hideStudied?: boolean;
  onChange: (next: Filters) => void;
  onClear: () => void;
};

const field =
  'min-h-12 w-full rounded-card border-2 border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

const studiedValue = (s: boolean | undefined) => (s === undefined ? '' : s ? 'sim' : 'nao');

/** Search and filters; state lives in the URL (the parent reads and writes it). */
export function MapFilters({
  filters,
  options,
  unitTitles,
  hideStudied = false,
  onChange,
  onClear,
}: Props) {
  const empty = (v: string) => (v === '' ? undefined : v);
  // The URL keeps the trimmed query; the field keeps what was typed (so spaces can be typed).
  const [text, setText] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    // The URL changed from outside (clear, back button): adopt it unless it is what we typed.
    setSeenQ(filters.q);
    if (text.trim() !== filters.q) setText(filters.q);
  }
  const selectCount = [
    filters.level,
    filters.unitId,
    filters.kind,
    hideStudied ? undefined : filters.studied,
  ].filter((v) => v !== undefined).length;
  // Open on its own when the URL already carries a filter; the user can still toggle it.
  const [open, setOpen] = useState(selectCount > 0);
  const [seenCount, setSeenCount] = useState(selectCount);
  if (seenCount !== selectCount) {
    setSeenCount(selectCount);
    if (selectCount > 0 && !open) setOpen(true);
  }
  return (
    <form
      role="search"
      aria-label={t.maps.filtersTitle}
      onSubmit={(e) => e.preventDefault()}
      className="space-y-3"
    >
      <Field id="map-search" label={t.maps.search}>
        <input
          id="map-search"
          type="search"
          value={text}
          placeholder={t.maps.searchPlaceholder}
          onChange={(e) => {
            setText(e.target.value);
            onChange({ ...filters, q: e.target.value });
          }}
          className={field}
        />
      </Field>
      <details
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
        className="group rounded-card border-2 border-line bg-surface px-3 py-1"
      >
        <summary className="flex min-h-12 cursor-pointer items-center justify-between font-bold text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
          {selectCount > 0 ? t.maps.filtersActive(selectCount) : t.maps.filtersTitle}
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {options.levels.length > 1 && (
            <Field id="map-level" label={t.maps.level}>
              <select
                id="map-level"
                value={filters.level ?? ''}
                onChange={(e) =>
                  onChange({ ...filters, level: FILTER_LEVELS.find((l) => l === e.target.value) })
                }
                className={field}
              >
                <option value="">{t.maps.all}</option>
                {options.levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {options.unitIds.length > 0 && (
            <Field id="map-unit" label={t.maps.unitFilter}>
              <select
                id="map-unit"
                value={filters.unitId ?? ''}
                onChange={(e) => onChange({ ...filters, unitId: empty(e.target.value) })}
                className={field}
              >
                <option value="">{t.maps.allUnits}</option>
                {options.unitIds.map((u) => (
                  <option key={u} value={u}>
                    {unitTitles.get(u) ?? u}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {options.kinds.length > 1 && (
            <Field id="map-kind" label={t.maps.kind}>
              <select
                id="map-kind"
                value={filters.kind ?? ''}
                onChange={(e) =>
                  onChange({ ...filters, kind: FILTER_KINDS.find((k) => k === e.target.value) })
                }
                className={field}
              >
                <option value="">{t.maps.all}</option>
                {options.kinds.map((k) => (
                  <option key={k} value={k}>
                    {t.maps.kinds[k]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!hideStudied && (
            <Field id="map-studied" label={t.maps.studiedFilter}>
              <select
                id="map-studied"
                value={studiedValue(filters.studied)}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    studied: e.target.value === '' ? undefined : e.target.value === 'sim',
                  })
                }
                className={field}
              >
                <option value="">{t.maps.all}</option>
                <option value="sim">{t.maps.studiedYes}</option>
                <option value="nao">{t.maps.studiedNo}</option>
              </select>
            </Field>
          )}
        </div>
      </details>
      {hasFilters(filters) && (
        <Button variant="ghost" onClick={onClear}>
          {t.maps.clear}
        </Button>
      )}
    </form>
  );
}
