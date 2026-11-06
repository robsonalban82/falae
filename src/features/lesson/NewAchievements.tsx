import { useState } from 'react';
import { findAchievement } from '../../domain/gamification/achievements';
import { t } from '../../i18n/pt-BR';

/** Up to this many are shown in full; beyond it, the list collapses. */
const MAX_FULL_ACHIEVEMENTS = 4;
const COLLAPSED_ACHIEVEMENTS = 3;

type AchievementKey = keyof typeof t.achievements.list;
const achievementText = (id: string) =>
  id in t.achievements.list ? t.achievements.list[id as AchievementKey] : null; // `in` narrows the key

export type ShownAchievement = { id: string; icon: string; title: string; description: string };

/** Ids of newly unlocked achievements -> what to show (unknown ids are skipped). */
export function resolveAchievements(ids: readonly string[]): ShownAchievement[] {
  return ids.flatMap((id) => {
    const def = findAchievement(id);
    const text = achievementText(id);
    return def && text ? [{ id, icon: def.icon, ...text }] : [];
  });
}

/** "New achievements" box shared by the lesson and the map study end screens. */
export function NewAchievements({ achievements }: { achievements: readonly ShownAchievement[] }) {
  const [showAll, setShowAll] = useState(false);
  if (achievements.length === 0) return null;
  const collapsible = achievements.length > MAX_FULL_ACHIEVEMENTS;
  const visible =
    collapsible && !showAll ? achievements.slice(0, COLLAPSED_ACHIEVEMENTS) : achievements;
  return (
    <div className="rounded-card border-2 border-line bg-surface p-3">
      <h2 id="new-achievements" className="mb-2 text-xl font-semibold">
        {t.achievements.heading}
      </h2>
      <ul aria-labelledby="new-achievements" id="new-achievements-list" className="space-y-2">
        {visible.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl">
              {a.icon}
            </span>
            <span>
              <span className="block font-bold">{a.title}</span>
              <span className="text-sm text-ink-muted">{a.description}</span>
            </span>
          </li>
        ))}
      </ul>
      {collapsible && (
        <button
          type="button"
          aria-expanded={showAll}
          aria-controls="new-achievements-list"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 min-h-11 rounded-lg px-2 font-bold text-ink underline underline-offset-4"
        >
          {showAll ? t.achievements.showLess : t.achievements.showAll(achievements.length)}
        </button>
      )}
    </div>
  );
}
