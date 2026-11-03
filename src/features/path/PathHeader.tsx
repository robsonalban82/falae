import { goalProgress } from '../../domain/gamification/dailyGoal';
import { refillHearts } from '../../domain/gamification/hearts';
import { displayStreak } from '../../domain/gamification/streak';
import { dayKey } from '../../domain/time';
import { t } from '../../i18n/pt-BR';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { BoltIcon } from '../../ui/icons';
import { useHeightVar } from '../../ui/useHeightVar';
import { useNow } from '../../ui/useNow';
import { HeartsBadge } from '../lesson/HeartsBadge';
import { GoalRing } from './GoalRing';
import { StreakBadge } from './StreakBadge';

const REFRESH_MS = 30_000;
/** Sticky stats bar: streak, XP, hearts (with live refill countdown) and daily goal. */
export function PathHeader() {
  const profile = useProfile((s) => s.profile);
  const xpToday = useProgress((s) => s.xpToday);
  const goal = useSettings((s) => s.settings.dailyGoalXp);
  const now = useNow(REFRESH_MS);
  const streak = displayStreak(profile.streak, dayKey(now));
  const hearts = refillHearts(profile, now);
  const ref = useHeightVar('--path-header-h');

  return (
    <div
      ref={ref}
      className="sticky top-[var(--notice-h,0px)] z-[5] -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-line bg-bg px-4 py-2"
    >
      <StreakBadge display={streak} freezes={profile.streak.freezes} />
      <span
        role="img"
        aria-label={t.header.xp(profile.totalXp)}
        className="inline-flex items-center gap-1 font-display text-xl font-semibold text-ink"
      >
        <span className="inline-flex rounded-full bg-xp p-1 text-on-xp">
          <BoltIcon size={18} />
        </span>
        <span className="tabular" aria-hidden="true">
          {profile.totalXp}
        </span>
      </span>
      <HeartsBadge hearts={hearts.hearts} nextHeartInMs={hearts.nextHeartInMs} />
      <GoalRing progress={goalProgress(xpToday, goal)} />
    </div>
  );
}
