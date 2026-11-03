import { unitSchema, type CefrLevel } from './schema';
import { bankSchema } from './schemas/course';
import { collectionSchema, studyPlanSchema, type Collection } from './schemas/collection';
import {
  buildItemFacts,
  collectionIssues,
  deckIssues,
  lessonOrderOf,
  planIssues,
  type CollectionContext,
  type ItemFacts,
} from './collectionIssues';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildCollections, buildPlan } from '../test/fixtures/content/buildCollections';

const units = [unitSchema.parse(buildUnit(1)), unitSchema.parse(buildUnit(2))];
const banks = [bankSchema.parse(buildBank()), bankSchema.parse(buildFalseFriendsBank())];
const items = buildItemFacts({ units, banks });
const ctx: CollectionContext = {
  items,
  mapIds: new Set(['mm-test']),
  planIds: new Set(['pl-30d']),
};
const phrasal = (): Collection =>
  collectionSchema.parse(buildCollections().find((c) => c.id === 'phrasal'));

/** A phrasal collection with `total` entries, `advanced` of them at `level`. */
function shareRun(total: number, advanced: number, level: CefrLevel = 'B1') {
  const facts = new Map<string, ItemFacts>(items);
  const c = phrasal();
  c.entries = Array.from({ length: total }, (_, i) => {
    facts.set(`pv-${i}`, { kind: 'vocab', level: i < advanced ? level : 'A2' });
    return { itemId: `pv-${i}`, baseVerb: 'get' as const };
  });
  return collectionIssues(c, { ...ctx, items: facts });
}

describe('collectionIssues — 20% B1+ ceiling (QA)', () => {
  it('matches advanced * 5 <= total for every size 1..60 (no float surprises)', () => {
    for (let total = 1; total <= 60; total++) {
      for (let advanced = 0; advanced <= Math.min(total, 15); advanced++) {
        const ok = advanced * 5 <= total;
        const out = shareRun(total, advanced);
        expect(out.length === 0, `${advanced}/${total}`).toBe(ok);
      }
    }
  });

  it('exactly 20% passes (1/5, 3/15, 7/35, 12/60); one more fails', () => {
    for (const [a, t] of [
      [1, 5],
      [3, 15],
      [7, 35],
      [12, 60],
    ] as const) {
      expect(shareRun(t, a), `${a}/${t}`).toEqual([]);
      expect(shareRun(t, a + 1), `${a + 1}/${t}`).toEqual([
        `[phrasal] ${a + 1} de ${t} itens são B1 ou acima (máximo 20%).`,
      ]);
    }
  });

  it('a one-item collection with a B1 item is over the ceiling (100%)', () => {
    expect(shareRun(1, 1)).toEqual(['[phrasal] 1 de 1 itens são B1 ou acima (máximo 20%).']);
  });

  it('A2 never counts; C2 counts', () => {
    expect(shareRun(4, 4, 'A2')).toEqual([]);
    expect(shareRun(4, 1, 'C2')).toHaveLength(1);
  });

  it('a collection without entries has no ceiling problem', () => {
    const c = phrasal();
    c.entries = [];
    expect(collectionIssues(c, ctx)).toEqual([]);
    delete c.entries;
    expect(collectionIssues(c, ctx)).toEqual([]);
  });

  it('reports missing item, false friend, ceiling, map and plan problems together', () => {
    const facts = new Map<string, ItemFacts>(items);
    facts.set('fc-b1', { kind: 'vocab', level: 'B1', focus: 'falso-cognato' });
    const c = collectionSchema.parse({
      ...buildCollections().find((x) => x.id === 'falsos-cognatos'),
      entries: [{ itemId: 'fc-b1' }, { itemId: 'fr-001' }, { itemId: 'fc-404' }],
      mapIds: ['mm-test', 'mm-404'],
      planId: 'pl-404',
    });
    expect(collectionIssues(c, { ...ctx, items: facts })).toEqual([
      '[falsos-cognatos] "fr-001" precisa ser vocabulário com focus "falso-cognato".',
      '[falsos-cognatos] O item "fc-404" não existe.',
      '[falsos-cognatos] 1 de 2 itens são B1 ou acima (máximo 20%).',
      '[falsos-cognatos] O mapa "mm-404" não existe.',
      '[falsos-cognatos] O plano "pl-404" não existe.',
    ]);
  });

  it('item levels: bank item override wins over bank level; unit items take unit level', () => {
    expect(items.get('fr-001')?.level).toBe('A1');
    expect(items.get('fr-003')?.level).toBe('B1');
    expect(items.get('t2-sk1-word')?.level).toBe('A1');
  });
});

