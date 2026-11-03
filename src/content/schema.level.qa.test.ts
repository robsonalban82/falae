import {
  bankSentenceSchema,
  bankVocabSchema,
  formatIssues,
  sentenceSchema,
  unitSchema,
  vocabItemSchema,
} from './schema';
import { buildUnit } from '../test/fixtures/buildUnit';

/** QA edges for the CEFR level and optional item fields (FASE-2, step 2). */
type AnyRecord = Record<string, unknown>;
const vocab = {
  id: 'qa-word',
  en: 'pretend',
  pt: ['fingir'],
  example: { en: 'He pretends to work.', pt: 'Ele finge que trabalha.' },
  difficulty: 2,
};
const sentence = { id: 'qa-s', en: 'Hi!', pt: 'Oi!', difficulty: 1 };
const lines = (r: { success: boolean; error?: Parameters<typeof formatIssues>[0] }) =>
  r.error ? formatIssues(r.error) : [];

describe('real units carry the CEFR level', () => {
  const modules = import.meta.glob<{ default: AnyRecord }>('./units/*.json', { eager: true });

  it('every bundled unit is A1 and keeps its other fields', () => {
    const units = Object.values(modules).map((m) => m.default);
    expect(units.length).toBeGreaterThanOrEqual(4);
    for (const u of units) {
      expect(u.level, String(u.id)).toBe('A1');
      const r = unitSchema.safeParse(u);
      expect(r.success, String(u.id)).toBe(true);
      expect(r.success && r.data.level).toBe('A1');
    }
  });
});

describe('level — malformed values', () => {
  it.each([[' A1 '], ['A1 '], ['a2'], [null], [1], [['A1']], [{}]])(
    'rejects %j on a unit with the PT-BR invalid-level message',
    (level) => {
      const r = unitSchema.safeParse(buildUnit(1, { level }));
      expect(r.success).toBe(false);
      expect(lines(r)).toContain('level: Nível CEFR inválido; use A1, A2, B1, B2, C1, C2.');
    },
  );

  it('accepts an explicit undefined level on bank items', () => {
    expect(bankVocabSchema.safeParse({ ...vocab, level: undefined }).success).toBe(true);
    expect(bankSentenceSchema.safeParse({ ...sentence, level: undefined }).success).toBe(true);
  });

  it('reports the level error on a bank false friend that has notes', () => {
    const r = bankVocabSchema.safeParse({
      ...vocab,
      focus: 'falso-cognato',
      notes: 'Pretend não é pretender.',
      level: 'B9',
    });
    expect(lines(r)).toEqual(['level: Nível CEFR inválido; use A1, A2, B1, B2, C1, C2.']);
  });

  it('rejects level on a unit sentence too (not only vocab)', () => {
    const unit = buildUnit() as AnyRecord;
    const skill = (unit.skills as AnyRecord[])[0] as AnyRecord;
    const sentences = skill.sentences as AnyRecord[] | undefined;
    if (!sentences?.length) return; // fixture without sentences: covered at item level
    (sentences[0] as AnyRecord).level = 'A1';
    const r = unitSchema.safeParse(unit);
    expect(r.success).toBe(false);
    expect(lines(r).join('\n')).toMatch(/sentences › 0.*level/);
  });
});

describe('pronunciation — edges', () => {
  it('rejects null and keeps sentences free of pronunciation by default', () => {
    expect(sentenceSchema.safeParse({ ...sentence, pronunciation: null }).success).toBe(false);
    const r = sentenceSchema.safeParse(sentence);
    expect(r.success && r.data.pronunciation).toBeUndefined();
  });

  it('accepts 40 accented characters (respelling uses é, ô, tch…)', () => {
    expect(vocabItemSchema.safeParse({ ...vocab, pronunciation: 'é'.repeat(40) }).success).toBe(
      true,
    );
  });

  it('applies the same limit on bank items', () => {
    const tooLong = 'a'.repeat(41);
    expect(bankVocabSchema.safeParse({ ...vocab, pronunciation: tooLong }).success).toBe(false);
    expect(bankSentenceSchema.safeParse({ ...sentence, pronunciation: tooLong }).success).toBe(
      false,
    );
  });
});

describe('false friend notes — edges', () => {
  it('reports missing notes together with another field error in the same item', () => {
    const r = vocabItemSchema.safeParse({ ...vocab, focus: 'falso-cognato', pronunciation: '' });
    expect(lines(r)).toEqual([
      'pronunciation: Pronúncia vazia.',
      'notes: Falso cognato precisa de "notes" com o aviso de cuidado.',
    ]);
  });

  it('rejects empty-string notes and non-string notes', () => {
    expect(vocabItemSchema.safeParse({ ...vocab, focus: 'falso-cognato', notes: '' }).success).toBe(
      false,
    );
    expect(vocabItemSchema.safeParse({ ...vocab, focus: 'falso-cognato', notes: 5 }).success).toBe(
      false,
    );
  });

  it('keeps the notes rule on bank vocab with level', () => {
    const r = bankVocabSchema.safeParse({ ...vocab, focus: 'falso-cognato', level: 'A2' });
    expect(lines(r)).toEqual(['notes: Falso cognato precisa de "notes" com o aviso de cuidado.']);
  });
});

describe('sentence example/emoji — edges', () => {
  it('rejects null example and blank example text with PT-BR message', () => {
    expect(sentenceSchema.safeParse({ ...sentence, example: null }).success).toBe(false);
    const r = sentenceSchema.safeParse({ ...sentence, example: { en: '  ', pt: 'Oi' } });
    expect(lines(r)).toEqual(['example › en: Texto vazio.']);
  });

  it('still rejects notes on sentences (only vocab has notes)', () => {
    expect(sentenceSchema.safeParse({ ...sentence, notes: 'x' }).success).toBe(false);
    expect(bankSentenceSchema.safeParse({ ...sentence, notes: 'x' }).success).toBe(false);
  });
});
