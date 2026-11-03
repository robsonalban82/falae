import type { z } from 'zod';
import { formatIssues } from '../schema';
import {
  collectionSchema,
  collectionsFileSchema,
  deckSchema,
  decksFileSchema,
  studyPlanSchema,
} from './collection';
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
const entries = (c: AnyRecord) => c.entries as AnyRecord[];

describe('collectionSchema', () => {
  it('accepts every fixture collection and the whole file', () => {
    for (const c of buildCollections()) expect(lines(collectionSchema, c), c.id).toEqual([]);
    expect(lines(collectionsFileSchema, buildCollections())).toEqual([]);
  });

  it('phrases: requires situation and topic, and the topic must be listed', () => {
    const c = byId('frases');
    delete entries(c)[0]!.situation;
    delete entries(c)[1]!.topic;
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 0 › situation: Frase da coleção precisa de "situation".',
      'entries › 1 › topic: Frase da coleção precisa de "topic".',
    ]);
    const unknown = byId('frases');
    entries(unknown)[0]!.topic = 'viagem';
    expect(lines(collectionSchema, unknown)).toEqual([
      'entries › 0 › topic: O tópico "viagem" não está em "topics".',
    ]);
  });

  it('expressions: giria needs avoidWhen, neutro does not, formality is required', () => {
    const c = byId('expressoes');
    delete entries(c)[1]!.avoidWhen;
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 1 › avoidWhen: Expressão "giria" precisa de "avoidWhen".',
    ]);
    const noFormality = byId('expressoes');
    delete entries(noFormality)[0]!.formality;
    expect(lines(collectionSchema, noFormality)).toEqual([
      'entries › 0 › formality: Expressão precisa de "formality".',
    ]);
  });

  it('expressions: an unknown formality is reported once, without the avoidWhen rule', () => {
    const c = byId('expressoes');
    entries(c)[0]!.formality = 'formal';
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 0 › formality: Formalidade desconhecida; use informal, neutro, giria.',
    ]);
  });

  it('phrasal-verbs: requires baseVerb', () => {
    const c = byId('phrasal');
    delete entries(c)[0]!.baseVerb;
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 0 › baseVerb: Phrasal verb precisa de "baseVerb".',
    ]);
  });

  it('study-plan: requires planId', () => {
    const c = byId('plano');
    delete c.planId;
    expect(lines(collectionSchema, c)).toEqual([
      'planId: Coleção de plano de estudos precisa de "planId".',
    ]);
  });

  it('rejects repeated entries and topics', () => {
    const c = byId('frases');
    entries(c)[1]!.itemId = 'fr-001';
    (c.topics as AnyRecord[]).push({ id: 'cumprimentos', title: 'De novo', icon: 'chat' });
    expect(lines(collectionSchema, c)).toEqual([
      'topics › 1 › id: Tópico repetido: "cumprimentos".',
      'entries › 1 › itemId: Entrada repetida: "fr-001".',
    ]);
  });

  it('reports kind rules together with field errors', () => {
    const c = byId('frases');
    c.title = '';
    delete entries(c)[0]!.situation;
    expect(lines(collectionSchema, c)).toEqual([
      'title: Texto vazio.',
      'entries › 0 › situation: Frase da coleção precisa de "situation".',
    ]);
  });

  it('rejects unknown kind, cover paper and keys in PT-BR', () => {
    const c = byId('frases');
    c.kind = 'mapas';
    (c.cover as AnyRecord).paper = 'liso';
    c.collection = 'frases';
    const text = lines(collectionSchema, c).join('\n');
    expect(text).toMatch(/^kind: Tipo de coleção desconhecido/m);
    expect(text).toMatch(/^cover › paper: Papel desconhecido/m);
    expect(text).toMatch(/^\(raiz\): Campo desconhecido: "collection"\./m);
  });

  it('rejects repeated or unprefixed map ids', () => {
    const c = byId('phrasal');
    c.mapIds = ['mm-test', 'phrasal-get', 'mm-test'];
    expect(lines(collectionSchema, c)).toEqual([
      'mapIds › 1: O id do mapa começa com "mm-".',
      'mapIds › 2: Mapa repetido na coleção: "mm-test".',
    ]);
  });

  it('keeps the rules of the other entries when one entry is malformed', () => {
    const c = byId('expressoes');
    c.entries = [
      { itemId: 5, formality: 'giria' },
      { itemId: 'fr-002', formality: 'giria' },
    ];
    expect(lines(collectionSchema, c)).toEqual([
      'entries › 0 › itemId: Entrada inválida: esperava um texto, recebeu um número',
      'entries › 1 › avoidWhen: Expressão "giria" precisa de "avoidWhen".',
    ]);
  });

  it('reports an empty situation once', () => {
    const c = byId('frases');
    entries(c)[0]!.situation = '  ';
    expect(lines(collectionSchema, c)).toEqual(['entries › 0 › situation: Texto vazio.']);
  });

  it('rejects repeated collection ids and orders in the file', () => {
    const list = buildCollections() as AnyRecord[];
    list[1]!.id = 'frases';
    list[2]!.order = 1;
    expect(lines(collectionsFileSchema, list)).toEqual([
      '1 › id: Coleção repetida: "frases".',
      '2 › order: Ordem de coleção repetida: 1.',
    ]);
  });
});

