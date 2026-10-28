import { useCallback } from 'react';
import { ChoiceList } from './ChoiceList';
import type { ExerciseProps } from './types';

export function MultipleChoice({ exercise, disabled, onChange }: ExerciseProps<'multiple-choice'>) {
  const onSelect = useCallback((value: string) => onChange({ kind: 'choice', value }), [onChange]);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{exercise.prompt}</h2>
      <ChoiceList
        name={exercise.prompt}
        options={exercise.options}
        disabled={disabled}
        onSelect={onSelect}
      />
    </div>
  );
}
