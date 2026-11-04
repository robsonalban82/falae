import { gradeText, type GradeContext } from '../grading/grade';
import { displayPattern } from '../grading/patterns';

/** "Teste rápido": nothing is persisted (MAPAS-E-CARTAS §4.4). */
export type QuizItemShape = { accepted: readonly string[] };

export type QuizStatus = 'empty' | 'right' | 'almost' | 'wrong';

export type QuizItemState = {
  status: QuizStatus;
  /** Shown for `almost` and `wrong`: the form to learn. */
  correctAnswer?: string;
};

export type QuizState = { items: QuizItemState[]; showAnswers: boolean };

export const initialQuizState = (count: number): QuizState => ({
  items: Array.from({ length: count }, () => ({ status: 'empty' })),
  showAnswers: false,
});

function grade(item: QuizItemShape | undefined, value: string, ctx: GradeContext): QuizItemState {
  if (!item || !value.trim()) return { status: 'empty' };
  const result = gradeText(value, item.accepted, 'en', ctx);
  switch (result.verdict) {
    case 'correct':
      return { status: 'right' };
    case 'almost': // counts as right, but shows the correct form (as in lessons)
      return { status: 'almost', correctAnswer: result.correctAnswer };
    case 'wrong':
      return { status: 'wrong', correctAnswer: result.correctAnswer };
  }
}

/** Checks one blank; an empty value leaves it `empty`. */
export function check(
  state: QuizState,
  index: number,
  value: string,
  items: readonly QuizItemShape[],
  ctx: GradeContext,
): QuizState {
  if (index < 0 || index >= state.items.length) return state;
  const next = state.items.slice();
  next[index] = grade(items[index], value, ctx);
  return { ...state, items: next };
}

export function checkAll(
  state: QuizState,
  values: readonly string[],
  items: readonly QuizItemShape[],
  ctx: GradeContext,
): QuizState {
  return {
    ...state,
    items: state.items.map((_, i) => grade(items[i], values[i] ?? '', ctx)),
  };
}

export const toggleAnswers = (state: QuizState): QuizState => ({
  ...state,
  showAnswers: !state.showAnswers,
});

/** The answer "Ver respostas" shows: the first accepted pattern, in concrete form. */
export const shownAnswer = (item: QuizItemShape): string => displayPattern(item.accepted[0] ?? '');

/** `almost` counts as right. */
export function score(state: QuizState): { right: number; checked: number; total: number } {
  const checked = state.items.filter((i) => i.status !== 'empty');
  return {
    right: checked.filter((i) => i.status === 'right' || i.status === 'almost').length,
    checked: checked.length,
    total: state.items.length,
  };
}
