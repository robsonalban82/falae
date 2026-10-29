import { useCallback, useMemo } from 'react';
import { seededShuffle } from '../../../lib/shuffle';
import { ChoiceList } from './ChoiceList';
import type { ExerciseProps } from './types';

export function MultipleChoice({ exercise, disabled, onChange }: ExerciseProps<'multiple-choice'>) {
  // Authors usually list the answer first; shuffle (stable per exercise) so position never gives it away.
  const options = useMemo(() => seededShuffle(exercise.options, exercise.id), [exercise]);
  const onSelect = useCallback((value: string) => onChange({ kind: 'choice', value }), [onChange]);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{exercise.prompt}</h2>
      <ChoiceList
        name={exercise.prompt}
        options={options}
        answer={exercise.answer}
        disabled={disabled}
        onSelect={onSelect}
      />
    </div>
  );
}
