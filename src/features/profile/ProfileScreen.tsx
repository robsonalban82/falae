import { useEffect } from 'react';
import { displayStreak } from '../../domain/gamification/streak';
import { lastSevenDays } from '../../domain/stats/week';
import { t } from '../../i18n/pt-BR';
import { clock } from '../../services/clock';
import { useProfile } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { useStats } from '../../stores/useStats';
import { AchievementList } from './AchievementList';
import { StatsGrid } from './StatsGrid';
import { WeekChart } from './WeekChart';

/** Route /perfil — numbers, last 7 days and every achievement. */
export function ProfileScreen() {
  const profile = useProfile((s) => s.profile);
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const goal = useSettings((s) => s.settings.dailyGoalXp);
  const stats = useStats();

  useEffect(() => {
    void stats.load();
    if (!profileLoaded) void loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per visit

  const ready = profileLoaded && stats.loaded;
  const today = stats.today || clock.today();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t.profile.title}</h1>
      {!ready ? (
        <div aria-busy="true" aria-label={t.profile.loading} className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-card bg-surface-2" />
            ))}
          </div>
          <div className="h-52 rounded-card bg-surface-2" />
        </div>
      ) : (
        <>
          <StatsGrid
            totalXp={profile.totalXp}
            words={stats.wordsLearned}
            streak={displayStreak(profile.streak, today).value}
            longest={profile.streak.longest}
            freezes={profile.streak.freezes}
          />
          <WeekChart days={lastSevenDays(stats.week, today, goal)} goal={goal} />
          <AchievementList unlocked={stats.achievements} />
        </>
      )}
    </div>
  );
}
