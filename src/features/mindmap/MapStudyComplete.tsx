import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { NewAchievements, resolveAchievements } from '../lesson/NewAchievements';
import { BoltIcon, FlameIcon } from '../../ui/icons';
import { GoalRing } from '../path/GoalRing';
import { Tuca } from '../../ui/Mascot/Tuca';
import type { StudySave } from './useMapStudy';

type Props = {
  mapId: string;
  save: StudySave;
  /** The last revealed item still waits for its optional rating. */
  pendingRating: boolean;
  onFinish: () => void;
  /** Present only when the map has a quick test (and its section exists). */
  onQuickTest?: () => void;
};

const linkBase =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full px-7 py-3 font-display text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';
// Same look as the primary / ghost Button, for links.
const primaryLink = `${linkBase} bg-primary text-on-primary shadow-[0_6px_16px_-6px_rgb(var(--shadow)/0.45)]`;
const ghostLink = `${linkBase} border-2 border-line-strong bg-surface text-ink`;

/** End-of-map panel of a finished "Hide the English" study. XP comes from the commit, never recomputed. */
export function MapStudyComplete({ mapId, save, pendingRating, onFinish, onQuickTest }: Props) {
  const h = t.maps.viewer.hide;
  const commit = save.status === 'saved' ? save.commit : null;
  const xp = commit?.result.xp ?? 0;
  const streak = commit?.streak?.increased ? commit.streak : null;
  const goal = commit?.goal ?? null;

  const achievements = resolveAchievements(commit?.newAchievements ?? []);
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // The panel appears below the fold on long maps: bring it into view when it appears and
  // again whenever it changes size (saved or failed panels are taller than the pending one).
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [save.status]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the panel changes

  // Only this paragraph is a live region: buttons and links stay outside of it.
  const status = pendingRating ? (
    h.lastPending
  ) : save.status === 'error' ? (
    <span className="font-bold text-danger">{h.saveError}</span>
  ) : commit ? (
    xp > 0 ? (
      <>
        <BoltIcon size={24} className="text-xp" />
        {h.xp(xp)}
      </>
    ) : (
      h.noXp
    )
  ) : (
    t.lesson.complete.saving
  );

  return (
    <section
      ref={ref}
      data-testid="map-study-complete"
      className="nb-paper flex flex-col items-center gap-3 p-5 text-center"
    >
      {commit && !pendingRating && (
        <>
          <Tuca mood="celebrating" size={96} decorative />
          <h2 className="font-display text-2xl font-semibold">{h.title}</h2>
        </>
      )}
      <p
        role="status"
        aria-live="polite"
        className={
          commit && !pendingRating
            ? 'inline-flex items-center gap-2 font-display text-xl font-semibold'
            : ''
        }
      >
        {status}
      </p>
      {pendingRating && <Button onClick={onFinish}>{h.finish}</Button>}
      {!pendingRating && save.status === 'error' && (
        <Button onClick={save.retry}>{t.errors.contentRetry}</Button>
      )}
      {commit && !pendingRating && (
        <>
          {streak && (
            <p className="inline-flex items-center gap-2 font-bold">
              <FlameIcon size={22} className="text-primary-shade dark:text-primary" />
              {t.header.streak(streak.streak.current)}
            </p>
          )}
          {goal && (
            <div
              className={`flex w-full items-center gap-3 rounded-card border-2 p-3 text-left ${
                goal.celebrate
                  ? 'border-success bg-success-soft text-success'
                  : 'border-line bg-surface'
              }`}
            >
              <GoalRing progress={goal.progress} />
              <p className="flex-1 font-bold">
                {goal.celebrate
                  ? t.lesson.complete.goalMetDetail(goal.progress.xp, goal.progress.goal)
                  : t.header.goal(goal.progress.xp, goal.progress.goal)}
              </p>
            </div>
          )}
          {achievements.length > 0 && (
            <div className="w-full text-left">
              <NewAchievements achievements={achievements} />
            </div>
          )}
          <div className="flex w-full max-w-sm flex-col gap-3 pt-1">
            <Link to={paths.mapPractice(mapId)} className={primaryLink}>
              {h.practice}
            </Link>
            {onQuickTest && (
              <Button variant="ghost" block onClick={onQuickTest}>
                {h.quickTest}
              </Button>
            )}
            <Link to={paths.maps} className={ghostLink}>
              {t.maps.backToMaps}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
