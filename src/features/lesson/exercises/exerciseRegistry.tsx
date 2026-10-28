import type { ComponentType } from 'react';
import type { Exercise, ExerciseType } from '../../../content/schema';
import { FillBlank } from './FillBlank';
import { ListenType } from './ListenType';
import { MatchPairs } from './MatchPairs';
import { MultipleChoice } from './MultipleChoice';
import { Speak } from './Speak';
import { TranslateTyping } from './TranslateTyping';
import type { ExerciseProps } from './types';
import { WordBank } from './WordBank';

type Registry = { [T in ExerciseType]: ComponentType<ExerciseProps<T>> };

export const exerciseRegistry: Registry = {
  'multiple-choice': MultipleChoice,
  'word-bank': WordBank,
  'translate-typing': TranslateTyping,
  'listen-type': ListenType,
  speak: Speak,
  'match-pairs': MatchPairs,
  'fill-blank': FillBlank,
};

type AnyProps = Omit<ExerciseProps<ExerciseType>, 'exercise'> & { exercise: Exercise };

/** Renders the right component for an exercise. Keyed by id so state resets between exercises. */
export function ExerciseView({ exercise, ...props }: AnyProps) {
  // The registry is indexed by the discriminant, so the component matches the exercise type.
  const Component = exerciseRegistry[exercise.type] as ComponentType<
    ExerciseProps<typeof exercise.type>
  >;
  return <Component key={exercise.id} exercise={exercise as never} {...props} />;
}
