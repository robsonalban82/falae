import { useEffect, useId, useRef, useState } from 'react';
import type { GradeResult } from '../../domain/grading/grade';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { En } from '../../ui/En';
import { diffChars } from '../../domain/grading/diffChars';
import { AlmostIcon, ArrowRightIcon, CheckIcon, CrossIcon } from '../../ui/icons';
import { Tuca } from '../../ui/Mascot/Tuca';

type Props = {
  grade: GradeResult;
  explanation?: string | undefined;
  /** The correct answer is English for every type except EN→PT translation. */
  answerLang: 'en' | 'pt';
  praise: string;
  comboMessage?: string | undefined;
  /** Typed answer, used to highlight the differing letter on "almost". */
  userAnswer?: string | undefined;
  onContinue: () => void;
};

/** Floating feedback card (not a full-width color bar). Focus moves to "Continuar". */
export function FeedbackPanel({
  grade,
  explanation,
  answerLang,
  praise,
  comboMessage,
  userAnswer,
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
  const tone =
    grade.verdict === 'correct'
      ? 'bg-success-soft text-success'
      : grade.verdict === 'almost'
        ? 'bg-warning-soft text-warning'
        : 'bg-danger-soft text-danger';
  const marked =
    grade.verdict === 'almost' && userAnswer !== undefined
      ? diffChars(grade.correctAnswer, userAnswer).map((seg, i) =>
          seg.diff ? (
            <mark key={i} className="rounded bg-xp px-0.5 text-on-xp">
              {seg.text}
              <span className="sr-only"> ({t.lesson.feedback.differentLetter})</span>
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )
      : grade.correctAnswer;
  const answer = answerLang === 'en' ? <En>{marked}</En> : marked;
  const mood =
    grade.verdict === 'correct' ? 'happy' : grade.verdict === 'almost' ? 'thinking' : 'sad';
  const iconBg =
    grade.verdict === 'correct'
      ? 'bg-success text-on-success'
      : grade.verdict === 'almost'
        ? 'bg-warning text-warning-soft'
        : 'bg-danger text-on-danger';

  return (
    <div className={`rounded-3xl p-5 ${tone}`}>
      {/* Announced via the player's persistent live region and via aria-describedby on focus. */}
      <div className="flex items-start gap-3">
        <Tuca mood={mood} size={56} decorative className="shrink-0" />
        <div id={detailsId} className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-2 font-display text-2xl font-semibold">
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}
            >
              {grade.verdict === 'correct' ? (
                <CheckIcon size={20} />
              ) : grade.verdict === 'almost' ? (
                <AlmostIcon size={20} />
              ) : (
                <CrossIcon size={20} />
              )}
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
      </div>
      <Button
        ref={button}
        aria-describedby={detailsId}
        variant={grade.verdict === 'correct' ? 'success' : ok ? 'primary' : 'danger'}
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
