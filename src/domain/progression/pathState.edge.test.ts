import { describe, expect, it } from 'vitest';
import { canOpenLesson, computePathState, type PathCourseInput } from './pathState';

const unit = (u: number): PathCourseInput['units'][number] => ({
  id: `u${u}`,
  skills: [1, 2].map((k) => ({
    id: `u${u}-sk${k}`,
    lessons: [1, 2].map((l) => ({ id: `u${u}-sk${k}-l${l}` })),
  })),
  reviewLesson: { id: `u${u}-review` },
});
const course: PathCourseInput = { units: [unit(1), unit(2)] };
const p = (...ids: string[]) => ids.map((lessonId) => ({ lessonId }));

describe('pathState edge cases', () => {
  it('duplicated progress entries do not break anything', () => {
    const s = computePathState(course, p('u1-sk1-l1', 'u1-sk1-l1'));
    expect(s.currentLessonId).toBe('u1-sk1-l2');
  });
  it('exactly one current node', () => {
    const s = computePathState(course, p('u1-sk1-l1'));
    expect([...s.byLesson.values()].filter((n) => n.status === 'current')).toHaveLength(1);
  });
  it('refazer: completed lesson stays openable', () => {
    const s = computePathState(course, p('u1-sk1-l1'));
    expect(canOpenLesson(s, 'u1-sk1-l1')).toBe(true);
  });
  it('out-of-order import: completed far lesson opens, but gap before it stays reachable', () => {
    const s = computePathState(course, p('u2-sk2-l2'));
    expect(canOpenLesson(s, 'u2-sk2-l2')).toBe(true);
    expect(s.currentLessonId).toBe('u1-sk1-l1');
    expect(canOpenLesson(s, 'u2-sk1-l1')).toBe(false);
  });
  it('unknown / empty / weird ids are not openable', () => {
    const s = computePathState(course, p('ghost'));
    for (const id of ['ghost', '', 'U1-SK1-L1', ' u1-sk1-l1', '__proto__', 'constructor'])
      expect(canOpenLesson(s, id)).toBe(false);
  });
  it('placement skips unit 1 and makes u2 current; u1 nodes testedOut', () => {
    const s = computePathState(course, [], { score: 1, skippedUnit1: true });
    expect(s.currentLessonId).toBe('u2-sk1-l1');
    expect(s.byLesson.get('u1-review')?.testedOut).toBe(true);
    expect(s.units[0]?.completed).toBe(true);
  });
  it('placement without skip changes nothing', () => {
    const s = computePathState(course, [], { score: 0.2, skippedUnit1: false });
    expect(s.currentLessonId).toBe('u1-sk1-l1');
  });
  it('unit with zero skills: review becomes available directly', () => {
    const c: PathCourseInput = { units: [{ id: 'u1', skills: [], reviewLesson: { id: 'r' } }] };
    expect(computePathState(c, []).currentLessonId).toBe('r');
  });
  it('whole course done -> null current and everything openable', () => {
    const all = course.units.flatMap((u) => [
      ...u.skills.flatMap((k) => k.lessons.map((l) => l.id)),
      u.reviewLesson.id,
    ]);
    const s = computePathState(course, p(...all));
    expect(s.currentLessonId).toBeNull();
    for (const id of all) expect(canOpenLesson(s, id)).toBe(true);
  });
});
