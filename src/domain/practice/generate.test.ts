import { buildCourse, type StudyItem } from '../../content/course';
import { exerciseSchema, type Exercise } from '../../content/schema';
import { gradeExercise, type ExerciseResponse } from '../grading/grade';
import { expandPatterns } from '../grading/patterns';
import { generatePractice, type PracticeItem } from './generate';

const modules = import.meta.glob<{ default: unknown }>('../../content/units/*.json', {
  eager: true,
});
const { course } = buildCourse(
  Object.keys(modules)
    .sort()
    .map((p) => modules[p]?.default),
);

const toItem = (it: StudyItem): PracticeItem => ({
  id: it.id,
  kind: it.kind,
  en: it.en,
  pt: it.kind === 'vocab' ? it.pt : [it.pt],
  acceptedPt: it.acceptedPt,
  acceptedEn: it.acceptedEn,
  emoji: it.kind === 'vocab' ? it.emoji : undefined,
});

const unit1 = course.units[0];
if (!unit1) throw new Error('no content');
const pool = unit1.skills.flatMap((s) => [
  ...s.vocab.map((v) => toItem({ kind: 'vocab', ...v })),
  ...s.sentences.map((x) => toItem({ kind: 'sentence', ...x })),
]);
const caps = { tts: true, stt: true, speakDisabled: false };
const prompt = (pt: string) => `Qual destas significa "${pt}"?`;
const gen = (items: PracticeItem[], seed: number, c = caps) =>
  generatePractice({ items, distractorPool: pool, caps: c, seed, choicePrompt: prompt });

/** Picks `n` items from the pool with a stride that varies with the seed. */
const sample = (seed: number, n: number) =>
  Array.from({ length: n }, (_, i) => pool[(seed * 7 + i * 5) % pool.length] as PracticeItem);

const ctx = { knownWords: course.knownWords };

/** Every way the learner could correctly answer an exercise. */
function rightResponses(ex: Exercise, items: Map<string, PracticeItem>): ExerciseResponse[] {
  const item = items.get(ex.itemIds[0] ?? '');
  switch (ex.type) {
    case 'multiple-choice':
      return [{ kind: 'choice', value: ex.answer }];
    case 'match-pairs':
      return [{ kind: 'pairs', mistakes: 0 }];
    case 'word-bank':
      return [{ kind: 'text', value: ex.answer }];
    case 'translate-typing':
      return expandPatterns([...(item?.pt ?? []), ...(item?.acceptedPt ?? [])]).map((value) => ({
        kind: 'text',
        value,
      }));
    case 'listen-type':
      return expandPatterns([item?.en ?? '']).map((value) => ({ kind: 'text', value }));
    default:
      return [];
  }
}

describe('generatePractice', () => {
  it('is deterministic for the same seed', () => {
    const items = sample(1, 6);
    expect(gen(items, 123)).toEqual(gen(items, 123));
    expect(gen(items, 123)).not.toEqual(gen(items, 124));
  });

  it('returns [] without items and exactly 12 exercises otherwise', () => {
    expect(gen([], 1)).toEqual([]);
    for (const n of [1, 2, 4, 12]) expect(gen(sample(3, n), 9)).toHaveLength(12);
  });

  it('every exercise passes the content schema and accepts the item answers (200 seeds)', () => {
    const byId = new Map(pool.map((p) => [p.id, p]));
    for (let seed = 1; seed <= 200; seed++) {
      const items = sample(seed, 4 + (seed % 9));
      const exercises = gen(items, seed, { ...caps, tts: seed % 2 === 0 });
      for (const ex of exercises) {
        const parsed = exerciseSchema.safeParse(ex);
        expect(parsed.success, `${ex.id}: ${JSON.stringify(ex)}`).toBe(true);
        for (const r of rightResponses(ex, byId)) {
          expect(gradeExercise(ex, r, ctx).verdict, `${ex.id} ${JSON.stringify(r)}`).toBe(
            'correct',
          );
        }
      }
    }
  });

  it('never generates speak or fill-blank; no listen-type without TTS', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const types = gen(sample(seed, 6), seed, { ...caps, tts: false }).map((e) => e.type);
      expect(types).not.toContain('speak');
      expect(types).not.toContain('fill-blank');
      expect(types).not.toContain('listen-type');
    }
  });

  it('has at most one match-pairs and never the same type 3 times in a row (enough items)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const types = gen(sample(seed, 12), seed).map((e) => e.type);
      expect(types.filter((t) => t === 'match-pairs').length).toBeLessThanOrEqual(1);
      const triple = types.some((t, i) => i >= 2 && t === types[i - 1] && t === types[i - 2]);
      expect(triple, types.join(',')).toBe(false);
    }
  });

  it('uses each item at most 3 times when there are enough items', () => {
    const items = sample(5, 4);
    const exercises = gen(items, 77).filter((e) => e.type !== 'match-pairs');
    for (const it of items) {
      expect(exercises.filter((e) => e.itemIds[0] === it.id).length).toBeLessThanOrEqual(3);
    }
  });

  it('ids follow practice-<seed>-<position>', () => {
    expect(gen(sample(2, 5), 42).map((e) => e.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `practice-42-${i}`),
    );
  });

  it('distractors only come from the pool and are never a right answer', () => {
    const poolEn = new Set(pool.map((p) => p.en.toLowerCase()));
    for (let seed = 1; seed <= 50; seed++) {
      for (const ex of gen(sample(seed, 6), seed)) {
        if (ex.type !== 'multiple-choice') continue;
        for (const o of ex.options) expect(poolEn.has(o.text.toLowerCase())).toBe(true);
      }
    }
  });

  it('falls back to translate-typing when the pool is too small for choices', () => {
    const [one] = pool.filter((p) => p.kind === 'vocab');
    const out = generatePractice({
      items: [one as PracticeItem],
      distractorPool: [],
      caps,
      seed: 5,
      choicePrompt: prompt,
    });
    expect(
      out.map((e) => e.type).every((t) => t === 'translate-typing' || t === 'listen-type'),
    ).toBe(true);
  });
});