describe('deckSchema', () => {
  it('accepts the fixture deck and an empty decks file', () => {
    expect(lines(deckSchema, buildDeck())).toEqual([]);
    expect(lines(decksFileSchema, [])).toEqual([]);
  });

  it('requires 5 to 60 distinct cards and the "dk-" prefix', () => {
    const items = buildDeck().itemIds;
    expect(lines(deckSchema, buildDeck({ itemIds: items.slice(0, 4) }))).toEqual([
      'itemIds: O baralho tem de 5 a 60 cartas.',
    ]);
    expect(lines(deckSchema, buildDeck({ itemIds: [...items, items[0]] }))).toEqual([
      'itemIds: Carta repetida no baralho.',
    ]);
    expect(lines(deckSchema, buildDeck({ id: 'viagem' }))).toEqual([
      'id: O id do baralho começa com "dk-".',
    ]);
  });

  it('rejects repeated deck ids in the file', () => {
    expect(lines(decksFileSchema, [buildDeck(), buildDeck()])).toEqual([
      '1 › id: Baralho repetido: "dk-viagem".',
    ]);
  });
});

describe('studyPlanSchema', () => {
  const days = () => buildPlan().days as AnyRecord[];

  it('accepts the fixture plan', () => {
    expect(lines(studyPlanSchema, buildPlan())).toEqual([]);
  });

  it('rejects 29 days', () => {
    expect(lines(studyPlanSchema, buildPlan({ days: days().slice(0, 29) }))).toEqual([
      'days: O plano tem exatamente 30 dias.',
    ]);
  });

  it('rejects a repeated day (also when the count is wrong)', () => {
    const repeated = days();
    repeated[5]!.day = 3;
    expect(lines(studyPlanSchema, buildPlan({ days: repeated }))).toEqual([
      'days › 5 › day: Dia repetido: 3.',
    ]);
    const short = days().slice(0, 29);
    short[1]!.day = 1;
    expect(lines(studyPlanSchema, buildPlan({ days: short }))).toEqual([
      'days: O plano tem exatamente 30 dias.',
      'days › 1 › day: Dia repetido: 1.',
    ]);
  });

  it('rejects day 31, too few cards and the missing "pl-" prefix', () => {
    const list = days();
    list[29]!.day = 31;
    list[0]!.itemIds = ['a', 'b'];
    expect(lines(studyPlanSchema, buildPlan({ id: 'trinta', days: list }))).toEqual([
      'id: O id do plano começa com "pl-".',
      'days › 0 › itemIds: O dia tem de 5 a 12 cartas.',
      'days › 29 › day: Dia entre 1 e 30.',
    ]);
  });
});
