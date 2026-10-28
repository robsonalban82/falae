import type { Exercise } from '../../content/schema';
import type { GradeResult } from '../grading/grade';
import { COMBO_STEP, MAX_COMBO_BONUS, sessionXp, type SessionKind } from '../gamification/xp';

/**
 * Pure lesson state machine (docs/ARQUITETURA.md §6). The UI dispatches answers and
 * "continue"; this module decides what comes next. State is plain JSON so it can be
 * saved to sessionStorage and restored after a reload.
 */

export type LessonStatus = 'answering' | 'feedback' | 'finished' | 'outOfHearts';

type ItemStat = { wrong: number; almost: boolean; finallyCorrect: boolean };

export type LessonState = {
  lessonId: string;
  kind: SessionKind;
  exercises: Exercise[];
  /** Indexes into `exercises`; head is the current exercise. */
  queue: number[];
  /** Exercises already re-queued after a mistake (each comes back once). */
  retried: number[];
  status: LessonStatus;
  /** Increments each time a new exercise is shown (UI uses it to reset inputs). */
  turn: number;
  lastGrade: GradeResult | null;
  /** Distinct exercises answered correctly at some point. */
  solved: number[];
  /** Distinct exercises answered wrong at least once. */
  missed: number[];
  skipped: number[];
  combo: number;
  comboBonus: number;
  mistakes: number;
  usesHearts: boolean;
  hearts: number;
  startedAt: number;
  itemStats: Record<string, ItemStat>;
};

export type LessonAction =
  | { type: 'answer'; grade: GradeResult }
  | { type: 'skip' } // e.g. "Não posso falar agora"
  | { type: 'continue' };

export function startLesson(input: {
  lessonId: string;
  kind: SessionKind;
  exercises: Exercise[];
  hearts: number;
  nowMs: number;
}): LessonState {
  if (input.exercises.length === 0) throw new Error('Lesson has no exercises');
  const usesHearts = input.kind === 'lesson' || input.kind === 'review';
  return {
    lessonId: input.lessonId,
    kind: input.kind,
    exercises: input.exercises,
    queue: input.exercises.map((_, i) => i),
    retried: [],
    status: usesHearts && input.hearts <= 0 ? 'outOfHearts' : 'answering',
    turn: 0,
    lastGrade: null,
    solved: [],
    missed: [],
    skipped: [],
    combo: 0,
    comboBonus: 0,
    mistakes: 0,
    usesHearts,
    hearts: input.hearts,
    startedAt: input.nowMs,
    itemStats: {},
  };
}

export function currentExercise(state: LessonState): Exercise | null {
  const index = state.queue[0];
  return index === undefined ? null : (state.exercises[index] ?? null);
}

const addUnique = (list: number[], value: number) =>
  list.includes(value) ? list : [...list, value];

export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  const index = state.queue[0];
  const exercise = index === undefined ? undefined : state.exercises[index];

  switch (action.type) {
    case 'answer': {
      if (state.status !== 'answering' || index === undefined || !exercise) return state;
      const ok = action.grade.verdict !== 'wrong';
      const itemStats = { ...state.itemStats };
      for (const itemId of exercise.itemIds) {
        const prev = itemStats[itemId] ?? { wrong: 0, almost: false, finallyCorrect: false };
        itemStats[itemId] = ok
          ? {
              ...prev,
              almost: prev.almost || action.grade.verdict === 'almost',
              finallyCorrect: true,
            }
          : { ...prev, wrong: prev.wrong + 1, finallyCorrect: false };
      }

      if (ok) {
        const combo = state.combo + 1;
        const comboBonus =
          combo % COMBO_STEP === 0
            ? Math.min(MAX_COMBO_BONUS, state.comboBonus + 1)
            : state.comboBonus;
        return {
          ...state,
          status: 'feedback',
          lastGrade: action.grade,
          solved: addUnique(state.solved, index),
          combo,
          comboBonus,
          itemStats,
        };
      }

      const requeue = !state.retried.includes(index);
      return {
        ...state,
        status: 'feedback',
        lastGrade: action.grade,
        missed: addUnique(state.missed, index),
        // The wrong exercise goes back to the end of the queue, once.
        queue: requeue ? [...state.queue, index] : state.queue,
        retried: requeue ? [...state.retried, index] : state.retried,
        combo: 0,
        mistakes: state.mistakes + 1,
        hearts: state.usesHearts ? Math.max(0, state.hearts - 1) : state.hearts,
        itemStats,
      };
    }

    case 'skip': {
      if (state.status !== 'answering' || index === undefined) return state;
      return advance({ ...state, skipped: addUnique(state.skipped, index) });
    }

    case 'continue': {
      if (state.status !== 'feedback') return state;
      if (state.usesHearts && state.hearts <= 0)
        return { ...state, status: 'outOfHearts', lastGrade: null };
      return advance(state);
    }
  }
}

function advance(state: LessonState): LessonState {
  const queue = state.queue.slice(1);
  return {
    ...state,
    queue,
    turn: state.turn + 1,
    lastGrade: null,
    status: queue.length === 0 ? 'finished' : 'answering',
  };
}

/** Progress bar: distinct exercises solved out of those not skipped. */
export function lessonProgress(state: LessonState): { done: number; total: number } {
  const total =
    state.exercises.length - state.skipped.filter((i) => !state.solved.includes(i)).length;
  return { done: state.solved.length, total: Math.max(total, 1) };
}

/** SRS quality per item (docs/ARQUITETURA.md §7). */
function quality(stat: ItemStat): number {
  if (stat.wrong === 0) return stat.almost ? 4 : 5;
  return stat.finallyCorrect ? 2 : 1;
}

export type LessonSummary = {
  xp: number;
  accuracy: number;
  perfect: boolean;
  mistakes: number;
  durationMs: number;
  itemOutcomes: { itemId: string; q: number }[];
};

export function summarize(state: LessonState, nowMs: number): LessonSummary {
  const attempted = new Set([...state.solved, ...state.missed]).size;
  const firstTry = state.solved.filter((i) => !state.missed.includes(i)).length;
  const accuracy = attempted === 0 ? 1 : firstTry / attempted;
  const perfect = state.mistakes === 0;
  return {
    xp: sessionXp(state.kind, perfect, state.comboBonus),
    accuracy,
    perfect,
    mistakes: state.mistakes,
    durationMs: Math.max(0, nowMs - state.startedAt),
    itemOutcomes: Object.entries(state.itemStats).map(([itemId, stat]) => ({
      itemId,
      q: quality(stat),
    })),
  };
}
