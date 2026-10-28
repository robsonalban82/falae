import { buildCourse } from './course';
import { exerciseSchema, formatIssues, unitSchema, vocabItemSchema } from './schema';
import { buildUnit } from '../test/fixtures/buildUnit';

type AnyRecord = Record<string, unknown>;
const clone = <T>(v: T): T => structuredClone(v);

const translate = (accepted: unknown) => ({
  id: 'x-e1',
  type: 'translate-typing',
  itemIds: ['x'],
  promptEn: 'Hi',
  accepted,
});

describe('content schema — wrong types and odd values', () => {
  it('rejects wrong primitive types with a path in the message', () => {
    const unit = buildUnit(1, { order: '1' });
    const r = unitSchema.safeParse(unit);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(formatIssues(r.error).join('\n')).toMatch(/^order: /m);
  });

  it('rejects non-integer, zero and negative unit order', () => {
    for (const order of [1.5, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(unitSchema.safeParse(buildUnit(1, { order })).success, String(order)).toBe(false);
    }
  });

  it('rejects whitespace-only text and trims accepted text', () => {
    expect(unitSchema.safeParse(buildUnit(1, { title: '   ' })).success).toBe(false);
    const r = unitSchema.safeParse(buildUnit(1, { title: '  Unidade  ' }));
    expect(r.success && r.data.title).toBe('Unidade');
  });

  it('rejects unknown exercise types with a readable error', () => {
    const r = exerciseSchema.safeParse({ id: 'x-e1', type: 'drag-drop', itemIds: ['x'] });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(formatIssues(r.error)[0]).toMatch(/^type: /);
  });

  it('rejects null, arrays and primitives as a unit', () => {
    for (const v of [null, undefined, [], 42, 'unit', true]) {
      expect(unitSchema.safeParse(v).success).toBe(false);
    }
  });

  it('formatIssues reports root-level problems as "(raiz)"', () => {
    const r = unitSchema.safeParse(null);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(formatIssues(r.error)[0]).toMatch(/^\(raiz\): /);
  });

  it('rejects ids with accents, uppercase, underscores or double dashes', () => {
    for (const id of ['ação', 'U1-hello', 'u1_hello', 'u1--hello', '-u1', 'u1-', '']) {
      expect(unitSchema.safeParse(buildUnit(1, { id })).success, id).toBe(false);
    }
  });

  it('rejects difficulty outside 1..3 and unknown focus tags', () => {
    const base = {
      id: 'x',
      en: 'hi',
      pt: ['oi'],
      example: { en: 'Hi!', pt: 'Oi!' },
      difficulty: 1,
    };
    expect(vocabItemSchema.safeParse(base).success).toBe(true);
    expect(vocabItemSchema.safeParse({ ...base, difficulty: 4 }).success).toBe(false);
    expect(vocabItemSchema.safeParse({ ...base, difficulty: '1' }).success).toBe(false);
    expect(vocabItemSchema.safeParse({ ...base, focus: 'gramatica' }).success).toBe(false);
    expect(vocabItemSchema.safeParse({ ...base, pt: [] }).success).toBe(false);
  });

  it('requires at least one accepted pattern on translate-typing', () => {
    expect(exerciseSchema.safeParse(translate([])).success).toBe(false);
    expect(exerciseSchema.safeParse(translate('Oi')).success).toBe(false);
  });

  it('rejects patterns that blow the expansion limit', () => {
    const huge = Array.from({ length: 7 }, () => '[a|b]').join(' ');
    const r = exerciseSchema.safeParse(translate([huge]));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/mais de 64/);
  });

  it('multiple-choice answer match ignores case and outer spaces; duplicate options are caught case-insensitively', () => {
    const mc = (options: string[], answer: string) => ({
      id: 'x-e1',
      type: 'multiple-choice',
      itemIds: ['x'],
      prompt: 'p',
      options: options.map((text) => ({ text })),
      answer,
    });
    expect(exerciseSchema.safeParse(mc(['Hello', 'bye', 'thanks'], ' hello ')).success).toBe(true);
    expect(exerciseSchema.safeParse(mc(['Hello', 'hello', 'thanks'], 'thanks')).success).toBe(
      false,
    );
    expect(exerciseSchema.safeParse(mc(['a', 'b'], 'a')).success).toBe(false);
    expect(exerciseSchema.safeParse(mc(['a', 'b', 'c', 'd', 'e'], 'a')).success).toBe(false);
  });

  it('word-bank: distractor check is case-insensitive', () => {
    const r = exerciseSchema.safeParse({
      id: 'x-e2',
      type: 'word-bank',
      itemIds: ['x'],
      promptPt: 'Eu sou Ana.',
      answer: "I'm Ana.",
      distractors: ["I'M", 'is'],
    });
    expect(r.success).toBe(false);
  });

  it('itemIds must not be empty', () => {
    const r = exerciseSchema.safeParse({ id: 'x-e4', type: 'speak', itemIds: [], textEn: 'Hi' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/itemIds/);
  });
});

/** Gaps found by QA in the first round; fixed by the developer and kept as regression tests. */
describe('content schema — gaps found by QA (now fixed)', () => {
  it('rejects an accepted pattern that expands to no answer at all, e.g. "()"', () => {
    for (const p of ['()', '[|]', '( )']) {
      const r = exerciseSchema.safeParse(translate([p]));
      expect(r.success, p).toBe(false);
      expect(r.error?.issues[0]?.message).toMatch(/não gera nenhuma resposta/);
    }
  });

  it('rejects unknown/misspelled keys instead of silently dropping them', () => {
    // A typo like "acceptedPT" makes the alternative answers vanish without any warning.
    const base = {
      id: 'x',
      en: 'hi',
      pt: ['oi'],
      example: { en: 'Hi!', pt: 'Oi!' },
      difficulty: 1,
    };
    expect(vocabItemSchema.safeParse({ ...base, acceptedPT: ['[oi|olá]'] }).success).toBe(false);
  });

  it('rejects duplicate options in fill-blank (fixed after QA report)', () => {
    const r = exerciseSchema.safeParse({
      id: 'x-e3',
      type: 'fill-blank',
      itemIds: ['x'],
      sentence: 'I ___ Ana.',
      options: ['am', 'Am', 'is'],
      answer: 'am',
      translationPt: 'Eu sou Ana.',
    });
    expect(r.success).toBe(false);
  });
});

describe('buildCourse — edge inputs', () => {
  it('handles an empty list', () => {
    const { course, errors } = buildCourse([]);
    expect(errors).toEqual([]);
    expect(course.units).toEqual([]);
    expect(course.items.size).toBe(0);
    expect(course.lessons.size).toBe(0);
  });

  it('drops non-object entries and labels them by position', () => {
    const { course, errors } = buildCourse([null, 42, 'oops', undefined, [], buildUnit(1)]);
    expect(course.units).toHaveLength(1);
    const text = errors.join('\n');
    for (const n of [1, 2, 3, 4, 5]) expect(text).toContain(`[unidade #${n}]`);
    expect(text).not.toContain('[unidade #6]');
  });

  it('labels a broken unit by its id even when the id itself is not a string', () => {
    const { errors } = buildCourse([{ id: 7 }]);
    expect(errors.join('\n')).toContain('[unidade #1]');
  });

  it('rejects two units with the same order and keeps the first', () => {
    const { course, errors } = buildCourse([buildUnit(1), buildUnit(2, { order: 1 })]);
    expect(course.units.map((u) => u.id)).toEqual(['t1-unit']);
    expect(errors.join('\n')).toMatch(/Ordem de unidade repetida: 1/);
  });

  it('rejects extra fields (strict schema) and names where they are', () => {
    const unit = clone(buildUnit(1)) as AnyRecord;
    unit.secret = 'x';
    const vocab = ((unit.skills as AnyRecord[])[0]!.vocab as AnyRecord[])[0]!;
    vocab.kind = 'sentence'; // would otherwise clash with the index discriminator
    const { course, errors } = buildCourse([unit]);
    expect(course.units).toHaveLength(0);
    const text = errors.join('\n');
    expect(text).toContain('[t1-unit]');
    expect(text).toMatch(/secret/);
    expect(text).toMatch(/skills › 0 › vocab › 0/);
  });

  it('rejects an extra field deep inside an exercise', () => {
    const unit = clone(buildUnit(1)) as AnyRecord;
    const ex = (
      ((unit.skills as AnyRecord[])[0]!.lessons as AnyRecord[])[0]!.exercises as AnyRecord[]
    )[0]!;
    ex.answr = 'hello';
    expect(buildCourse([unit]).course.units).toHaveLength(0);
  });

  it('the shared fixture itself stays valid under the strict schema', () => {
    expect(buildCourse([buildUnit(1), buildUnit(2)]).errors).toEqual([]);
  });

  it('does not mutate the raw input', () => {
    const raw = buildUnit(1);
    const snapshot = clone(raw);
    buildCourse([raw]);
    expect(raw).toEqual(snapshot);
  });

  it('detects a lesson id colliding with an item id inside one unit', () => {
    const unit = clone(buildUnit(1)) as AnyRecord;
    const skill = (unit.skills as AnyRecord[])[0]!;
    (skill.lessons as AnyRecord[])[0]!.id = 't1-sk1-word';
    const { course, errors } = buildCourse([unit]);
    expect(course.units).toHaveLength(0);
    expect(errors.join('\n')).toMatch(/Id duplicado "t1-sk1-word"/);
  });

  it('indexes review and skill lessons with correct positions', () => {
    const { course } = buildCourse([buildUnit(1)]);
    // 4 skills × 3 lessons + 1 review
    expect(course.lessons.size).toBe(13);
    expect(course.lessons.get('t1-sk4-l3')).toMatchObject({ index: 2, skill: { id: 't1-sk4' } });
    expect(course.lessons.get('t1-review')).toMatchObject({ index: -1, skill: null });
    // 4 skills × (1 vocab + 1 sentence)
    expect(course.items.size).toBe(8);
  });
});
