import { buildCourse } from './course';
import {
  bankSentenceSchema,
  bankVocabSchema,
  exerciseSchema,
  formatIssues,
  sentenceSchema,
  tokenizeForBank,
  unitSchema,
  vocabItemSchema,
} from './schema';
import { buildUnit } from '../test/fixtures/buildUnit';

type AnyRecord = Record<string, unknown>;
const clone = <T>(v: T): T => structuredClone(v);
function firstLesson(unit: AnyRecord) {
  return (unit.skills as AnyRecord[])[0]!.lessons as AnyRecord[];
}

describe('content schema', () => {
  it('accepts a valid unit', () => {
    expect(unitSchema.safeParse(buildUnit()).success).toBe(true);
  });

  it('requires 4 skills and 3 lessons per skill', () => {
    const unit = buildUnit() as AnyRecord;
    unit.skills = (unit.skills as unknown[]).slice(0, 3);
    const result = unitSchema.safeParse(unit);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('4 habilidades');
  });

  it('requires 10 to 15 exercises per lesson', () => {
    const unit = buildUnit() as AnyRecord;
    const lessons = firstLesson(unit);
    lessons[0]!.exercises = (lessons[0]!.exercises as unknown[]).slice(0, 9);
    expect(unitSchema.safeParse(unit).success).toBe(false);
  });

  it('rejects ids that are not kebab-case', () => {
    expect(unitSchema.safeParse(buildUnit(1, { id: 'Unit One' })).success).toBe(false);
  });

  it('rejects a multiple-choice answer missing from options', () => {
    const r = exerciseSchema.safeParse({
      id: 'x-e1',
      type: 'multiple-choice',
      itemIds: ['x'],
      prompt: 'p',
      options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
      answer: 'd',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/entre as opções/);
  });

  it('rejects a word-bank distractor that is part of the answer', () => {
    const r = exerciseSchema.safeParse({
      id: 'x-e2',
      type: 'word-bank',
      itemIds: ['x'],
      promptPt: 'Eu sou Ana.',
      answer: "I'm Ana.",
      distractors: ['ana', 'is'],
    });
    expect(r.success).toBe(false);
  });

  it('rejects fill-blank without exactly one blank', () => {
    const base = {
      id: 'x-e3',
      type: 'fill-blank',
      itemIds: ['x'],
      options: ['in', 'on', 'at'],
      answer: 'at',
      translationPt: 'Às cinco.',
    };
    expect(exerciseSchema.safeParse({ ...base, sentence: 'at five' }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...base, sentence: '___ five ___' }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...base, sentence: '___ five' }).success).toBe(true);
  });

  it('rejects ambiguous match pairs', () => {
    const r = exerciseSchema.safeParse({
      id: 'x-e4',
      type: 'match-pairs',
      itemIds: ['x'],
      pairs: [
        { en: 'hi', pt: 'oi' },
        { en: 'hello', pt: 'oi' },
        { en: 'bye', pt: 'tchau' },
        { en: 'thanks', pt: 'obrigado' },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rejects malformed answer patterns with a readable message', () => {
    const r = exerciseSchema.safeParse({
      id: 'x-e5',
      type: 'translate-typing',
      itemIds: ['x'],
      promptEn: 'Hi',
      accepted: ['(Oi'],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/Faltou fechar/);
  });

  it('tokenizes word-bank answers keeping apostrophes', () => {
    expect(tokenizeForBank("I'm thirty, okay?")).toEqual(["I'm", 'thirty', 'okay']);
  });
});

describe('buildCourse', () => {
  it('indexes items and lessons and sorts units by order', () => {
    const { course, errors } = buildCourse([buildUnit(2), buildUnit(1)]);
    expect(errors).toEqual([]);
    expect(course.units.map((u) => u.order)).toEqual([1, 2]);
    expect(course.items.get('t1-sk1-word')?.kind).toBe('vocab');
    expect(course.lessons.get('t2-sk3-l2')?.index).toBe(1);
    expect(course.lessons.get('t1-review')?.skill).toBeNull();
  });

  it('drops invalid units and reports why', () => {
    const bad = clone(buildUnit(2)) as AnyRecord;
    bad.color = 'roxo';
    const { course, errors } = buildCourse([buildUnit(1), bad]);
    expect(course.units).toHaveLength(1);
    expect(errors.join('\n')).toContain('[t2-unit]');
  });

  it('rejects duplicate ids across units', () => {
    const { course, errors } = buildCourse([buildUnit(1), buildUnit(1, { order: 2 })]);
    expect(course.units).toHaveLength(1);
    expect(errors.join('\n')).toMatch(/Id duplicado/);
  });

  it('rejects references to unknown items', () => {
    const unit = clone(buildUnit(1)) as AnyRecord;
    const ex = (firstLesson(unit)[0]!.exercises as AnyRecord[])[0]!;
    ex.itemIds = ['nao-existe'];
    const { errors } = buildCourse([unit]);
    expect(errors.join('\n')).toMatch(/nao-existe/);
  });
});

const vocab = {
  id: 'x-word',
  en: 'actually',
  pt: ['na verdade'],
  example: { en: 'Actually, I am tired.', pt: 'Na verdade, estou cansado.' },
  difficulty: 1,
};
const sentence = { id: 'x-s-hi', en: 'Hi, Ana!', pt: 'Oi, Ana!', difficulty: 1 };
const messages = (r: { success: boolean; error?: Parameters<typeof formatIssues>[0] }) =>
  r.error ? formatIssues(r.error).join('\n') : '';

describe('content schema — CEFR level and optional item fields', () => {
  it('rejects a unit without level with a helpful message', () => {
    const unit = buildUnit() as AnyRecord;
    delete unit.level;
    const r = unitSchema.safeParse(unit);
    expect(r.success).toBe(false);
    expect(messages(r)).toMatch(
      /^level: Informe o nível CEFR \(level\): A1, A2, B1, B2, C1, C2\.$/m,
    );
  });

  it('accepts every CEFR level on a unit and rejects unknown ones', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      expect(unitSchema.safeParse(buildUnit(1, { level })).success, level).toBe(true);
    }
    const r = unitSchema.safeParse(buildUnit(1, { level: 'B3' }));
    expect(r.success).toBe(false);
    expect(messages(r)).toMatch(/^level: Nível CEFR inválido/m);
  });

  it('accepts pronunciation on vocab and sentences', () => {
    expect(vocabItemSchema.safeParse({ ...vocab, pronunciation: 'ÉK-tchu-a-li' }).success).toBe(
      true,
    );
    expect(sentenceSchema.safeParse({ ...sentence, pronunciation: 'rai, ÉNA' }).success).toBe(true);
  });

  it('accepts a sentence with example and emoji', () => {
    const r = sentenceSchema.safeParse({
      ...sentence,
      emoji: '👋',
      example: { en: 'Hi, Ana! How are you?', pt: 'Oi, Ana! Tudo bem?' },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.example?.pt).toBe('Oi, Ana! Tudo bem?');
  });

  it('rejects level on unit items (they inherit the unit level)', () => {
    expect(vocabItemSchema.safeParse({ ...vocab, level: 'A2' }).success).toBe(false);
    expect(sentenceSchema.safeParse({ ...sentence, level: 'A2' }).success).toBe(false);
    const unit = buildUnit() as AnyRecord;
    const skill = (unit.skills as AnyRecord[])[0]!;
    (skill.vocab as AnyRecord[])[0]!.level = 'B1';
    const r = unitSchema.safeParse(unit);
    expect(r.success).toBe(false);
    expect(messages(r)).toBe(
      'skills › 0 › vocab › 0: Itens de unidade herdam o nível da unidade; "level" por item só vale nos bancos.',
    );
  });

  it('explains level and lists other unknown keys on unit items in PT-BR', () => {
    const r = sentenceSchema.safeParse({ ...sentence, level: 'A1', foo: 1 });
    expect(messages(r)).toBe(
      '(raiz): Itens de unidade herdam o nível da unidade; "level" por item só vale nos bancos. Campo desconhecido: "foo".',
    );
    expect(messages(vocabItemSchema.safeParse({ ...vocab, foo: 1 }))).toBe(
      '(raiz): Campo desconhecido: "foo".',
    );
  });

  it('accepts an optional level on bank items', () => {
    expect(bankVocabSchema.safeParse(vocab).success).toBe(true);
    expect(bankVocabSchema.safeParse({ ...vocab, level: 'B1' }).success).toBe(true);
    expect(bankSentenceSchema.safeParse({ ...sentence, level: 'A2' }).success).toBe(true);
    expect(bankSentenceSchema.safeParse({ ...sentence, level: 'Z9' }).success).toBe(false);
  });

  it('rejects a false friend without notes, in units and banks', () => {
    const falseFriend = { ...vocab, focus: 'falso-cognato' };
    for (const schema of [vocabItemSchema, bankVocabSchema]) {
      const r = schema.safeParse(falseFriend);
      expect(r.success).toBe(false);
      expect(messages(r)).toBe('notes: Falso cognato precisa de "notes" com o aviso de cuidado.');
      expect(
        schema.safeParse({ ...falseFriend, notes: '"Actually" não é "atualmente".' }).success,
      ).toBe(true);
    }
  });

  it('reports the false-friend rule together with type errors on other fields', () => {
    const r = vocabItemSchema.safeParse({ ...vocab, focus: 'falso-cognato', difficulty: 9 });
    const lines = messages(r).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^difficulty: /);
    expect(lines[1]).toBe('notes: Falso cognato precisa de "notes" com o aviso de cuidado.');
  });

  it('does not crash or duplicate errors when focus, notes or the item are malformed', () => {
    expect(messages(vocabItemSchema.safeParse({ ...vocab, focus: 5 }))).toMatch(/^focus: /);
    const badNotes = messages(
      vocabItemSchema.safeParse({ ...vocab, focus: 'falso-cognato', notes: 5 }),
    );
    expect(badNotes.split('\n')).toHaveLength(1);
    expect(badNotes).toMatch(/^notes: /);
    for (const v of [null, 'x', 1, []]) {
      expect(bankVocabSchema.safeParse(v).success, String(v)).toBe(false);
    }
  });

  it('rejects empty emoji on vocab and sentences', () => {
    expect(vocabItemSchema.safeParse({ ...vocab, emoji: '' }).success).toBe(false);
    expect(sentenceSchema.safeParse({ ...sentence, emoji: '  ' }).success).toBe(false);
    expect(sentenceSchema.safeParse({ ...sentence, emoji: '👋' }).success).toBe(true);
  });

  it('reports a false friend without notes inside a unit', () => {
    const unit = buildUnit() as AnyRecord;
    const item = ((unit.skills as AnyRecord[])[2]!.vocab as AnyRecord[])[0]!;
    item.focus = 'falso-cognato';
    const r = unitSchema.safeParse(unit);
    expect(r.success).toBe(false);
    expect(messages(r)).toMatch(/^skills › 2 › vocab › 0 › notes: Falso cognato/m);
  });
});
