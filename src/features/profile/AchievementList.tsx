import { useState } from 'react';
import { achievements } from '../../domain/gamification/achievements';
import type { UnlockedAchievement } from '../../data/models';
import { t } from '../../i18n/pt-BR';
import { LockIcon } from '../../ui/icons';
import { formatDate } from '../../ui/formatTime';

type Props = { unlocked: UnlockedAchievement[] };

const NEXT_LOCKED = 3;

/**
 * Unlocked ones first, then the next 3 locked (list order); "Ver todas" shows the rest.
 * Unknown ids from a newer backup are ignored.
 */
export function AchievementList({ unlocked }: Props) {
  const byId = new Map(unlocked.map((a) => [a.id, a]));
  const [showAll, setShowAll] = useState(false);
  const obtained = achievements.filter((a) => byId.has(a.id));
  const locked = achievements.filter((a) => !byId.has(a.id));
  const count = obtained.length;
  const visible = [...obtained, ...(showAll ? locked : locked.slice(0, NEXT_LOCKED))];
  const hidden = locked.length - NEXT_LOCKED;
  return (
    <section aria-labelledby="achievements-title">
      <h2 id="achievements-title" className="mb-3 flex items-baseline gap-2 text-xl font-semibold">
        {t.achievements.title}
        <span className="text-base font-normal text-ink-muted">
          {t.profile.achievementsCount(count, achievements.length)}
        </span>
      </h2>
      <ul id="achievement-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((def) => {
          const text = t.achievements.list[def.id];
          const got = byId.get(def.id);
          const date = got ? formatDate(got.unlockedAt) : '';
          return (
            <li
              key={def.id}
              aria-label={
                got
                  ? t.profile.achievementUnlocked(text.title, date)
                  : t.profile.achievementLocked(text.title)
              }
              className={`flex items-center gap-3 rounded-card border-2 p-3 ${
                got ? 'border-line bg-surface' : 'border-dashed border-line-strong bg-bg'
              }`}
            >
              <span
                aria-hidden="true"
                className={`relative text-3xl ${got ? '' : 'opacity-40 grayscale'}`}
              >
                {def.icon}
                {!got && (
                  <span className="absolute -right-2 -bottom-1 rounded-full bg-surface p-0.5 text-ink-muted">
                    <LockIcon size={16} />
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="min-w-0">
                <span className="block font-bold text-ink">{text.title}</span>
                <span className="block text-sm text-ink-muted">
                  {got ? t.profile.unlockedOn(date) : text.hint}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={showAll}
          aria-controls="achievement-grid"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 min-h-11 rounded-full px-4 font-bold text-secondary underline-offset-4 hover:underline"
        >
          {showAll ? t.profile.showLess : t.profile.showAll(achievements.length)}
        </button>
      )}
    </section>
  );
}
