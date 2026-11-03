import { z } from 'zod';
import { normalize } from '../../domain/grading/normalize';
import {
  bankSentenceSchema,
  bankVocabSchema,
  levelSchema,
  strictPt,
  textSchema as text,
  unitSchema,
  type Unit,
} from '../schema';

/** Item banks: items that are not in any unit (MAPAS-E-CARTAS §2.4). */
export const bankIds = [
  'frases',
  'phrasal',
  'expressoes',
  'falsos-cognatos',
  'extra-a1',
  'extra-a2',
] as const;
export const bankIdSchema = z.enum(bankIds, {
  error: `Banco desconhecido; use ${bankIds.join(', ')}.`,
});

/** Item id prefix required in each bank (ids are permanent: they key the SRS card). */
export const bankItemPrefix: Readonly<Record<BankId, string>> = {
  frases: 'fr-',
  phrasal: 'pv-',
  expressoes: 'ex-',
  'falsos-cognatos': 'fc-',
  'extra-a1': 'xa-',
  'extra-a2': 'xa-',
};

/** Reserved for the student's own cards; never valid in bundled content. */
export const USER_CARD_PREFIX = 'uc-';

export const bankSchema = z.strictObject(
  {
    id: bankIdSchema,
    title: text,
    level: levelSchema, // default level of the items
    vocab: z.array(bankVocabSchema),
    sentences: z.array(bankSentenceSchema),
  },
  strictPt,
);

/**
 * Cross-file checks on already-parsed units and banks: globally unique ids, bank id prefixes,
 * valid item references, unique unit order.
 * Pure function so the runtime loader can run it without re-parsing everything.
 */
export function courseIssues({
  units,
  banks,
}: {
  units: readonly Unit[];
  banks: readonly Bank[];
}): string[] {
  const issues: string[] = [];
  const seen = new Map<string, string>();
  const itemIds = new Set<string>();
  const claim = (value: string, where: string) => {
    if (value.startsWith(USER_CARD_PREFIX)) {
      issues.push(
        `O id "${value}" (${where}) usa o prefixo "${USER_CARD_PREFIX}", reservado para as cartas do aluno.`,
      );
    }
    const previous = seen.get(value);
    if (previous) issues.push(`Id duplicado "${value}" (${previous} e ${where}).`);
    else seen.set(value, where);
  };

  // "One place per item": a bank item must not repeat a unit item or another bank item.
  const ownerOfEn = new Map<string, string>();

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
        const en = normalize(item.en, 'en');
        if (!ownerOfEn.has(en)) ownerOfEn.set(en, item.id);
      }
    }
  }

  const bankSeen = new Set<string>();
  for (const bank of banks) {
    if (bankSeen.has(bank.id)) {
      issues.push(`Banco repetido: "${bank.id}".`);
      continue;
    }
    bankSeen.add(bank.id);
    const prefix = bankItemPrefix[bank.id];
    for (const item of [...bank.vocab, ...bank.sentences]) {
      claim(item.id, `item no banco ${bank.id}`);
      itemIds.add(item.id);
      const en = normalize(item.en, 'en');
      const owner = ownerOfEn.get(en);
      if (owner) {
        issues.push(
          `Item "${item.id}" do banco ${bank.id} repete "${item.en}", que já é o item "${owner}". Remova-o do banco e faça a coleção apontar para "${owner}".`,
        );
      } else ownerOfEn.set(en, item.id);
      if (!item.id.startsWith(prefix)) {
        issues.push(`Item "${item.id}" do banco ${bank.id} precisa começar com "${prefix}".`);
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
  for (const message of courseIssues({ units, banks: [] })) {
    ctx.addIssue({ code: 'custom', message });
  }
});

export type BankId = z.infer<typeof bankIdSchema>;
export type Bank = z.infer<typeof bankSchema>;
