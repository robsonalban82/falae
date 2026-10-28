import type { ExerciseOf, ExerciseType } from '../../../content/schema';
import type { ExerciseResponse } from '../../../domain/grading/grade';

export type ExerciseProps<T extends ExerciseType> = {
  exercise: ExerciseOf<T>;
  /** True after "Verificar": the answer is locked while feedback shows. */
  disabled: boolean;
  /** null = no answer yet ("Verificar" stays disabled). */
  onChange: (response: ExerciseResponse | null) => void;
  /** Lets an exercise submit itself (Enter in a text field, last pair matched). */
  onSubmit: (response?: ExerciseResponse) => void;
  /** Only speak uses this ("Não posso falar agora"). */
  onSkip: () => void;
  sound: boolean;
};
