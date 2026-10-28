import { useEffect, useId, useRef, useState } from 'react';
import type { GradeResult } from '../../domain/grading/grade';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { En } from '../../ui/En';
import { ArrowRightIcon } from '../../ui/icons';

type Props = {
  grade: GradeResult;
  explanation?: string | undefined;
  /** The correct answer is English for every type except EN→PT translation. */
  answerLang: 'en' | 'pt';
  praise: string;
  comboMessage?: string | undefined;
  onContinue: () => void;
};

/** Floating feedback card (not a full-width color bar). Focus moves to "Continuar". */
export function FeedbackPanel({
  grade,
  explanation,
  answerLang,
  praise,
  comboMessage,
  onContinue,
}: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const detailsId = useId();
  // "Continuar" appears where "Verificar" was: ignore a double-click's second tap so the
  // feedback is actually seen.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    button.current?.focus();
    const timer = setTimeout(() => setArmed(true), 400);
    return () => clearTimeout(timer);
  }, []);
  const ok = grade.verdict !== 'wrong';
  const tone = ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger';
  const answer = answerLang === 'en' ? <En>{grade.correctAnswer}</En> : grade.correctAnswer;

  return (
    <div className={`rounded-3xl p-5 ${tone}`}>
      {/* Announced via the player's persistent live region and via aria-describedby on focus. */}
      <div id={detailsId} className="space-y-1">
        <p className="flex items-center gap-2 font-display text-2xl font-semibold">
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
              ok ? 'bg-success text-on-success' : 'bg-danger text-on-danger'
            }`}
          >
            {ok ? '✓' : '✗'}
          </span>
          {grade.verdict === 'correct'
            ? praise
            : grade.verdict === 'almost'
              ? t.lesson.feedback.almost
              : t.lesson.feedback.wrong}
        </p>
        {comboMessage && grade.verdict !== 'wrong' && <p className="font-bold">{comboMessage}</p>}
        {grade.verdict !== 'correct' && (
          <p className="text-lg">
            <span className="font-bold">{t.lesson.feedback.correctAnswer}</span> {answer}
          </p>
        )}
        {grade.verdict === 'wrong' && explanation && <p className="text-ink">{explanation}</p>}
      </div>
      <Button
        ref={button}
        aria-describedby={detailsId}
        variant={ok ? 'success' : 'danger'}
        block
        className={`mt-4 transition-opacity duration-300 ${armed ? 'opacity-100' : 'opacity-70'}`}
        onClick={(e) => {
          // Keyboard activation (detail 0) is always deliberate.
          if (armed || e.detail === 0) onContinue();
        }}
        trailing={<ArrowRightIcon />}
      >
        {t.lesson.continue}
      </Button>
    </div>
  );
}
