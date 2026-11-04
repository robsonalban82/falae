import { searchWords } from '../text/search';

/** Map list filters, kept in the URL (`nivel`, `unidade`, `tipo`, `estudado`, `q`). */
export type MapFilters = {
  level?: string;
  unitId?: string;
  kind?: string;
  studied?: boolean;
  q: string;
};

/** Structural view of a manifest map. */
export type MapListShape = {
  id: string;
  level: string;
  kind: string;
  unitId?: string;
  search: string;
};

// Closed sets mirrored from the content schema (a content test keeps them in sync).
export const FILTER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const FILTER_KINDS = ['gramatica', 'vocabulario', 'conversacao'] as const;

export const emptyFilters = (): MapFilters => ({ q: '' });

export const hasFilters = (f: MapFilters): boolean =>
  f.level !== undefined ||
  f.unitId !== undefined ||
  f.kind !== undefined ||
  f.studied !== undefined ||
  f.q.trim() !== '';

export type FilterOptions = {
  levels: string[];
  unitIds: string[];
  kinds: string[];
};

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  allowed.find((a) => a === value);

/**
 * Reads filters from the URL. Unknown values are ignored, never an error. When `options`
 * is given, level, unit and kind must also exist in the list.
 */
export function parseMapFilters(params: URLSearchParams, options?: FilterOptions): MapFilters {
  const filters: MapFilters = { q: (params.get('q') ?? '').trim() };
  const level = pick(params.get('nivel'), FILTER_LEVELS);
  const kind = pick(params.get('tipo'), FILTER_KINDS);
  const unitId = params.get('unidade')?.trim();
  const studied = params.get('estudado');
  if (level && (!options || options.levels.includes(level))) filters.level = level;
  if (kind && (!options || options.kinds.includes(kind))) filters.kind = kind;
  if (unitId && (!options || options.unitIds.includes(unitId))) filters.unitId = unitId;
  if (studied === 'sim') filters.studied = true;
  else if (studied === 'nao') filters.studied = false;
  return filters;
}

export function toSearchParams(filters: MapFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.level) params.set('nivel', filters.level);
  if (filters.unitId) params.set('unidade', filters.unitId);
  if (filters.kind) params.set('tipo', filters.kind);
  if (filters.studied !== undefined) params.set('estudado', filters.studied ? 'sim' : 'nao');
  const q = filters.q.trim();
  if (q) params.set('q', q);
  return params;
}

/** Each query word (normalized) must be a prefix of some word of the map's `search`. */
function matchesQuery(search: string, q: string): boolean {
  const queryWords = searchWords([q]).split(' ').filter(Boolean);
  if (queryWords.length === 0) return true;
  const mapWords = search.split(' ');
  return queryWords.every((w) => mapWords.some((m) => m.startsWith(w)));
}

/** Filters maps keeping the manifest order. */
export function filterMaps<T extends MapListShape>(
  maps: readonly T[],
  filters: MapFilters,
  studiedIds: ReadonlySet<string>,
): T[] {
  return maps.filter(
    (m) =>
      (filters.level === undefined || m.level === filters.level) &&
      (filters.unitId === undefined || m.unitId === filters.unitId) &&
      (filters.kind === undefined || m.kind === filters.kind) &&
      (filters.studied === undefined || studiedIds.has(m.id) === filters.studied) &&
      matchesQuery(m.search, filters.q),
  );
}

/** Only levels, units and kinds that exist in the maps (MAPAS-E-CARTAS §2.2). */
export function filterOptions(maps: readonly MapListShape[]): FilterOptions {
  const levels = new Set(maps.map((m) => m.level));
  const kinds = new Set(maps.map((m) => m.kind));
  const unitIds: string[] = [];
  for (const m of maps) if (m.unitId && !unitIds.includes(m.unitId)) unitIds.push(m.unitId);
  return {
    levels: FILTER_LEVELS.filter((l) => levels.has(l)),
    unitIds,
    kinds: FILTER_KINDS.filter((k) => kinds.has(k)),
  };
}
