import { z } from 'zod';
import '../lib/zodLocale';
import { expandPattern, PatternError } from '../domain/grading/patterns';
export { formatIssues } from '../lib/zodIssues';
import { BLANK } from '../domain/grading/blank';
import { tokenizeForBank } from '../domain/grading/tokenize';
import { whenParsed } from './schemas/refine';
export { BLANK, tokenizeForBank };

/** MVP shape: every unit has 4 skills × 3 lessons, lessons have 10–15 exercises. */
export const SKILLS_PER_UNIT = 4;
export const LESSONS_PER_SKILL = 3;
export const MIN_EXERCISES = 10;
export const MAX_EXERCISES = 15;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use ids em kebab-case (ex.: u1-hello).');
const text = z.string().trim().min(1, 'Texto vazio.');

/** Unknown keys named in PT-BR (the Zod locale reports them without the list of names). */
export const unknownKeysMessage = (keys: readonly string[]) =>
  `Campo desconhecido: ${keys.map((k) => `"${k}"`).join(', ')}.`;
export const strictPt = {
  error: (issue: z.core.$ZodRawIssue) =>
    issue.code === 'unrecognized_keys' ? unknownKeysMessage(issue.keys) : undefined,
};

/** An answer pattern using (optional) and [a|b] syntax; must parse and stay under the limit. */
const pattern = text.superRefine((value, ctx) => {
  if (!value) return; // already reported as "Texto vazio."
  try {
    if (expandPattern(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: `O padrão "${value}" não gera nenhuma resposta.` });
    }
  } catch (err) {
    if (!(err instanceof PatternError)) throw err;
    ctx.addIssue({ code: 'custom', message: err.message });
  }
});

/** Shared primitives for the other content schemas (src/content/schemas/). */
export { id as idSchema, text as textSchema, pattern as patternSchema };

export const focusTags = [
  'falso-cognato',
  'idade-com-be',
  'make-do',
  'in-on-at',
  'th',
  'ed-final',
  'vogal-longa-curta',
  'ordem-adjetivo',
  'artigo',
  'plural',
  'pronome',
  'verbo-be',
  'presente-simples',
  'pergunta-do',
  'numeros',
  'horas',
] as const;
export const focusTagSchema = z.enum(focusTags);

const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** CEFR levels; the UI only shows the ones that have content (MAPAS-E-CARTAS §2.2). */
export const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const levelSchema = z.enum(cefrLevels, {
  error: (issue) =>
    issue.input === undefined
      ? `Informe o nível CEFR (level): ${cefrLevels.join(', ')}.`
      : `Nível CEFR inválido; use ${cefrLevels.join(', ')}.`,
});

export const MAX_PRONUNCIATION = 40;
/** Respelling for Brazilians (convention in the prototype's conteudo/LEIA-ME.md). */
const pronunciation = z
  .string()
  .trim()
  .min(1, 'Pronúncia vazia.')
  .max(MAX_PRONUNCIATION, `A pronúncia tem no máximo ${MAX_PRONUNCIATION} caracteres.`)
  .regex(
    /^[^\p{Cc}\p{Zl}\p{Zp}]*$/u,
    'A pronúncia não pode ter quebra de linha nem caracteres de controle.',
  );

const example = z.strictObject({ en: text, pt: text });

/** Unit items inherit the unit's level; explain that instead of a bare "unrecognized key". */
const unitItemKeys = {
  error: (issue: z.core.$ZodRawIssue) => {
    if (issue.code !== 'unrecognized_keys') return undefined;
    const others = issue.keys.filter((key) => key !== 'level');
    const parts = issue.keys.includes('level')
      ? ['Itens de unidade herdam o nível da unidade; "level" por item só vale nos bancos.']
      : [];
    if (others.length) parts.push(unknownKeysMessage(others));
    return parts.join(' ');
  },
};

