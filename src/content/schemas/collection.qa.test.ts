import type { z } from 'zod';
import { formatIssues } from '../schema';
import { collectionSchema, deckSchema, studyPlanSchema } from './collection';
import {
  buildCollections,
  buildDeck,
  buildPlan,
} from '../../test/fixtures/content/buildCollections';

type AnyRecord = Record<string, unknown>;
const lines = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : formatIssues(r.error);
};
const byId = (id: string) => buildCollections().find((c) => c.id === id) as AnyRecord;
const ids = (n: number, p = 'x') => Array.from({ length: n }, (_, i) => `${p}-${i}`);
const days = () => buildPlan().days as AnyRecord[];

/** Deterministic Fisher–Yates (LCG), so the test is reproducible. */
function shuffle<T>(list: readonly T[], seed = 7): T[] {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('collectionSchema — QA', () => {
  it('phrases without "topics": every entry points to an unlisted topic', () => {
    const c = { ...byId('frases'), topics: undefined };
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 0 › topic: O tópico "cumprimentos" não está em "topics".',
      'entries › 1 › topic: O tópico "cumprimentos" não está em "topics".',
    ]);
  });

  it('a malformed formality in one entry does not hide the avoidWhen rule of another', () => {
    const c = {
      ...byId('expressoes'),
      entries: [
        { itemId: 'fr-001', formality: 'formal' },
        { itemId: 'fr-002', formality: 'informal' },
      ],
    };
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 0 › formality: Formalidade desconhecida; use informal, neutro, giria.',
      'entries › 1 › avoidWhen: Expressão "informal" precisa de "avoidWhen".',
    ]);
  });

  it('an empty avoidWhen is reported once, as "Texto vazio."', () => {
    const c = {
      ...byId('expressoes'),
      entries: [{ itemId: 'fr-001', formality: 'giria', avoidWhen: '' }],
    };
    expect(lines(collectionSchema, c)).toEqual(['entries › 0 › avoidWhen: Texto vazio.']);
  });

  it('accepts an empty entries list', () => {
    expect(lines(collectionSchema, { ...byId('frases'), entries: [] })).toEqual([]);
  });
});

describe('deckSchema — QA limits', () => {
  it('accepts exactly 5 and 60 cards, rejects 4 and 61', () => {
    expect(lines(deckSchema, buildDeck({ itemIds: ids(5) }))).toEqual([]);
    expect(lines(deckSchema, buildDeck({ itemIds: ids(60) }))).toEqual([]);
    expect(lines(deckSchema, buildDeck({ itemIds: ids(4) }))).toEqual([
      'itemIds: O baralho tem de 5 a 60 cartas.',
    ]);
    expect(lines(deckSchema, buildDeck({ itemIds: ids(61) }))).toEqual([
      'itemIds: O baralho tem de 5 a 60 cartas.',
    ]);
  });

  it('reports a repeated card together with "too many cards"', () => {
    expect(lines(deckSchema, buildDeck({ itemIds: [...ids(60), 'x-0'] }))).toEqual([
      'itemIds: O baralho tem de 5 a 60 cartas.',
      'itemIds: Carta repetida no baralho.',
    ]);
  });
});

describe('studyPlanSchema — QA', () => {
  it('accepts the 30 days in any array order', () => {
    expect(lines(studyPlanSchema, buildPlan({ days: shuffle(days()) }))).toEqual([]);
    expect(lines(studyPlanSchema, buildPlan({ days: days().reverse() }))).toEqual([]);
  });

  it('day bounds: 1 and 30 ok; 0, 31 and 1.5 rejected', () => {
    const list = days();
    list[5]!.day = 0;
    list[6]!.day = 31;
    const out = lines(studyPlanSchema, buildPlan({ days: list }));
    expect(out).toEqual(['days › 5 › day: Dia entre 1 e 30.', 'days › 6 › day: Dia entre 1 e 30.']);
    const frac = days();
    frac[7]!.day = 1.5;
    expect(lines(studyPlanSchema, buildPlan({ days: frac }))).toHaveLength(1);
  });

  it('cards per day: 5 and 12 ok, 4 and 13 rejected', () => {
    for (const [n, ok] of [
      [5, true],
      [12, true],
      [4, false],
      [13, false],
    ] as const) {
      const list = days();
      list[0]!.itemIds = ids(n);
      const out = lines(studyPlanSchema, buildPlan({ days: list }));
      expect(out, String(n)).toEqual(ok ? [] : ['days › 0 › itemIds: O dia tem de 5 a 12 cartas.']);
    }
  });

  it('reports a repeated day together with an out-of-range day', () => {
    const list = days();
    list[1]!.day = 1;
    list[2]!.day = 0;
    expect(lines(studyPlanSchema, buildPlan({ days: list }))).toEqual([
      'days › 2 › day: Dia entre 1 e 30.',
      'days › 1 › day: Dia repetido: 1.',
    ]);
  });

  it('reports a repeated day together with "31 days"', () => {
    const list = days();
    list.push({ ...list[0]! });
    expect(lines(studyPlanSchema, buildPlan({ days: list }))).toEqual([
      'days: O plano tem exatamente 30 dias.',
      'days › 30 › day: Dia repetido: 1.',
    ]);
  });

  it('reports a repeated card in a day together with "too many cards"', () => {
    const list = days();
    list[0]!.itemIds = [...ids(12), 'x-0'];
    expect(lines(studyPlanSchema, buildPlan({ days: list }))).toEqual([
      'days › 0 › itemIds: O dia tem de 5 a 12 cartas.',
      'days › 0 › itemIds: Carta repetida no dia.',
    ]);
  });
});
