import { buildCourse } from '../../content/course';
import type { Exercise } from '../../content/schema';
import { buildUnit } from '../../test/fixtures/buildUnit';
import {
  pickPlacementExercises,
  placementPassed,
  placementScore,
  PLACEMENT_SIZE,
} from './placement';

const caps = { tts: false, stt: false, speakDisabled: false };
const { course, errors } = buildCourse([buildUnit(1)]);
const unit = course.units[0];
if (!unit || errors.length) throw new Error(errors.join('\n'));

const lessonOf = (ex: Exercise) =>
  [...course.lessons.values()].find((r) => r.lesson.exercises.some((e) => e.id === ex.id));

describe('pickPlacementExercises', () => {
  it('picks 15: one per lesson in skill order, then 3 from the review', () => {
    const out = pickPlacementExercises(unit, caps, 42);
    expect(out).toHaveLength(PLACEMENT_SIZE);
    const refs = out.map(lessonOf);
    const order = [...unit.skills.flatMap((s) => s.lessons.map((l) => l.id)), unit.reviewLesson.id];
    const positions = refs.map((r) => order.indexOf(r?.lesson.id ?? ''));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(refs.slice(12).every((r) => r?.skill === null)).toBe(true);
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length);
  });

  it('never uses speak, listen-type or match-pairs, even with full speech support', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const types = pickPlacementExercises(
        unit,
        { tts: true, stt: true, speakDisabled: false },
        seed,
      ).map((e) => e.type);
      expect(types).not.toContain('speak');
      expect(types).not.toContain('listen-type');
      expect(types).not.toContain('match-pairs');
    }
  });

  it('is deterministic per seed and prefers different types between neighbours', () => {
    expect(pickPlacementExercises(unit, caps, 7)).toEqual(pickPlacementExercises(unit, caps, 7));
    const types = pickPlacementExercises(unit, caps, 7).map((e) => e.type);
    const repeats = types.filter((t, i) => i > 0 && t === types[i - 1]).length;
    expect(repeats).toBe(0);
  });

  it('borrows from the same skill when a lesson has nothing eligible; fewer only if the unit lacks', () => {
    const onlyAudio = (exs: readonly Exercise[]) => exs.filter((e) => e.type === 'speak');
    const [first, ...rest] = unit.skills;
    if (!first) throw new Error('fixture');
    const thin = {
      skills: [
        {
          lessons: [
            { exercises: onlyAudio(first.lessons[0]?.exercises ?? []) },
            ...first.lessons.slice(1),
          ],
        },
        ...rest,
      ],
      reviewLesson: { exercises: onlyAudio(unit.reviewLesson.exercises) },
    };
    const out = pickPlacementExercises(thin, caps, 3);
    expect(out).toHaveLength(12); // 12 lessons covered (one borrowed), review has nothing eligible
  });
});

describe('placementScore / placementPassed', () => {
  it('scores correct / answered and passes at 80%', () => {
    expect(placementScore({ correct: 12, answered: 15 })).toBe(0.8);
    expect(placementScore({ correct: 0, answered: 0 })).toBe(0);
    expect(placementPassed(0.8)).toBe(true);
    expect(placementPassed(11 / 15)).toBe(false);
  });
});
