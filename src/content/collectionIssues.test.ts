import { unitSchema } from './schema';
import { bankSchema } from './schemas/bank';
import {
  collectionSchema,
  deckSchema,
  studyPlanSchema,
  type Collection,
} from './schemas/collection';
import {
  buildItemFacts,
  collectionIssues,
  deckIssues,
  lessonOrderOf,
  planIssues,
  type CollectionContext,
} from './collectionIssues';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildCollections, buildDeck, buildPlan } from '../test/fixtures/content/buildCollections';

const units = [unitSchema.parse(buildUnit(1))];
const banks = [bankSchema.parse(buildBank()), bankSchema.parse(buildFalseFriendsBank())];
const items = buildItemFacts({ units, banks });
const ctx: CollectionContext = {
  items,
  mapIds: new Set(['mm-test']),
  planIds: new Set(['pl-30d']),
};
const collection = (id: string, edit?: (c: Collection) => void): Collection => {
  const c = collectionSchema.parse(buildCollections().find((x) => x.id === id));
  edit?.(c);
  return c;
};

describe('buildItemFacts', () => {
  it('uses the unit level, the bank level or the item level', () => {
    expect(items.get('t1-sk1-word')).toEqual({ kind: 'vocab', level: 'A1' });
    expect(items.get('t1-sk1-s-hello')).toEqual({
      kind: 'sentence',
      level: 'A1',
      focus: 'idade-com-be',
    });
    expect(items.get('fr-003')).toEqual({ kind: 'sentence', level: 'B1' });
    expect(items.get('fc-001')).toEqual({ kind: 'vocab', level: 'A2', focus: 'falso-cognato' });
  });
});

describe('collectionIssues', () => {
  it('accepts every fixture collection', () => {
    for (const c of buildCollections()) {
      expect(collectionIssues(collectionSchema.parse(c), ctx), c.id).toEqual([]);
    }
  });

  it('rejects entries for missing items', () => {
    const c = collection('frases', (x) => (x.entries![0]!.itemId = 'fr-999'));
    expect(collectionIssues(c, ctx)).toEqual(['[frases] O item "fr-999" não existe.']);
  });

  it('false-friends: the item must be vocab with focus "falso-cognato"', () => {
    const c = collection('falsos-cognatos', (x) => x.entries!.push({ itemId: 't1-sk1-word' }));
    expect(collectionIssues(c, ctx)).toEqual([
      '[falsos-cognatos] "t1-sk1-word" precisa ser vocabulário com focus "falso-cognato".',
    ]);
  });

  it('rejects 3 of 10 items at B1 and accepts 2 of 10', () => {
    const run = (b1: number) => {
      const facts = new Map(items);
      const entries = Array.from({ length: 10 }, (_, i) => {
        facts.set(`xa-${i}`, { kind: 'vocab', level: i < b1 ? 'B1' : 'A2' });
        return { itemId: `xa-${i}`, baseVerb: 'get' as const };
      });
      const c = collection('phrasal', (x) => (x.entries = entries));
      return collectionIssues(c, { ...ctx, items: facts });
    };
    expect(run(3)).toEqual(['[phrasal] 3 de 10 itens são B1 ou acima (máximo 20%).']);
    expect(run(2)).toEqual([]);
  });

  it('counts only found items in the 20% (missing ones are reported apart)', () => {
    const facts = new Map(items);
    const entries = Array.from({ length: 5 }, (_, i) => {
      facts.set(`xa-${i}`, { kind: 'vocab', level: i === 0 ? 'B1' : 'A2' });
      return { itemId: `xa-${i}`, baseVerb: 'get' as const };
    });
    entries.push({ itemId: 'xa-404', baseVerb: 'get' });
    const c = collection('phrasal', (x) => (x.entries = entries));
    // 1 of 5 found = 20% (ok); dividing by 6 would hide a real 1-of-4 case below
    expect(collectionIssues(c, { ...ctx, items: facts })).toEqual([
      '[phrasal] O item "xa-404" não existe.',
    ]);
    facts.delete('xa-4');
    expect(collectionIssues(c, { ...ctx, items: facts })).toEqual([
      '[phrasal] O item "xa-4" não existe.',
      '[phrasal] O item "xa-404" não existe.',
      '[phrasal] 1 de 4 itens são B1 ou acima (máximo 20%).',
    ]);
  });

  it('counts B2 and above as advanced too', () => {
    const facts = new Map(items);
    facts.set('xa-c1', { kind: 'sentence', level: 'C1' });
    const c = collection('frases', (x) =>
      x.entries!.push({ itemId: 'xa-c1', topic: 'cumprimentos', situation: 'x' }),
    );
    expect(collectionIssues(c, { ...ctx, items: facts })).toEqual([
      '[frases] 1 de 3 itens são B1 ou acima (máximo 20%).',
    ]);
  });

  it('rejects missing maps and plans', () => {
    expect(collectionIssues(collection('phrasal'), { ...ctx, mapIds: new Set() })).toEqual([
      '[phrasal] O mapa "mm-test" não existe.',
    ]);
    expect(collectionIssues(collection('plano'), { ...ctx, planIds: new Set() })).toEqual([
      '[plano] O plano "pl-30d" não existe.',
    ]);
  });
});

describe('deckIssues', () => {
  it('accepts the fixture deck and rejects missing items', () => {
    expect(deckIssues(deckSchema.parse(buildDeck()), ctx)).toEqual([]);
    const deck = deckSchema.parse(buildDeck());
    deck.itemIds[0] = 'pv-404';
    expect(deckIssues(deck, ctx)).toEqual(['[dk-viagem] O item "pv-404" não existe.']);
  });
});

describe('planIssues', () => {
  const planCtx = { items, mapIds: ctx.mapIds, lessonOrder: lessonOrderOf(units) };
  const plan = () => studyPlanSchema.parse(buildPlan());

  it('lists lessons in path order (review last)', () => {
    expect(planCtx.lessonOrder.slice(0, 4)).toEqual([
      't1-sk1-l1',
      't1-sk1-l2',
      't1-sk1-l3',
      't1-sk2-l1',
    ]);
    expect(planCtx.lessonOrder.at(-1)).toBe('t1-review');
  });

  it('accepts the fixture plan', () => {
    expect(planIssues(plan(), planCtx)).toEqual([]);
  });

  it('rejects missing maps, items and lessons', () => {
    const p = plan();
    p.days[0]!.mapId = 'mm-nada';
    p.days[1]!.itemIds[0] = 'fr-404';
    p.days[2]!.lessonId = 't9-sk1-l1';
    expect(planIssues(p, planCtx)).toEqual([
      '[pl-30d] dia 1: o mapa "mm-nada" não existe.',
      '[pl-30d] dia 2: o item "fr-404" não existe.',
      '[pl-30d] dia 3: a lição "t9-sk1-l1" não existe.',
    ]);
  });

  it('rejects a lesson that goes back on the path (by day, not by array order)', () => {
    const p = plan();
    p.days[10]!.lessonId = 't1-sk1-l1';
    expect(planIssues(p, planCtx)).toEqual([
      '[pl-30d] dia 11: a lição "t1-sk1-l1" vem antes, na trilha, da lição do dia 10.',
    ]);
    const shuffled = plan();
    shuffled.days.reverse();
    expect(planIssues(shuffled, planCtx)).toEqual([]);
  });
});
