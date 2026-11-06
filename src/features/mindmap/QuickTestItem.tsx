import { useId, type Ref } from 'react';
import { BLANK } from '../../domain/grading/blank';
import { shownAnswer, type QuizItemState } from '../../domain/mindmap/quiz';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { AlmostIcon, CheckIcon, CrossIcon } from '../../ui/icons';

type Props = {
  index: number;
  isLast: boolean;
  prompt: string;
  hintPt?: string;
  accepted: readonly string[];
  value: string;
  state: QuizItemState;
  showAnswer: boolean;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onCheck: () => void;
  onEnter: () => void;
  onFocus: () => void;
};

const q = t.maps.viewer.quiz;

/** One blank of the quick test: sentence with an input, hint, result (icon + text) and the answer. */
export function QuickTestItem({
  index,
  isLast,
  prompt,
  hintPt,
  accepted,
  value,
  state,
  showAnswer,
  inputRef,
  onChange,
  onCheck,
  onEnter,
  onFocus,
}: Props) {
  const [before = '', after = ''] = prompt.split(BLANK);
  const id = useId();
  const label = q.blank(index + 1);
  const { status } = state;
  const good = status === 'right' || status === 'almost';
  const border =
    status === 'wrong' ? 'border-danger' : good ? 'border-success' : 'border-line-strong';
  const longest = Math.max(5, ...accepted.map((a) => shownAnswer({ accepted: [a] }).length + 2));

  return (
    <li className="space-y-1 border-b-2 border-dashed border-line py-3 last:border-b-0">
      <span id={`${id}-l`} className="sr-only">
        {label}
      </span>
      <span id={`${id}-t`} lang="en" className="sr-only">
        {prompt.replace(BLANK, '…')}
      </span>
      <p className="text-lg leading-[3.25rem]">
        <span lang="en" aria-hidden="true">
          {before}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          lang="en"
          size={Math.min(longest, 28)}
          value={value}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={isLast ? 'done' : 'next'}
          aria-labelledby={`${id}-l ${id}-t`}
          aria-describedby={hintPt ? `${id}-h` : undefined}
          aria-invalid={status === 'wrong' || undefined}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            onEnter();
          }}
          className={`inline-block min-h-12 max-w-full rounded-t-md border-0 border-b-4 bg-surface-2 px-2 py-1 align-baseline text-base font-bold text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${border}`}
        />
        <span lang="en" aria-hidden="true">
          {after}
        </span>
      </p>
      <div className="flex items-center justify-between gap-2">
        <p id={`${id}-h`} className="text-sm text-ink-muted">
          {hintPt}
        </p>
        <Button
          variant="ghost"
          compact
          className="shrink-0"
          aria-label={`${q.check}: ${label}`}
          onClick={onCheck}
        >
          {q.check}
        </Button>
      </div>
      <p
        aria-hidden={status === 'empty' || undefined}
        className={`flex min-h-5 flex-wrap items-center gap-1.5 text-sm font-bold ${status === 'wrong' ? 'text-mark-wrong' : 'text-mark-right'}`}
      >
        {status === 'right' && <CheckIcon size={20} />}
        {status === 'almost' && <AlmostIcon size={20} />}
        {status === 'wrong' && <CrossIcon size={20} />}
        {status !== 'empty' && (
          <span>{status === 'right' ? q.right : status === 'almost' ? q.almost : q.wrong}</span>
        )}
        {status === 'almost' && state.correctAnswer && <span lang="en">{state.correctAnswer}</span>}
      </p>
      <p aria-hidden={!showAnswer || undefined} className="min-h-5 text-sm text-ink-muted">
        {showAnswer && (
          <>
            {q.answer}{' '}
            <b lang="en" className="text-ink">
              {shownAnswer({ accepted })}
            </b>
          </>
        )}
      </p>
    </li>
  );
}
