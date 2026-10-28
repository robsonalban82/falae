import type { GradeResult } from '../grading/grade';
import { buildExercises } from '../../test/fixtures/buildUnit';
import {
  currentExercise,
  lessonProgress,
  lessonReducer,
  startLesson,
  summarize,
  type LessonState,
} from './engine';
import { sessionXp } from '../gamification/xp';

/** QA edge cases for the lesson state machine. */

const ok: GradeResult = { verdict: 'correct', correctAnswer: 'x' };
const almost: GradeResult = { verdict: 'almost', correctAnswer: 'x', note: 'typo' };
const bad: GradeResult = { verdict: 'wrong', correctAnswer: 'x' };
const exercises = buildExercises('l', 'item-a', 'item-b'); // 10
const start = (hearts = 5, kind: 'lesson' | 'review' | 'practice' = 'lesson') =>
  startLesson({ lessonId: 'l', kind, exercises, hearts, nowMs: 1000 });
const answer = (s: LessonState, grade: GradeResult) => lessonReducer(s, { type: 'answer', grade });
const cont = (s: LessonState) => lessonReducer(s, { type: 'continue' });
const play = (s: LessonState, ...g: GradeResult[]) => g.reduce((acc, x) => cont(answer(acc, x)), s);

describe('engine — edge cases', () => {
  it('double "Verificar" (two answer actions) counts once: one heart, one mistake', () => {
    let s = answer(start(), bad);
    s = answer(s, bad);
    expect(s.hearts).toBe(4);
    expect(s.mistakes).toBe(1);
    expect(s.queue.filter((i) => i === 0)).toHaveLength(2); // current + one re-queue
  });

  it('double "Continuar" advances only one exercise', () => {
    let s = answer(start(), ok);
    s = cont(cont(s));
    expect(currentExercise(s)?.id).toBe(exercises[1]!.id);
    expect(s.status).toBe('answering');
  });

  it('wrong on the last exercise brings it back immediately, then finishes', () => {
    let s = play(start(), ...Array(9).fill(ok));
    s = play(s, bad);
    expect(s.status).toBe('answering');
    expect(currentExercise(s)?.id).toBe(exercises[9]!.id);
    s = play(s, bad); // second miss: not re-queued again
    expect(s.status).toBe('finished');
  });

  it('a retried exercise answered right counts for progress but not first-try accuracy', () => {
    let s = play(start(), bad, ...Array(9).fill(ok));
    expect(lessonProgress(s)).toEqual({ done: 9, total: 10 });
    s = play(s, ok);
    expect(s.status).toBe('finished');
    const sum = summarize(s, 61_000);
    expect(sum.accuracy).toBeCloseTo(0.9);
    expect(sum.perfect).toBe(false);
    expect(sum.durationMs).toBe(60_000);
  });

  it('"almost" keeps the combo and does not cost a heart, but marks q=4', () => {
    const s = play(start(), almost, ...Array(9).fill(ok));
    expect(s.hearts).toBe(5);
    expect(s.combo).toBe(10);
    expect(s.status).toBe('finished');
    const sum = summarize(s, 2000);
    expect(sum.perfect).toBe(true);
    expect(sum.itemOutcomes.find((o) => o.itemId === 'item-a')?.q).toBe(4);
  });

  it('with 1 heart, a mistake shows feedback first, then the out-of-hearts screen', () => {
    let s = answer(start(1), bad);
    expect(s.status).toBe('feedback');
    expect(s.lastGrade?.verdict).toBe('wrong');
    s = cont(s);
    expect(s.status).toBe('outOfHearts');
    expect(answer(s, ok)).toBe(s);
    expect(lessonReducer(s, { type: 'skip' })).toBe(s);
  });

  it('losing the last heart on the very last exercise still ends out of hearts (no finish)', () => {
    let s = play(start(1), ...Array(9).fill(ok));
    s = play(s, bad);
    expect(s.status).toBe('outOfHearts');
  });

  it('review lessons spend hearts; practice does not even at 0', () => {
    expect(answer(start(5, 'review'), bad).hearts).toBe(4);
    const p = start(0, 'practice');
    expect(p.status).toBe('answering');
    expect(cont(answer(p, bad)).status).toBe('answering');
  });

  it('negative hearts input is treated as out of hearts', () => {
    expect(start(-2).status).toBe('outOfHearts');
  });

  it('skipping everything finishes with full accuracy and no item outcomes', () => {
    let s = start();
    while (s.status === 'answering') s = lessonReducer(s, { type: 'skip' });
    expect(s.status).toBe('finished');
    const sum = summarize(s, 1000);
    expect(sum.accuracy).toBe(1);
    expect(sum.itemOutcomes).toEqual([]);
    expect(lessonProgress(s).total).toBeGreaterThanOrEqual(1);
  });

  it('xp: perfect lesson = base + perfect bonus + combo bonus (2 combos in 10)', () => {
    const s = play(start(), ...Array(10).fill(ok));
    expect(summarize(s, 1000).xp).toBe(sessionXp('lesson', true, 2));
  });

  it('summarize does not report negative duration if the clock goes backwards', () => {
    const s = play(start(), ...Array(10).fill(ok));
    expect(summarize(s, 0).durationMs).toBe(0);
  });

  it('reducer never mutates the previous state', () => {
    const s0 = start();
    const snapshot = structuredClone(s0);
    play(s0, bad, ok, bad);
    expect(s0).toEqual(snapshot);
  });
});
