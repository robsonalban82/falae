import { useEffect, useState } from 'react';
import { t } from '../../../i18n/pt-BR';
import { En } from '../../../ui/En';
import { CheckIcon, CrossIcon } from '../../../ui/icons';

type Option = { text: string; emoji?: string | undefined };
type Props = {
  options: Option[];
  disabled: boolean;
  onSelect: (value: string) => void;
  layout?: 'grid' | 'row';
  name: string;
  /** Correct option; revealed (✓/✗) once the answer is checked (`disabled`). */
  answer: string;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Radio-style option list shared by multiple-choice and fill-blank. Keys 1–4 select. */
export function ChoiceList({ options, disabled, onSelect, layout = 'grid', name, answer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Number keys work everywhere except text fields (the focused radio after a click is fine).
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLInputElement && e.target.type !== 'radio') return;
      const option = options[Number(e.key) - 1];
      if (option) {
        setSelected(option.text);
        onSelect(option.text);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, disabled, onSelect]);

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={
        layout === 'grid'
          ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
          : 'flex flex-wrap justify-center gap-3'
      }
    >
      {options.map((option, i) => {
        const checked = selected === option.text;
        const revealed = disabled && selected !== null;
        const isRight = revealed && same(option.text, answer);
        const isWrongPick = revealed && checked && !isRight;
        const look = isRight
          ? 'border-success bg-success-soft text-success'
          : isWrongPick
            ? 'border-danger bg-danger-soft text-danger'
            : checked
              ? 'border-secondary bg-surface-2 text-secondary'
              : 'border-line-strong';
        return (
          <label
            key={option.text}
            className={[
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 text-lg font-bold transition-colors duration-100',
              look,
              disabled ? 'cursor-default' : '',
              revealed && !isRight && !isWrongPick ? 'opacity-70' : '',
              'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
            ].join(' ')}
          >
            <input
              type="radio"
              name={name}
              value={option.text}
              checked={checked}
              disabled={disabled}
              onChange={() => {
                setSelected(option.text);
                onSelect(option.text);
              }}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-line-strong text-sm text-ink-muted"
            >
              {i + 1}
            </span>
            {option.emoji && (
              <span aria-hidden="true" className="text-3xl">
                {option.emoji}
              </span>
            )}
            <En>{option.text}</En>
            {(isRight || isWrongPick) && (
              <span className="ml-auto flex items-center">
                {isRight ? (
                  <CheckIcon size={24} className="text-success" />
                ) : (
                  <CrossIcon size={24} className="text-danger" />
                )}
                <span className="sr-only">
                  {', '}
                  {isWrongPick ? t.lesson.feedback.yourAnswerWrong : t.lesson.feedback.rightAnswer}
                </span>
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
