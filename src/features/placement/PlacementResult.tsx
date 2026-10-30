import type { Exercise } from '../../content/schema';
import { correctAnswerOf } from '../../domain/grading/grade';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { En } from '../../ui/En';
import { ArrowRightIcon } from '../../ui/icons';
import { Tuca } from '../../ui/Mascot/Tuca';

type Props = {
  correct: number;
  answered: number;
  passed: boolean;
  missed: Exercise[];
  saving: boolean;
  saveError: boolean;
  saved: boolean;
  onRetry: () => void;
  onContinue: () => void;
};

/** Question shown for a missed exercise and the languages of question/answer. */
function questionOf(ex: Exercise): { text: string; questionEn: boolean; answerEn: boolean } {
  switch (ex.type) {
    case 'multiple-choice':
      return { text: ex.prompt, questionEn: false, answerEn: true };
    case 'word-bank':
      return { text: ex.promptPt, questionEn: false, answerEn: true };
    case 'translate-typing':
      return { text: ex.promptEn, questionEn: true, answerEn: false };
    case 'fill-blank':
      return { text: ex.translationPt, questionEn: false, answerEn: true };
    case 'match-pairs':
      return { text: '', questionEn: false, answerEn: true };
    default:
      return { text: ex.textEn, questionEn: true, answerEn: true };
  }
}

const Text = ({ en, children }: { en: boolean; children: string }) =>
  en ? <En>{children}</En> : <span>{children}</span>;

/** The only place where right/wrong appears in the placement test. */
export function PlacementResult({
  correct,
  answered,
  passed,
  missed,
  saving,
  saveError,
  saved,
  onRetry,
  onContinue,
}: Props) {
  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 pt-8 pb-0 text-center sm:pb-8">
      <Tuca mood={passed ? 'celebrating' : 'encouraging'} size={160} />
      <h1 className="text-3xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
        {passed ? t.placement.passedTitle : t.placement.failedTitle}
      </h1>
      <p className="font-display text-2xl font-semibold text-ink">
        {t.placement.score(correct, answered)}
      </p>
      <p className="text-lg text-ink-muted">
        {passed ? t.placement.passedBody : t.placement.failedBody}
      </p>

      {missed.length > 0 && (
        <details className="w-full rounded-card border-2 border-line bg-surface p-3 text-left">
          <summary className="cursor-pointer font-bold text-ink">{t.placement.mistakes}</summary>
          <ul className="mt-2 space-y-2">
            {missed.map((ex) => {
              const q = questionOf(ex);
              return (
                <li key={ex.id} className="rounded-xl bg-surface-2 px-3 py-2">
                  {q.text && (
                    <>
                      <Text en={q.questionEn}>{q.text}</Text>
                      <span aria-hidden="true"> → </span>
                      <span className="sr-only">, </span>
                    </>
                  )}
                  <strong className="text-ink">
                    <Text en={q.answerEn}>{correctAnswerOf(ex)}</Text>
                  </strong>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <div aria-live="polite" className="min-h-6">
        {saving && <p className="text-ink-muted">{t.placement.saving}</p>}
        {saveError && <p className="font-bold text-danger">{t.placement.saveError}</p>}
      </div>
      {/* Sticky on mobile: the main action never falls below the fold. */}
      <div className="sticky bottom-0 -mx-4 w-[calc(100%+2rem)] border-t-2 border-line bg-bg px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:w-full sm:border-0 sm:bg-transparent sm:p-0">
        {saveError ? (
          <Button block onClick={onRetry}>
            {t.placement.retry}
          </Button>
        ) : (
          <Button block disabled={!saved} onClick={onContinue} trailing={<ArrowRightIcon />}>
            {t.placement.goToPath}
          </Button>
        )}
      </div>
    </section>
  );
}
