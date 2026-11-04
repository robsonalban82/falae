import { MAP_STUDY_XP } from '../gamification/xp';
import type { LessonSummary } from '../lesson/engine';
import { lineView, type ItemLookup, type MapLineShape } from './lines';

/** "Hide the English" (MAPAS-E-CARTAS §6.1). */
export type RevealMapShape = {
  branches: readonly {
    nodes: readonly { tag: string; title?: string; lines: readonly MapLineShape[] }[];
  }[];
};

export type HideableChunk = {
  /** Stable position key: `b{i}.n{j}.l{k}`. */
  key: string;
  kind: 'item' | 'text' | 'fix';
  /** Only for `item` chunks (a line with `ref`). */
  itemId?: string;
  /** The English that is covered (what the learner tries to recall, and what is spoken). */
  text: string;
};

export type RevealRating = 'remembered' | 'forgot';

export type RevealState = {
  on: boolean;
  revealed: string[];
  ratings: Record<string, RevealRating>;
};

export const SRS_REMEMBERED = 4;
export const SRS_FORGOT = 1;

/** Covered chunks in JSON order. Center, titles, Portuguese, `wrong` and `note` stay visible. */
export function hideableChunks(map: RevealMapShape, lookup: ItemLookup): HideableChunk[] {
  const chunks: HideableChunk[] = [];
  map.branches.forEach((branch, i) => {
    branch.nodes.forEach((node, j) => {
      node.lines.forEach((line, k) => {
        const key = `b${i}.n${j}.l${k}`;
        const view = lineView(line, node.tag, lookup);
        if (view?.kind === 'item') {
          chunks.push({ key, kind: 'item', itemId: view.itemId, text: view.en });
        } else if (view?.kind === 'text') {
          chunks.push({ key, kind: 'text', text: view.speakText });
        } else if (view?.kind === 'fix') {
          chunks.push({ key, kind: 'fix', text: view.right });
        }
      });
    });
  });
  return chunks;
}

export const initialRevealState = (): RevealState => ({ on: false, revealed: [], ratings: {} });

/** Turning the mode off drops all progress. */
export const toggleReveal = (s: RevealState): RevealState =>
  s.on ? initialRevealState() : { on: true, revealed: [], ratings: {} };

/** Reveals a chunk of the map; keys that are not in `chunks` are ignored. */
export function reveal(s: RevealState, key: string, chunks: readonly HideableChunk[]): RevealState {
  if (!s.on || s.revealed.includes(key) || !chunks.some((c) => c.key === key)) return s;
  return { ...s, revealed: [...s.revealed, key] };
}

/** Rates a revealed chunk that has an item (only lines with `ref`); rating again replaces it. */
export function rate(
  s: RevealState,
  key: string,
  rating: RevealRating,
  chunks: readonly HideableChunk[],
): RevealState {
  if (!s.on || !s.revealed.includes(key)) return s;
  if (!chunks.some((c) => c.key === key && c.itemId !== undefined)) return s;
  return { ...s, ratings: { ...s.ratings, [key]: rating } };
}

export const resetReveal = (s: RevealState): RevealState =>
  s.on ? { on: true, revealed: [], ratings: {} } : s;

/** Complete when the mode is on and every chunk (at least one) was revealed. */
export const isComplete = (s: RevealState, chunks: readonly HideableChunk[]): boolean =>
  s.on && chunks.length > 0 && chunks.every((c) => s.revealed.includes(c.key));

/** SRS notes: remembered 4, forgot 1; the same item on two lines keeps the lowest q. */
export function revealOutcomes(
  s: RevealState,
  chunks: readonly HideableChunk[],
): { itemId: string; q: 4 | 1 }[] {
  const byItem = new Map<string, 4 | 1>();
  for (const chunk of chunks) {
    const rating = s.ratings[chunk.key];
    if (!chunk.itemId || !rating) continue;
    const q = rating === 'remembered' ? SRS_REMEMBERED : SRS_FORGOT;
    const prev = byItem.get(chunk.itemId);
    byItem.set(chunk.itemId, prev === undefined ? q : (Math.min(prev, q) as 4 | 1)); // min of 4|1
  }
  return [...byItem].map(([itemId, q]) => ({ itemId, q }));
}

/** Summary of a `map` session. Final XP (5 or 0) is decided at commit by `finalSessionXp`. */
export function mapStudySummary(
  s: RevealState,
  chunks: readonly HideableChunk[],
  startedAt: number,
  nowMs: number,
): LessonSummary {
  const rated = chunks.flatMap((c) => {
    const r = c.itemId ? s.ratings[c.key] : undefined;
    return r ? [r] : [];
  });
  const forgot = rated.filter((r) => r === 'forgot').length;
  return {
    xp: MAP_STUDY_XP,
    accuracy: rated.length === 0 ? 1 : (rated.length - forgot) / rated.length,
    perfect: false,
    mistakes: forgot,
    durationMs: Math.max(0, nowMs - startedAt),
    itemOutcomes: revealOutcomes(s, chunks),
  };
}
