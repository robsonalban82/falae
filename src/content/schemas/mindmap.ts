import { z } from 'zod';
import { parseBold } from '../../domain/mindmap/richText';
import { BLANK, idSchema, levelSchema, patternSchema, strictPt, textSchema } from '../schema';
import { mapRefs, nodeCount } from '../mapStats';
import { sizedArray, whenParsed } from './refine';

/** Mind map format (MAPAS-E-CARTAS §2.5): center → branches → cards (nodes) → lines. */
export const MIN_BRANCHES = 2;
export const MAX_BRANCHES = 6;
export const MAX_NODES = 25;
export const MIN_REFS = 4;
export const MAX_HINT = 60;
export const MIN_QUIZ_ITEMS = 3;
export const MAX_QUIZ_ITEMS = 6;

export const mapTags = ['regra', 'exemplo', 'excecao', 'erro-comum', 'vocabulario'] as const;
export const mapKinds = ['gramatica', 'vocabulario', 'conversacao'] as const;
/** Branch and cover colors (design tokens, §8). */
export const branchColors = [
  'folha',
  'jabuticaba',
  'anil',
  'manga',
  'acerola',
  'maracuja',
] as const;
/** Drawn icons (§8). */
export const mapIcons = [
  'check',
  'ban',
  'question',
  'quote',
  'x',
  'bulb',
  'clock',
  'pin',
  'book',
  'chat',
  'star',
  'arrow',
  'calendar',
  'home',
  'hash',
  'swap',
] as const;

const listOf = (values: readonly string[]) => values.join(', ');
export const mapIconSchema = z.enum(mapIcons, {
  error: `Ícone desconhecido; use ${listOf(mapIcons)}.`,
});
export const branchColorSchema = z.enum(branchColors, {
  error: `Cor desconhecida; use ${listOf(branchColors)}.`,
});

/** File name in src/content/art/, without ".svg". */
const artKey = idSchema;

/** Text that may use **bold**; markers must come in non-empty pairs. */
const richText = textSchema.refine((value) => parseBold(value).balanced, {
  message: 'Negrito "**" inválido: use pares, sem espaço nem "*" nas pontas.',
});

export const mapLineSchema = z.union(
  [
    // en/pt come from the item; hint is an extra PT gloss
    z.strictObject(
      {
        ref: idSchema,
        hint: textSchema.max(MAX_HINT, `O hint tem no máximo ${MAX_HINT} caracteres.`).optional(),
      },
      strictPt,
    ),
    z.strictObject({ en: richText, pt: textSchema.optional() }, strictPt), // map's own rule/example
    z.strictObject({ wrong: textSchema, right: textSchema, note: textSchema.optional() }, strictPt),
    z.strictObject({ note: textSchema }, strictPt), // PT remark
  ],
  { error: 'Linha inválida: use { ref }, { en, pt }, { wrong, right } ou { note }.' },
);

export const mapNodeSchema = z.strictObject(
  {
    tag: z.enum(mapTags, { error: `Etiqueta desconhecida; use ${listOf(mapTags)}.` }),
    title: richText.optional(),
    art: artKey.optional(),
    lines: z.array(mapLineSchema).min(1, 'O cartão precisa de pelo menos 1 linha.'),
  },
  strictPt,
);

export const mapQuizItemSchema = z.strictObject(
  {
    prompt: textSchema.refine((p) => p.split(BLANK).length === 2 && !/_{4,}/.test(p), {
      message: `O enunciado precisa de exatamente uma lacuna "${BLANK}".`,
    }),
    accepted: z.array(patternSchema).min(1, 'Informe ao menos uma resposta aceita.'), // 1st is shown
    hintPt: textSchema.optional(),
  },
  strictPt,
);

export const mapQuizSchema = z.strictObject(
  {
    instruction: textSchema,
    items: sizedArray(mapQuizItemSchema, {
      min: MIN_QUIZ_ITEMS,
      max: MAX_QUIZ_ITEMS,
      message: `O teste rápido tem de ${MIN_QUIZ_ITEMS} a ${MAX_QUIZ_ITEMS} itens.`,
    }),
  },
  strictPt,
);

export const mapBranchSchema = z.strictObject(
  {
    label: textSchema,
    icon: mapIconSchema,
    color: branchColorSchema,
    nodes: z.array(mapNodeSchema).min(1, 'O ramo precisa de pelo menos 1 cartão.'),
  },
  strictPt,
);

const branchesMessage = `O mapa tem de ${MIN_BRANCHES} a ${MAX_BRANCHES} ramos.`;

export const mindMapSchema = z
  .strictObject(
    {
      id: idSchema.refine((v) => v.startsWith('mm-'), 'O id do mapa começa com "mm-".'),
      title: textSchema, // PT
      level: levelSchema,
      kind: z.enum(mapKinds, { error: `Tipo de mapa desconhecido; use ${listOf(mapKinds)}.` }),
      icon: mapIconSchema,
      unitId: idSchema.optional(),
      skillId: idSchema.optional(),
      center: z.strictObject({ en: textSchema, pt: textSchema }, strictPt),
      centerArt: artKey.optional(),
      intro: textSchema.optional(), // PT, one or two sentences
      doodle: textSchema.optional(), // handwritten note, redundant with the content
      branches: sizedArray(mapBranchSchema, {
        min: MIN_BRANCHES,
        max: MAX_BRANCHES,
        message: branchesMessage,
      }),
      quiz: mapQuizSchema.optional(), // "Teste rápido"
    },
    strictPt,
  )
  .refine((map) => !map.skillId || map.unitId, {
    path: ['unitId'],
    message: 'Mapa com "skillId" precisa de "unitId".',
    when: whenParsed(['skillId'], ['unitId']),
  })
  .refine((map) => nodeCount(map) <= MAX_NODES, {
    path: ['branches'],
    message: `O mapa tem no máximo ${MAX_NODES} cartões; divida em dois mapas.`,
    when: whenParsed(['branches', '*', 'nodes']),
  })
  .superRefine(
    (map, ctx) => {
      const seen = new Set<string>();
      map.branches.forEach((b, i) => {
        if (seen.has(b.color)) {
          ctx.addIssue({
            code: 'custom',
            path: ['branches', i, 'color'],
            message: `Cor de ramo repetida: "${b.color}".`,
          });
        }
        seen.add(b.color);
      });
    },
    { when: whenParsed(['branches', '*', 'color']) },
  )
  .refine((map) => mapRefs(map).length >= MIN_REFS, {
    path: ['branches'],
    message: `O mapa precisa de pelo menos ${MIN_REFS} linhas com "ref" distintos (para "Praticar este mapa").`,
    when: whenParsed(['branches', '*', 'nodes', '*', 'lines', '*']),
  });

export type MapTag = (typeof mapTags)[number];
export type MapKind = (typeof mapKinds)[number];
export type MapIcon = (typeof mapIcons)[number];
export type BranchColor = (typeof branchColors)[number];
export type MapLine = z.infer<typeof mapLineSchema>;
export type MapNode = z.infer<typeof mapNodeSchema>;
export type MapBranch = z.infer<typeof mapBranchSchema>;
export type MapQuiz = z.infer<typeof mapQuizSchema>;
export type MindMap = z.infer<typeof mindMapSchema>;

export { mapRefs, nodeCount };