describe('deckIssues — QA', () => {
  it('lists every missing item, in order', () => {
    const deck = {
      id: 'dk-x',
      title: 'X',
      icon: 'pin',
      level: 'A1',
      itemIds: ['a', 'fr-001', 'b'],
    };
    // structural input: deckIssues only reads id and itemIds
    expect(deckIssues(deck as Parameters<typeof deckIssues>[0], ctx)).toEqual([
      '[dk-x] O item "a" não existe.',
      '[dk-x] O item "b" não existe.',
    ]);
  });
});

describe('planIssues — QA (30 days, any array order)', () => {
  const order = lessonOrderOf(units);
  const planCtx = { items, mapIds: ctx.mapIds, lessonOrder: order };
  const plan = () => studyPlanSchema.parse(buildPlan());
  const shuffle = <T>(list: readonly T[]): T[] =>
    [...list]
      .map((v, i) => ({ v, k: ((i + 3) * 7919) % 31 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.v);

  it('lesson order spans both units, reviews after each unit', () => {
    expect(order).toHaveLength(2 * 13);
    expect(order[12]).toBe('t1-review');
    expect(order[13]).toBe('t2-sk1-l1');
  });

  it('a shuffled valid plan has no issues', () => {
    const p = plan();
    p.days = shuffle(p.days);
    expect(p.days[0]!.day).not.toBe(1);
    expect(planIssues(p, planCtx)).toEqual([]);
  });

  it('same lesson on consecutive days is fine (non-decreasing)', () => {
    const p = plan();
    for (const d of p.days) d.lessonId = 't1-sk1-l1';
    expect(planIssues(p, planCtx)).toEqual([]);
  });

  it('detects a regression whatever the array order, reported by day number', () => {
    const p = plan();
    p.days[29]!.lessonId = 't2-sk1-l1'; // day 30 jumps ahead: fine
    p.days[19]!.lessonId = 't1-sk1-l1'; // day 20 goes back
    p.days = shuffle(p.days);
    expect(planIssues(p, planCtx)).toEqual([
      '[pl-30d] dia 20: a lição "t1-sk1-l1" vem antes, na trilha, da lição do dia 19.',
    ]);
  });

  it('a missing lesson does not break the order check of the next days', () => {
    const p = plan();
    p.days[9]!.lessonId = 't9-nada';
    p.days[10]!.lessonId = 't1-sk1-l1'; // back from day 9's lesson
    expect(planIssues(p, planCtx)).toEqual([
      '[pl-30d] dia 10: a lição "t9-nada" não existe.',
      '[pl-30d] dia 11: a lição "t1-sk1-l1" vem antes, na trilha, da lição do dia 9.',
    ]);
  });

  it('reports map, items and lesson of the same day together', () => {
    const p = plan();
    p.days[0]!.mapId = 'mm-404';
    p.days[0]!.itemIds = ['x1', 'x2', 'fr-001', 'fr-002', 'fc-001'];
    p.days[0]!.lessonId = 'nada';
    expect(planIssues(p, planCtx)).toEqual([
      '[pl-30d] dia 1: o mapa "mm-404" não existe.',
      '[pl-30d] dia 1: o item "x1" não existe.',
      '[pl-30d] dia 1: o item "x2" não existe.',
      '[pl-30d] dia 1: a lição "nada" não existe.',
    ]);
  });
});