const vocabShape = {
  id,
  en: text,
  pt: z.array(text).min(1),
  acceptedPt: z.array(pattern).optional(),
  acceptedEn: z.array(pattern).optional(),
  example,
  emoji: text.optional(),
  icon: z.string().optional(),
  pronunciation: pronunciation.optional(),
  difficulty,
  focus: focusTagSchema.optional(),
  notes: z.string().optional(),
};

const sentenceShape = {
  id,
  en: text,
  pt: text,
  acceptedEn: z.array(pattern).optional(),
  acceptedPt: z.array(pattern).optional(),
  example: example.optional(),
  emoji: text.optional(),
  pronunciation: pronunciation.optional(),
  difficulty,
  focus: focusTagSchema.optional(),
};

const vocabObject = z.strictObject(vocabShape, unitItemKeys);
type FalseFriendFields = Pick<z.infer<typeof vocabObject>, 'focus' | 'notes'>;

/** The false-friend warning is the item's `notes`, so a false friend without it is incomplete. */
const hasFalseFriendNotes = (item: FalseFriendFields) =>
  item.focus !== 'falso-cognato' || Boolean(item.notes?.trim());

const falseFriendNotesCheck = {
  path: ['notes'],
  message: 'Falso cognato precisa de "notes" com o aviso de cuidado.',
  when: whenParsed(['focus'], ['notes']),
};

/** Unit items have no `level` field (strict rejects it with an explanation). */
export const vocabItemSchema = vocabObject.refine(hasFalseFriendNotes, falseFriendNotesCheck);
export const sentenceSchema = z.strictObject(sentenceShape, unitItemKeys);

/** Bank items may carry their own level when it differs from the bank's. */
export const bankVocabSchema = z
  .strictObject({ ...vocabShape, level: levelSchema.optional() })
  .refine(hasFalseFriendNotes, falseFriendNotesCheck);
export const bankSentenceSchema = z.strictObject({
  ...sentenceShape,
  level: levelSchema.optional(),
});

export const tipBlockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('text'), md: text }),
  z.strictObject({
    kind: z.literal('examples'),
    items: z.array(z.strictObject({ en: text, pt: text })).min(1),
  }),
  z.strictObject({ kind: z.literal('pitfall'), wrong: text, right: text, why: text }),
]);

export const tipSchema = z.strictObject({
  title: text,
  blocks: z
    .array(tipBlockSchema)
    .min(3, 'A dica precisa de 3 a 6 blocos.')
    .max(6, 'A dica precisa de 3 a 6 blocos.'),
});

const baseExercise = z.strictObject({
  id,
  itemIds: z.array(id).min(1, 'Informe os itens treinados (itemIds).'),
  explanation: z.string().trim().min(1).optional(),
});

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const multipleChoiceSchema = baseExercise
  .extend({
    type: z.literal('multiple-choice'),
    prompt: text,
    options: z
      .array(z.strictObject({ text, emoji: z.string().optional() }))
      .min(3)
      .max(4),
    answer: text,
  })
  .superRefine((ex, ctx) => {
    if (!ex.options.some((o) => sameText(o.text, ex.answer))) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'A resposta precisa estar entre as opções.',
      });
    }
    if (new Set(ex.options.map((o) => o.text.toLowerCase())).size !== ex.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Opções repetidas.' });
    }
  });

export const wordBankSchema = baseExercise
  .extend({
    type: z.literal('word-bank'),
    promptPt: text,
    answer: text,
    accepted: z.array(pattern).optional(),
    distractors: z.array(text).min(2).max(4),
  })
  .superRefine((ex, ctx) => {
    const tiles = tokenizeForBank(ex.answer).map((t) => t.toLowerCase());
    for (const d of ex.distractors) {
      if (tiles.includes(d.toLowerCase())) {
        ctx.addIssue({
          code: 'custom',
          path: ['distractors'],
          message: `O distrator "${d}" também faz parte da resposta.`,
        });
      }
    }
  });

export const translateTypingSchema = baseExercise.extend({
  type: z.literal('translate-typing'),
  promptEn: text,
  accepted: z.array(pattern).min(1),
});

