import type { GradeResult } from '../grading/grade';
import { buildExercises } from '../../test/fixtures/buildUnit';
import {
  answeredCounts,
  currentExercise,
  lessonProgress,
  lessonReducer,
  startLesson,
  summarize,
  type LessonState,
} from './engine';

const ok: GradeResult = { verdict: 'correct', correctAnswer: 'x' };
const almost: GradeResult = { verdict: 'almost', correctAnswer: 'x', note: 'typo' };
const bad: GradeResult = { verdict: 'wrong', correctAnswer: 'x' };

const exercises = buildExercises('l', 'item-a', 'item-b'); // 10 exercises
const start = (kind: 'lesson' | 'practice' = 'lesson', hearts = 5) =>
  startLesson({ lessonId: 'l', kind, exercises, hearts, nowMs: 1000 });

function play(state: LessonState, ...grades: GradeResult[]): LessonState {
  for (const grade of grades) {
    state = lessonReducer(state, { type: 'answer', grade });
    state = lessonReducer(state, { type: 'continue' });
  }
  return state;
}

describe('lesson engine', () => {
  it('starts answering the first exercise', () => {
    const s = start();
    expect(s.status).toBe('answering');
    expect(currentExercise(s)?.id).toBe('l-e1');
  });

  it('refuses to start without exercises and starts out of hearts at 0', () => {
    expect(() =>
      startLesson({ lessonId: 'l', kind: 'lesson', exercises: [], hearts: 5, nowMs: 0 }),
    ).toThrow();
    expect(start('lesson', 0).status).toBe('outOfHearts');
    expect(start('practice', 0).status).toBe('answering');
  });

  it('a perfect run finishes after all exercises', () => {
    const s = play(start(), ...Array(10).fill(ok));
    expect(s.status).toBe('finished');
    const sum = summarize(s, 61_000);
    expect(sum).toMatchObject({ accuracy: 1, perfect: true, mistakes: 0, durationMs: 60_000 });
    expect(sum.xp).toBe(10 + 5 + 2); // base + perfect + 2 combos of 5
  });

  it('shows feedback before moving on, and ignores out-of-order actions', () => {
    let s = start();
    s = lessonReducer(s, { type: 'continue' });
    expect(s.status).toBe('answering');
    s = lessonReducer(s, { type: 'answer', grade: ok });
    expect(s.status).toBe('feedback');
    expect(s.lastGrade).toEqual(ok);
    expect(lessonReducer(s, { type: 'answer', grade: bad })).toBe(s); // double "Verificar"
  });

  it('a wrong exercise comes back at the end, only once', () => {
    let s = play(start(), bad);
    expect(s.queue.at(-1)).toBe(0);
    expect(s.queue).toHaveLength(10);
    s = play(s, ...Array(9).fill(ok));
    expect(currentExercise(s)?.id).toBe('l-e1');
    s = play(s, bad); // wrong again: not re-queued a second time
    expect(s.status).toBe('finished');
    expect(summarize(s, 2000)).toMatchObject({ mistakes: 2, perfect: false, accuracy: 0.9 });
  });

  it('loses hearts on mistakes and stops when they run out', () => {
    let s = start('lesson', 2);
    s = play(s, bad);
    expect(s.hearts).toBe(1);
    s = lessonReducer(s, { type: 'answer', grade: bad });
    expect(s.status).toBe('feedback'); // learner still sees the correct answer
    s = lessonReducer(s, { type: 'continue' });
    expect(s.status).toBe('outOfHearts');
  });

  it('practice never spends hearts', () => {
    const s = play(start('practice', 1), bad, bad, bad);
    expect(s.hearts).toBe(1);
    expect(s.status).toBe('answering');
  });

  it('combo resets on mistakes and the bonus is capped', () => {
    let s = play(start(), ok, ok, ok, ok, bad);
    expect(s.combo).toBe(0);
    expect(s.comboBonus).toBe(0);
    s = play(s, ok, ok, ok, ok, ok);
    expect(s.comboBonus).toBe(1);
  });

  it('skip removes the exercise without counting it', () => {
    let s = lessonReducer(start(), { type: 'skip' });
    expect(currentExercise(s)?.id).toBe('l-e2');
    expect(lessonProgress(s)).toEqual({ done: 0, total: 9 });
    s = play(s, ...Array(9).fill(ok));
    expect(s.status).toBe('finished');
    expect(summarize(s, 2000).accuracy).toBe(1);
  });

  it('progress counts distinct solved exercises', () => {
    let s = play(start(), bad, ok);
    expect(lessonProgress(s)).toEqual({ done: 1, total: 10 });
    s = play(s, ...Array(9).fill(ok));
    expect(lessonProgress(s)).toEqual({ done: 10, total: 10 });
  });

  it('derives SRS quality per item', () => {
    // item-a: e1 multiple-choice, item-b: e2 word-bank
    let s = play(start(), almost, bad);
    s = play(s, ...Array(8).fill(ok), ok); // e2 comes back and is solved
    const q = Object.fromEntries(summarize(s, 0).itemOutcomes.map((o) => [o.itemId, o.q]));
    expect(q['item-b']).toBe(2);
    expect(q['item-a']).toBe(4);
  });

  it('item never solved gets quality 1', () => {
    const one = startLesson({
      lessonId: 'l',
      kind: 'lesson',
      exercises: exercises.slice(0, 1),
      hearts: 5,
      nowMs: 0,
    });
    const s = play(one, bad, bad);
    expect(summarize(s, 0).itemOutcomes).toEqual([{ itemId: 'item-a', q: 1 }]);
  });

  it('state survives a JSON round-trip (sessionStorage)', () => {
    const s = play(start(), ok, bad);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('placement mode (no feedback)', () => {
  const placement = () =>
    startLesson({ lessonId: 'placement', kind: 'placement', exercises, hearts: 0, nowMs: 1000 });
  const answer = (s: LessonState, grade: GradeResult) =>
    lessonReducer(s, { type: 'answer', grade });

  it('never shows feedback nor re-queues mistakes, and ignores hearts', () => {
    let s = placement();
    expect(s.status).toBe('answering');
    s = answer(s, bad);
    expect(s.status).toBe('answering');
    expect(s.queue).toHaveLength(exercises.length - 1);
    expect(s.mistakes).toBe(0);
    expect(s.combo).toBe(0);
    s = answer(s, almost);
    s = answer(s, ok);
    expect(answeredCounts(s)).toEqual({ correct: 2, answered: 3 });
  });

  it('skip leaves the denominator and the run finishes after the last answer', () => {
    let s = placement();
    s = lessonReducer(s, { type: 'skip' });
    for (let i = 1; i < exercises.length; i++) s = answer(s, ok);
    expect(s.status).toBe('finished');
    expect(answeredCounts(s)).toEqual({
      correct: exercises.length - 1,
      answered: exercises.length - 1,
    });
    expect(summarize(s, 2000).xp).toBe(0);
  });

  it('continue does nothing in this mode', () => {
    const s = answer(placement(), ok);
    expect(lessonReducer(s, { type: 'continue' })).toBe(s);
  });
});
