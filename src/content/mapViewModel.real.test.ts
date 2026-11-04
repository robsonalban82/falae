import { toFlashcard } from '../domain/cards/flashcard';
import { FILTER_KINDS, FILTER_LEVELS, filterMaps, filterOptions } from '../domain/mindmap/filter';
import type { MapItemShape } from '../domain/items';
import { lineView } from '../domain/mindmap/lines';
import {
  hideableChunks,
  initialRevealState,
  isComplete,
  reveal,
  toggleReveal,
} from '../domain/mindmap/reveal';
import { initialQuizState, checkAll } from '../domain/mindmap/quiz';
import { cefrLevels, unitSchema } from './schema';
import { bankSchema } from './schemas/course';
import { mapKinds, mindMapSchema, type MindMap } from './schemas/mindmap';
import { courseManifest as manifest } from './manifest.generated';

// The domain view model run over the real maps (domain itself never imports content).
const json = (glob: Record<string, { default: unknown }>) =>
  Object.values(glob).map((m) => m.default);
const maps: MindMap[] = json(
  import.meta.glob<{ default: unknown }>('./mindmaps/*.json', { eager: true }),
).map((raw) => mindMapSchema.parse(raw));

const items = new Map<string, MapItemShape & { example?: { en: string; pt: string } }>();
for (const raw of json(import.meta.glob<{ default: unknown }>('./units/*.json', { eager: true }))) {
  const unit = unitSchema.parse(raw);
  for (const s of unit.skills) for (const i of [...s.vocab, ...s.sentences]) items.set(i.id, i);
}
for (const raw of json(import.meta.glob<{ default: unknown }>('./banks/*.json', { eager: true }))) {
  const bank = bankSchema.parse(raw);
  for (const i of [...bank.vocab, ...bank.sentences]) items.set(i.id, i);
}
const lookup = (id: string) => items.get(id);

describe('map view model on real maps', () => {
  it('has the six maps', () => {
    expect(maps.length).toBeGreaterThanOrEqual(6);
  });

  it.each(maps.map((m) => [m.id, m] as const))('%s: every line has a view', (_id, map) => {
    for (const branch of map.branches)
      for (const node of branch.nodes)
        for (const line of node.lines) expect(lineView(line, node.tag, lookup)).not.toBeNull();
  });

  it.each(maps.map((m) => [m.id, m] as const))('%s: chunks, flashcards and quiz', (_id, map) => {
    const chunks = hideableChunks(map, lookup);
    expect(chunks.length).toBeGreaterThan(0);
    expect(new Set(chunks.map((c) => c.key)).size).toBe(chunks.length);
    const all = chunks.reduce(
      (s, c) => reveal(s, c.key, chunks),
      toggleReveal(initialRevealState()),
    );
    expect(isComplete(all, chunks)).toBe(true);
    for (const id of new Set(chunks.flatMap((c) => (c.itemId ? [c.itemId] : [])))) {
      const item = lookup(id);
      expect(item && toFlashcard(item).back.pt).toBeTruthy();
    }
    if (map.quiz) {
      const accepted = map.quiz.items;
      const state = checkAll(
        initialQuizState(accepted.length),
        accepted.map((q) => q.accepted[0] ?? ''),
        accepted,
        { knownWords: new Set() },
      );
      expect(state.items.every((i) => i.status !== 'wrong')).toBe(true);
    }
  });

  it('mm-to-be has covered chunks', () => {
    const map = maps.find((m) => m.id === 'mm-to-be');
    expect(map && hideableChunks(map, lookup).length).toBeGreaterThan(10);
  });

  it('filters work over the real manifest and the domain constants match the schema', () => {
    expect([...FILTER_LEVELS]).toEqual([...cefrLevels]);
    expect([...FILTER_KINDS]).toEqual([...mapKinds]);
    expect(filterMaps(manifest.maps, { q: '' }, new Set())).toHaveLength(manifest.maps.length);
    expect(filterOptions(manifest.maps).levels.length).toBeGreaterThan(0);
    expect(filterMaps(manifest.maps, { q: 'get' }, new Set()).map((m) => m.id)).toContain(
      'mm-phrasal-get',
    );
  });
});
