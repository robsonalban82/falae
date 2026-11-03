import type { MapBranch } from './schemas/mindmap';

/**
 * Counts over a parsed map. Kept apart from the map schema so the manifest builder (in the
 * initial JS for the demo unit) does not pull the schemas into the entry (ADR-013).
 */
type MapShape = { branches: readonly MapBranch[] };

/** Number of cards (nodes) in the map. */
export function nodeCount(map: MapShape): number {
  return map.branches.reduce((n, b) => n + b.nodes.length, 0);
}

/** Distinct item ids referenced by the map's lines, in order of appearance. */
export function mapRefs(map: MapShape): string[] {
  const refs = new Set<string>();
  for (const b of map.branches)
    for (const n of b.nodes) for (const line of n.lines) if ('ref' in line) refs.add(line.ref);
  return [...refs];
}
