import { levelRank, type CefrLevel, type FocusTag, type Unit } from './schema';
import type { Bank } from './schemas/course';
import type { Collection, Deck, StudyPlan } from './schemas/collection';

/** At most this share of a collection may be B1 or above (decision 13). */
export const MAX_ADVANCED_SHARE = 0.2;
const B1 = levelRank('B1');

/** What the collection rules need to know about an item (structural, minimal). */
export type ItemFacts = { kind: 'vocab' | 'sentence'; level: CefrLevel; focus?: FocusTag };

export type CollectionContext = {
  items: ReadonlyMap<string, ItemFacts>;
  mapIds: ReadonlySet<string>;
  planIds: ReadonlySet<string>;
};

export type PlanContext = {
  items: ReadonlyMap<string, unknown>;
  mapIds: ReadonlySet<string>;
  /** Lesson ids in path order (unit by unit, skill by skill, review last). */
  lessonOrder: readonly string[];
};

/** Item facts of every unit and bank item (unit items take the unit's level). */
export function buildItemFacts(input: {
  units: readonly Unit[];
  banks: readonly Bank[];
}): Map<string, ItemFacts> {
  const facts = new Map<string, ItemFacts>();
  const add = (
    id: string,
    kind: ItemFacts['kind'],
    level: CefrLevel,
    focus: FocusTag | undefined,
  ) => facts.set(id, focus ? { kind, level, focus } : { kind, level });
  for (const unit of input.units) {
    for (const skill of unit.skills) {
      for (const v of skill.vocab) add(v.id, 'vocab', unit.level, v.focus);
      for (const s of skill.sentences) add(s.id, 'sentence', unit.level, s.focus);
    }
  }
  for (const bank of input.banks) {
    for (const v of bank.vocab) add(v.id, 'vocab', v.level ?? bank.level, v.focus);
    for (const s of bank.sentences) add(s.id, 'sentence', s.level ?? bank.level, s.focus);
  }
  return facts;
}

/** Lesson ids in path order, for "the plan follows the path". */
export function lessonOrderOf(units: readonly Unit[]): string[] {
  return [...units]
    .sort((a, b) => a.order - b.order)
    .flatMap((u) => [...u.skills.flatMap((s) => s.lessons.map((l) => l.id)), u.reviewLesson.id]);
}

/** Rules of §2.6 that need the rest of the content (the schema checks each file by itself). */
export function collectionIssues(collection: Collection, ctx: CollectionContext): string[] {
  const issues: string[] = [];
  const where = `[${collection.id}]`;
  const entries = collection.entries ?? [];
  let found = 0; // missing items are reported apart and do not count in the 20%
  let advanced = 0;
  for (const entry of entries) {
    const item = ctx.items.get(entry.itemId);
    if (!item) {
      issues.push(`${where} O item "${entry.itemId}" não existe.`);
      continue;
    }
    found++;
    if (levelRank(item.level) >= B1) advanced++;
    if (
      collection.kind === 'false-friends' &&
      (item.kind !== 'vocab' || item.focus !== 'falso-cognato')
    ) {
      issues.push(`${where} "${entry.itemId}" precisa ser vocabulário com focus "falso-cognato".`);
    }
  }
  if (found > 0 && advanced / found > MAX_ADVANCED_SHARE) {
    issues.push(
      `${where} ${advanced} de ${found} itens são B1 ou acima (máximo ${MAX_ADVANCED_SHARE * 100}%).`,
    );
  }
  for (const mapId of collection.mapIds ?? []) {
    if (!ctx.mapIds.has(mapId)) issues.push(`${where} O mapa "${mapId}" não existe.`);
  }
  if (collection.planId && !ctx.planIds.has(collection.planId)) {
    issues.push(`${where} O plano "${collection.planId}" não existe.`);
  }
  return issues;
}

export function deckIssues(deck: Deck, ctx: Pick<CollectionContext, 'items'>): string[] {
  return deck.itemIds
    .filter((id) => !ctx.items.has(id))
    .map((id) => `[${deck.id}] O item "${id}" não existe.`);
}

export function planIssues(plan: StudyPlan, ctx: PlanContext): string[] {
  const issues: string[] = [];
  const position = new Map(ctx.lessonOrder.map((id, i) => [id, i]));
  let previous: { day: number; at: number } | null = null;
  for (const day of [...plan.days].sort((a, b) => a.day - b.day)) {
    const where = `[${plan.id}] dia ${day.day}:`;
    if (!ctx.mapIds.has(day.mapId)) issues.push(`${where} o mapa "${day.mapId}" não existe.`);
    for (const id of day.itemIds) {
      if (!ctx.items.has(id)) issues.push(`${where} o item "${id}" não existe.`);
    }
    const at = position.get(day.lessonId);
    if (at === undefined) {
      issues.push(`${where} a lição "${day.lessonId}" não existe.`);
      continue;
    }
    if (previous && at < previous.at) {
      issues.push(
        `${where} a lição "${day.lessonId}" vem antes, na trilha, da lição do dia ${previous.day}.`,
      );
    }
    previous = { day: day.day, at };
  }
  return issues;
}
