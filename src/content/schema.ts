import { z } from 'zod';
import { expandPattern, PatternError } from '../domain/grading/patterns';
export { formatIssues } from '../lib/zodIssues';

/** MVP shape: every unit has 4 skills × 3 lessons, lessons have 10–15 exercises. */
export const SKILLS_PER_UNIT = 4;
export const LESSONS_PER_SKILL = 3;
export const MIN_EXERCISES = 10;
export const MAX_EXERCISES = 15;
export const BLANK = '___';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use ids em kebab-case (ex.: u1-hello).');
const text = z.string().trim().min(1, 'Texto vazio.');

/** An answer pattern using (optional) and [a|b] syntax; must parse and stay under the limit. */
const pattern = text.superRefine((value, ctx) => {
  try {
    if (expandPattern(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: `O padrão "${value}" não gera nenhuma resposta.` });
    }
  } catch (err) {
    if (!(err instanceof PatternError)) throw err;
    ctx.addIssue({ code: 'custom', message: err.message });
  }
});

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

export const vocabItemSchema = z.strictObject({
  id,
  en: text,
  pt: z.array(text).min(1),
  acceptedPt: z.array(pattern).optional(),
  acceptedEn: z.array(pattern).optional(),
  example: z.strictObject({ en: text, pt: text }),
  emoji: z.string().optional(),
  icon: z.string().optional(),
  difficulty,
  focus: focusTagSchema.optional(),
  notes: z.string().optional(),
});

export const sentenceSchema = z.strictObject({
  id,
  en: text,
  pt: text,
  acceptedEn: z.array(pattern).optional(),
  acceptedPt: z.array(pattern).optional(),
  difficulty,
  focus: focusTagSchema.optional(),
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

/** Splits a sentence into word-bank tiles (keeps apostrophes, drops surrounding punctuation). */
export function tokenizeForBank(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ''))
    .filter(Boolean);
}

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
  title: text,
  description: text,
  color: z.enum(unitColors),
  skills: z
    .array(skillSchema)
    .length(SKILLS_PER_UNIT, `Cada unidade tem ${SKILLS_PER_UNIT} habilidades.`),
  reviewLesson: lessonSchema,
});

/**
 * Cross-unit checks on already-parsed units: unique ids, valid item references, unique order.
 * Pure function so the runtime loader can run it without re-parsing everything.
 */
export function courseIssues(units: readonly Unit[]): string[] {
  const issues: string[] = [];
  const seen = new Map<string, string>();
  const itemIds = new Set<string>();
  const claim = (value: string, where: string) => {
    const previous = seen.get(value);
    if (previous) issues.push(`Id duplicado "${value}" (${previous} e ${where}).`);
    else seen.set(value, where);
  };

  const orders = new Set<number>();
  for (const unit of units) {
    claim(unit.id, 'unidade');
    if (orders.has(unit.order)) issues.push(`Ordem de unidade repetida: ${unit.order}.`);
    orders.add(unit.order);
    for (const skill of unit.skills) {
      claim(skill.id, `habilidade em ${unit.id}`);
      for (const item of [...skill.vocab, ...skill.sentences]) {
        claim(item.id, `item em ${skill.id}`);
        itemIds.add(item.id);
      }
    }
  }

  for (const unit of units) {
    for (const lesson of [...unit.skills.flatMap((s) => s.lessons), unit.reviewLesson]) {
      claim(lesson.id, `lição em ${unit.id}`);
      for (const ex of lesson.exercises) {
        claim(ex.id, `exercício em ${lesson.id}`);
        for (const ref of ex.itemIds) {
          if (!itemIds.has(ref))
            issues.push(`Exercício ${ex.id} cita o item "${ref}", que não existe.`);
        }
      }
    }
  }
  return issues;
}

/** Whole course schema (used by tests and tooling). */
export const courseSchema = z.array(unitSchema).superRefine((units, ctx) => {
  for (const message of courseIssues(units)) ctx.addIssue({ code: 'custom', message });
});

export type FocusTag = z.infer<typeof focusTagSchema>;
export type VocabItem = z.infer<typeof vocabItemSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
export type Tip = z.infer<typeof tipSchema>;
export type TipBlock = z.infer<typeof tipBlockSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseType = Exercise['type'];
export type ExerciseOf<T extends ExerciseType> = Extract<Exercise, { type: T }>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type UnitColor = (typeof unitColors)[number];
