import { canOpenLesson, computePathState, type PathCourseInput } from './pathState';

/** 2 units × 2 skills × 3 lessons + review (ids: u1-s1-l1 … u1-review). */
function makeCourse(units = 2, skills = 2, lessons = 3): PathCourseInput {
  return {
    units: Array.from({ length: units }, (_, u) => ({
      id: `u${u + 1}`,
      skills: Array.from({ length: skills }, (_, s) => ({
        id: `u${u + 1}-s${s + 1}`,
        lessons: Array.from({ length: lessons }, (_, l) => ({
          id: `u${u + 1}-s${s + 1}-l${l + 1}`,
        })),
      })),
      reviewLesson: { id: `u${u + 1}-review` },
    })),
  };
}

const course = makeCourse();
const done = (...ids: string[]) => ids.map((lessonId) => ({ lessonId }));
const status = (state: ReturnType<typeof computePathState>, id: string) =>
  state.byLesson.get(id)?.status;
const unit1All = ['u1-s1-l1', 'u1-s1-l2', 'u1-s1-l3', 'u1-s2-l1', 'u1-s2-l2', 'u1-s2-l3'];

describe('computePathState', () => {
  it('empty course: no current lesson, nothing opens', () => {
    const state = computePathState({ units: [] }, []);
    expect(state).toMatchObject({ units: [], currentLessonId: null });
    expect(canOpenLesson(state, 'anything')).toBe(false);
  });

  it('first open: the first skill is open (first lesson current), everything else locked', () => {
    const state = computePathState(course, []);
    expect(state.currentLessonId).toBe('u1-s1-l1');
    expect(status(state, 'u1-s1-l1')).toBe('current');
    expect(status(state, 'u1-s1-l2')).toBe('available');
    expect(status(state, 'u1-s1-l3')).toBe('available');
    expect(status(state, 'u1-s2-l1')).toBe('locked');
    expect(status(state, 'u1-review')).toBe('locked');
    expect(status(state, 'u2-s1-l1')).toBe('locked');
    expect(state.units[0]).toMatchObject({ unlocked: true, completed: false });
    expect(state.units[1]?.unlocked).toBe(false);
    expect(state.units[0]?.skills[0]?.unlocked).toBe(true);
    expect(state.units[0]?.skills[1]?.unlocked).toBe(false);
    const current = [...state.byLesson.values()].filter((n) => n.status === 'current');
    expect(current).toHaveLength(1);
  });

  it('middle of a skill: next lesson becomes current, the rest stay available', () => {
    const state = computePathState(course, done('u1-s1-l1'));
    expect(status(state, 'u1-s1-l1')).toBe('completed');
    expect(state.currentLessonId).toBe('u1-s1-l2');
    expect(status(state, 'u1-s1-l3')).toBe('available');
    expect(status(state, 'u1-s2-l1')).toBe('locked');
    expect(state.units[0]?.skills[0]?.crowned).toBe(false);
  });

  it('a crown opens the next skill', () => {
    const state = computePathState(course, done('u1-s1-l1', 'u1-s1-l2', 'u1-s1-l3'));
    expect(state.units[0]?.skills[0]?.crowned).toBe(true);
    expect(state.units[0]?.skills[1]?.unlocked).toBe(true);
    expect(state.currentLessonId).toBe('u1-s2-l1');
    expect(status(state, 'u1-review')).toBe('locked');
  });

  it('review opens once every skill is crowned (4 crowns)', () => {
    const four = makeCourse(1, 4, 3);
    const lessons = (four.units[0]?.skills ?? []).flatMap((s) => s.lessons.map((l) => l.id));
    const almost = computePathState(four, done(...lessons.slice(0, -1)));
    expect(status(almost, 'u1-review')).toBe('locked');
    const state = computePathState(four, done(...lessons));
    expect(state.units[0]?.skills.every((s) => s.crowned)).toBe(true);
    expect(status(state, 'u1-review')).toBe('current');
    expect(state.byLesson.get('u1-review')).toMatchObject({ skillId: null, index: -1 });
  });

  it('completing the review opens the next unit', () => {
    const state = computePathState(course, done(...unit1All, 'u1-review'));
    expect(state.units[0]?.completed).toBe(true);
    expect(state.units[1]?.unlocked).toBe(true);
    expect(state.currentLessonId).toBe('u2-s1-l1');
    expect(canOpenLesson(state, 'u2-s1-l1')).toBe(true);
    expect(canOpenLesson(state, 'u2-s1-l2')).toBe(true);
    expect(canOpenLesson(state, 'u2-s2-l1')).toBe(false);
  });

  it('lessons of an open skill can be done in any order; the skill crowns when all are done', () => {
    const state = computePathState(course, done('u1-s1-l3'));
    expect(state.currentLessonId).toBe('u1-s1-l1');
    expect(status(state, 'u1-s1-l2')).toBe('available');
    expect(state.units[0]?.skills[1]?.unlocked).toBe(false);
    const crowned = computePathState(course, done('u1-s1-l3', 'u1-s1-l1', 'u1-s1-l2'));
    expect(crowned.units[0]?.skills[1]?.unlocked).toBe(true);
  });

  it('placement that skipped unit 1 marks it tested and opens unit 2', () => {
    const state = computePathState(course, [], { score: 0.9, skippedUnit1: true });
    expect(state.units[0]?.completed).toBe(true);
    expect(state.byLesson.get('u1-s1-l1')).toMatchObject({ status: 'completed', testedOut: true });
    expect(state.byLesson.get('u1-review')).toMatchObject({ status: 'completed', testedOut: true });
    expect(state.byLesson.get('u2-s1-l1')).toMatchObject({ status: 'current', testedOut: false });
  });

  it('placement that did not skip changes nothing', () => {
    const state = computePathState(course, [], { score: 0.2, skippedUnit1: false });
    expect(state.currentLessonId).toBe('u1-s1-l1');
  });

  it('out-of-order progress: completed never goes back to locked; unknown lessons are ignored', () => {
    const state = computePathState(course, done('u1-s2-l2', 'u2-s1-l1', 'ghost-lesson'));
    expect(status(state, 'u1-s2-l2')).toBe('completed');
    expect(status(state, 'u2-s1-l1')).toBe('completed');
    expect(state.currentLessonId).toBe('u1-s1-l1');
    expect(status(state, 'u1-s2-l1')).toBe('locked');
    expect(canOpenLesson(state, 'u1-s2-l2')).toBe(true);
    expect(canOpenLesson(state, 'ghost-lesson')).toBe(false);
    expect(state.byLesson.has('ghost-lesson')).toBe(false);
  });

  it('whole course completed: currentLessonId is null and everything opens', () => {
    const all = course.units.flatMap((u) => [
      ...u.skills.flatMap((s) => s.lessons.map((l) => l.id)),
      u.reviewLesson.id,
    ]);
    const state = computePathState(course, done(...all));
    expect(state.currentLessonId).toBeNull();
    expect(state.units.every((u) => u.completed)).toBe(true);
    expect(all.every((id) => canOpenLesson(state, id))).toBe(true);
  });

  it('repeated progress rows are harmless', () => {
    const state = computePathState(course, done('u1-s1-l1', 'u1-s1-l1'));
    expect(state.currentLessonId).toBe('u1-s1-l2');
  });
});
