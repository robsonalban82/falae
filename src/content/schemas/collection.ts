import { z } from 'zod';
import { idSchema, levelSchema, strictPt, textSchema } from '../schema';
import { branchColorSchema, mapIconSchema } from './mindmap';
import { malformedAt, sizedArray, uniqueBy, whenParsed } from './refine';

/** Collections, themed decks and the study plan (MAPAS-E-CARTAS §2.6). */
export const collectionKinds = [
  'phrases',
  'phrasal-verbs',
  'expressions',
  'false-friends',
  'study-plan',
] as const;
export const formalities = ['informal', 'neutro', 'giria'] as const;
export const baseVerbs = ['get', 'take', 'go', 'put', 'look'] as const;
export const coverPapers = ['pautado', 'quadriculado', 'pontilhado'] as const;

export const MIN_DECK_ITEMS = 5;
export const MAX_DECK_ITEMS = 60;
export const PLAN_DAYS = 30;
export const MIN_DAY_ITEMS = 5;
export const MAX_DAY_ITEMS = 12;

const listOf = (values: readonly string[]) => values.join(', ');
const prefixed = (prefix: string, what: string) =>
  idSchema.refine((v) => v.startsWith(prefix), `O id ${what} começa com "${prefix}".`);

/** How an item is PRESENTED in a collection. The item itself stays in its unit/bank. */
export const collectionEntrySchema = z.strictObject(
  {
    itemId: idSchema,
    topic: idSchema.optional(),
    situation: textSchema.optional(), // PT: when to use it
    formality: z
      .enum(formalities, { error: `Formalidade desconhecida; use ${listOf(formalities)}.` })
      .optional(),
    avoidWhen: textSchema.optional(), // PT: when NOT to use it
    baseVerb: z
      .enum(baseVerbs, { error: `Verbo-base desconhecido; use ${listOf(baseVerbs)}.` })
      .optional(),
  },
  strictPt,
);

const mapIdsUnique = uniqueBy<string>(
  (id) => id,
  (id) => `Mapa repetido na coleção: "${id}".`,
);

export const collectionSchema = z
  .strictObject(
    {
      id: idSchema,
      order: z.number().int().positive(),
      kind: z.enum(collectionKinds, {
        error: `Tipo de coleção desconhecido; use ${listOf(collectionKinds)}.`,
      }),
      title: textSchema,
      subtitle: textSchema,
      description: textSchema.optional(),
      cover: z.strictObject(
        {
          icon: mapIconSchema,
          color: branchColorSchema,
          paper: z.enum(coverPapers, { error: `Papel desconhecido; use ${listOf(coverPapers)}.` }),
        },
        strictPt,
      ),
      topics: z
        .array(z.strictObject({ id: idSchema, title: textSchema, icon: mapIconSchema }, strictPt))
        .optional(),
      entries: z.array(collectionEntrySchema).optional(),
      mapIds: z
        .array(prefixed('mm-', 'do mapa'))
        .superRefine(mapIdsUnique.check, mapIdsUnique.options)
        .optional(), // maps shown in the collection
      planId: idSchema.optional(),
    },
    strictPt,
  )
  .refine((c) => c.kind !== 'study-plan' || c.planId, {
    path: ['planId'],
    message: 'Coleção de plano de estudos precisa de "planId".',
    when: whenParsed(['kind'], ['planId']),
  })
  .superRefine(
    (c, ctx) => {
      const topics = new Set<string>();
      c.topics?.forEach((t, i) => {
        if (malformedAt(ctx.issues, ['topics', i, 'id'])) return;
        if (topics.has(t.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['topics', i, 'id'],
            message: `Tópico repetido: "${t.id}".`,
          });
        }
        topics.add(t.id);
      });
      // A malformed topic id leaves the list incomplete: skip only the "listed topic" rule.
      const topicsKnown = !malformedAt(ctx.issues, ['topics', '*', 'id']);
      const seen = new Set<string>();
      c.entries?.forEach((e, i) => {
        // Skip only the entry with a malformed field; the others keep their rules.
        if (malformedAt(ctx.issues, ['entries', i, '*'])) return;
        const add = (field: string, message: string) =>
          ctx.addIssue({ code: 'custom', path: ['entries', i, field], message });
        if (seen.has(e.itemId)) add('itemId', `Entrada repetida: "${e.itemId}".`);
        seen.add(e.itemId);
        if (topicsKnown && e.topic !== undefined && !topics.has(e.topic)) {
          add('topic', `O tópico "${e.topic}" não está em "topics".`);
        }
        // `=== undefined`: an empty text already got "Texto vazio." from its own schema.
        switch (c.kind) {
          case 'phrases':
            if (e.topic === undefined) add('topic', 'Frase da coleção precisa de "topic".');
            if (e.situation === undefined) {
              add('situation', 'Frase da coleção precisa de "situation".');
            }
            break;
          case 'expressions':
            if (e.formality === undefined) add('formality', 'Expressão precisa de "formality".');
            else if (e.formality !== 'neutro' && e.avoidWhen === undefined) {
              add('avoidWhen', `Expressão "${e.formality}" precisa de "avoidWhen".`);
            }
            break;
          case 'phrasal-verbs':
            if (e.baseVerb === undefined) add('baseVerb', 'Phrasal verb precisa de "baseVerb".');
            break;
          case 'false-friends':
          case 'study-plan':
            break;
          default: {
            const never: never = c.kind;
            throw new Error(`Unhandled collection kind: ${String(never)}`);
          }
        }
      });
    },
    { when: whenParsed(['kind'], ['topics'], ['entries']) },
  );

