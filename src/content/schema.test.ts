import { buildCourse } from './course';
import { exerciseSchema, tokenizeForBank, unitSchema } from './schema';
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
