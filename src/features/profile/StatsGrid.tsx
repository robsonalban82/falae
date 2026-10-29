import type { ReactNode } from 'react';
import { MAX_FREEZES } from '../../domain/gamification/streak';
import { t } from '../../i18n/pt-BR';
import { BoltIcon, BookIcon, FlameIcon, FreezeIcon, TrophyIcon } from '../../ui/icons';

type Props = {
  totalXp: number;
  words: number;
  streak: number;
  longest: number;
  freezes: number;
};

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border-2 border-line bg-surface p-3">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd className="tabular font-display text-2xl font-semibold text-ink">{value}</dd>
      </div>
    </div>
  );
}

export function StatsGrid({ totalXp, words, streak, longest, freezes }: Props) {
  return (
    <section aria-labelledby="stats-title">
      <h2 id="stats-title" className="mb-3 text-xl font-semibold">
        {t.profile.stats}
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          icon={
            <span className="inline-flex rounded-full bg-xp p-1.5 text-on-xp">
              <BoltIcon size={22} />
            </span>
          }
          label={t.profile.totalXp}
          value={String(totalXp)}
        />
        <Stat
          icon={<BookIcon size={30} className="text-success" />}
          label={t.profile.words}
          value={String(words)}
        />
        <Stat
          icon={<FlameIcon size={30} className="text-primary-shade dark:text-primary" />}
          label={t.profile.streak}
          value={t.profile.days(streak)}
        />
        <Stat
          icon={<TrophyIcon size={30} className="text-primary-shade dark:text-primary" />}
          label={t.profile.longest}
          value={t.profile.days(longest)}
        />
        <Stat
          icon={<FreezeIcon size={30} className="text-secondary" />}
          label={t.profile.freezes}
          value={t.profile.freezesOf(freezes, MAX_FREEZES)}
        />
      </dl>
    </section>
  );
}
