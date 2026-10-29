import type { GoalProgress } from '../../domain/gamification/dailyGoal';
import { t } from '../../i18n/pt-BR';
import { CheckIcon } from '../../ui/icons';

/** Daily goal ring. The label carries the numbers; the ring is not the only signal. */
export function GoalRing({ progress, size = 52 }: { progress: GoalProgress; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      role="img"
      aria-label={t.header.goal(progress.xp, progress.goal)}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-progress-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress.ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={progress.met ? 'stroke-success' : 'stroke-progress-fill'}
        />
      </svg>
      <span
        aria-hidden="true"
        className="tabular absolute font-display text-xs leading-none font-semibold"
      >
        {progress.met ? (
          <CheckIcon size={Math.round(size / 2.4)} className="text-success" />
        ) : (
          `${progress.xp}/${progress.goal}`
        )}
      </span>
    </span>
  );
}