const collectionIdsUnique = uniqueBy<{ id: string }>(
  (c) => c.id,
  (id) => `Coleção repetida: "${id}".`,
  ['id'],
);
const collectionOrdersUnique = uniqueBy<{ order: number }>(
  (c) => c.order,
  (order) => `Ordem de coleção repetida: ${order}.`,
  ['order'],
);

/** collections.json: the shelf of the Maps tab. */
export const collectionsFileSchema = z
  .array(collectionSchema)
  .superRefine(collectionIdsUnique.check, collectionIdsUnique.options)
  .superRefine(collectionOrdersUnique.check, collectionOrdersUnique.options);

const uniqueIds = (ids: readonly string[]) => new Set(ids).size === ids.length;

export const deckSchema = z.strictObject(
  {
    id: prefixed('dk-', 'do baralho'),
    title: textSchema,
    icon: mapIconSchema,
    level: levelSchema,
    description: textSchema.optional(),
    itemIds: sizedArray(idSchema, {
      min: MIN_DECK_ITEMS,
      max: MAX_DECK_ITEMS,
      message: `O baralho tem de ${MIN_DECK_ITEMS} a ${MAX_DECK_ITEMS} cartas.`,
    }).refine(uniqueIds, { message: 'Carta repetida no baralho.', when: whenParsed([]) }),
  },
  strictPt,
);

const deckIdsUnique = uniqueBy<{ id: string }>(
  (d) => d.id,
  (id) => `Baralho repetido: "${id}".`,
  ['id'],
);

/** decks.json: hand-written themed decks (starts as []). */
export const decksFileSchema = z
  .array(deckSchema)
  .superRefine(deckIdsUnique.check, deckIdsUnique.options);

export const planDaySchema = z.strictObject(
  {
    day: z
      .number()
      .int()
      .min(1, `Dia entre 1 e ${PLAN_DAYS}.`)
      .max(PLAN_DAYS, `Dia entre 1 e ${PLAN_DAYS}.`),
    title: textSchema,
    mapId: idSchema,
    itemIds: sizedArray(idSchema, {
      min: MIN_DAY_ITEMS,
      max: MAX_DAY_ITEMS,
      message: `O dia tem de ${MIN_DAY_ITEMS} a ${MAX_DAY_ITEMS} cartas.`,
    }).refine(uniqueIds, { message: 'Carta repetida no dia.', when: whenParsed([]) }),
    lessonId: idSchema,
  },
  strictPt,
);

const daysUnique = uniqueBy<{ day: number }>(
  (d) => d.day,
  (day) => `Dia repetido: ${day}.`,
  ['day'],
);

export const studyPlanSchema = z.strictObject(
  {
    id: prefixed('pl-', 'do plano'),
    title: textSchema,
    level: levelSchema,
    days: sizedArray(planDaySchema, {
      min: PLAN_DAYS,
      max: PLAN_DAYS,
      message: `O plano tem exatamente ${PLAN_DAYS} dias.`,
    }).superRefine(daysUnique.check, daysUnique.options),
  },
  strictPt,
);

export type CollectionKind = (typeof collectionKinds)[number];
export type Formality = (typeof formalities)[number];
export type BaseVerb = (typeof baseVerbs)[number];
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Deck = z.infer<typeof deckSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type StudyPlan = z.infer<typeof studyPlanSchema>;