export const listenTypeSchema = baseExercise.extend({
  type: z.literal('listen-type'),
  textEn: text,
  accepted: z.array(pattern).optional(),
});

export const speakSchema = baseExercise.extend({
  type: z.literal('speak'),
  textEn: text,
});

export const matchPairsSchema = baseExercise
  .extend({
    type: z.literal('match-pairs'),
    pairs: z
      .array(z.strictObject({ en: text, pt: text }))
      .min(4)
      .max(5),
  })
  .superRefine((ex, ctx) => {
    const en = new Set(ex.pairs.map((p) => p.en.toLowerCase()));
    const pt = new Set(ex.pairs.map((p) => p.pt.toLowerCase()));
    if (en.size !== ex.pairs.length || pt.size !== ex.pairs.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['pairs'],
        message: 'Pares com palavras repetidas ficam ambíguos.',
      });
    }
  });

export const fillBlankSchema = baseExercise
  .extend({
    type: z.literal('fill-blank'),
    sentence: text,
    options: z.array(text).min(3).max(4),
    answer: text,
    translationPt: text,
  })
  .superRefine((ex, ctx) => {
    if ((ex.sentence.match(/_{3,}/g) ?? []).length !== 1 || ex.sentence.split(BLANK).length !== 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['sentence'],
        message: `A frase precisa de exatamente uma lacuna "${BLANK}".`,
      });
    }
    if (!ex.options.some((o) => sameText(o, ex.answer))) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'A resposta precisa estar entre as opções.',
      });
    }
    if (new Set(ex.options.map((o) => o.toLowerCase())).size !== ex.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Opções repetidas.' });
    }
  });

export const exerciseSchema = z.discriminatedUnion('type', [
  multipleChoiceSchema,
  wordBankSchema,
  translateTypingSchema,
  listenTypeSchema,
  speakSchema,
  matchPairsSchema,
  fillBlankSchema,
]);

export const lessonSchema = z.strictObject({
  id,
  title: z.string().optional(),
  exercises: z
    .array(exerciseSchema)
    .min(MIN_EXERCISES, `A lição precisa de ${MIN_EXERCISES} a ${MAX_EXERCISES} exercícios.`)
    .max(MAX_EXERCISES, `A lição precisa de ${MIN_EXERCISES} a ${MAX_EXERCISES} exercícios.`),
});

export const skillSchema = z.strictObject({
  id,
  title: text,
  icon: text,
  tip: tipSchema,
  vocab: z.array(vocabItemSchema),
  sentences: z.array(sentenceSchema),
  lessons: z
    .array(lessonSchema)
    .length(LESSONS_PER_SKILL, `Cada habilidade tem ${LESSONS_PER_SKILL} lições.`),
});

export const unitColors = ['manga', 'anil', 'folha', 'acerola'] as const;

export const unitSchema = z.strictObject({
  id,
  order: z.number().int().positive(),
  level: levelSchema,
  title: text,
  description: text,
  color: z.enum(unitColors),
  skills: z
    .array(skillSchema)
    .length(SKILLS_PER_UNIT, `Cada unidade tem ${SKILLS_PER_UNIT} habilidades.`),
  reviewLesson: lessonSchema,
});

/** Position of a level in A1…C2, for "at most" comparisons. */
export const levelRank = (level: CefrLevel): number => cefrLevels.indexOf(level);

export type FocusTag = z.infer<typeof focusTagSchema>;
export type CefrLevel = z.infer<typeof levelSchema>;
export type VocabItem = z.infer<typeof vocabItemSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
export type BankVocabItem = z.infer<typeof bankVocabSchema>;
export type BankSentence = z.infer<typeof bankSentenceSchema>;
export type Tip = z.infer<typeof tipSchema>;
export type TipBlock = z.infer<typeof tipBlockSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseType = Exercise['type'];
export type ExerciseOf<T extends ExerciseType> = Extract<Exercise, { type: T }>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type UnitColor = (typeof unitColors)[number];
