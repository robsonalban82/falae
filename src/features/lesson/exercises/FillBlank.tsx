import { useCallback, useState } from 'react';
import { BLANK } from '../../../content/schema';
import { t } from '../../../i18n/pt-BR';
import { En } from '../../../ui/En';
import { ChoiceList } from './ChoiceList';
import type { ExerciseProps } from './types';

export function FillBlank({ exercise, disabled, onChange }: ExerciseProps<'fill-blank'>) {
  const [choice, setChoice] = useState<string | null>(null);
  const [before, after] = exercise.sentence.split(BLANK);
  const onSelect = useCallback(
    (value: string) => {
      setChoice(value);
      onChange({ kind: 'choice', value });
    },
    [onChange],
  );
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t.lesson.instructions['fill-blank']}</h2>
      <p className="text-2xl leading-relaxed">
        <En>
          {before}
          <span className="mx-1 inline-block min-w-16 border-b-4 border-secondary px-2 text-center font-bold text-secondary">
            {choice ?? ' '}
          </span>
          {after}
        </En>
      </p>
      <p className="text-ink-muted">
        {t.lesson.translationLabel} {exercise.translationPt}
      </p>
      <ChoiceList
        name={t.lesson.instructions['fill-blank']}
        options={exercise.options.map((text) => ({ text }))}
        disabled={disabled}
        onSelect={onSelect}
        layout="row"
      />
    </div>
  );
}
