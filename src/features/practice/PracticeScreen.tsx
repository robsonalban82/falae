import { useEffect } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { usePractice, practiceDueCount, selectPracticeItems } from '../../stores/usePractice';
import { useProgress } from '../../stores/useProgress';
import { Button } from '../../ui/Button';
import { Tuca } from '../../ui/Mascot/Tuca';

const linkButton =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 py-3 font-display text-lg font-semibold text-on-primary shadow-[0_6px_16px_-6px_rgb(var(--shadow)/0.45)]';

/** Route /praticar — due count and the start button (Practice never shows or spends hearts). */
export function PracticeScreen() {
  const loaded = usePractice((s) => s.loaded);
  const cards = usePractice((s) => s.cards);
  const load = usePractice((s) => s.load);
  const progressLoaded = useProgress((s) => s.loaded);
  const loadProgress = useProgress((s) => s.load);
  const pathState = useProgress((s) => s.pathState);

  useEffect(() => {
    // Always refresh on entry: cards may have become due since the last visit.
    void load();
    if (!progressLoaded) void loadProgress();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per visit

  const ready = loaded && progressLoaded;
  const due = ready ? practiceDueCount(cards) : 0;
  const canPractice = ready && selectPracticeItems(cards, pathState).length > 0;

  return (
    <section className="flex flex-col items-center gap-5 py-6 text-center">
      <h1 className="text-3xl font-semibold">{t.practice.title}</h1>
      <Tuca mood="encouraging" size={150} />
      {!ready ? (
        <div
          aria-busy="true"
          aria-label={t.practice.loading}
          className="w-full animate-pulse space-y-3"
        >
          <div className="mx-auto h-7 w-3/4 rounded-card bg-surface-2" />
          <div className="h-12 rounded-full bg-surface-2" />
        </div>
      ) : (
        <>
          <p role="status" className="text-xl font-bold text-ink">
            {due > 0 ? t.practice.due(due) : t.practice.nothingDue}
          </p>
          <p className="text-ink-muted">{t.practice.intro}</p>
          {canPractice ? (
            <Link to={paths.practiceSession} className={linkButton}>
              {t.practice.start}
            </Link>
          ) : (
            <>
              <Button block disabled aria-describedby="practice-empty">
                {t.practice.start}
              </Button>
              <p id="practice-empty" className="text-ink-muted">
                {t.practice.empty}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
