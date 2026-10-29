import { weekScale, type WeekDay } from '../../domain/stats/week';
import { t } from '../../i18n/pt-BR';
import { formatDayMonth } from '../../ui/formatTime';

type Props = { days: WeekDay[]; goal: number };

const W = 320;
const H = 160;
const TOP = 22; // room for the ✓ above the bars
const BOTTOM = 24; // weekday labels
const MIN_BAR = 2;

/** Seven bars with the goal line. Screen readers get the table below, not the rectangles. */
export function WeekChart({ days, goal }: Props) {
  const scale = weekScale(days, goal);
  const plot = H - TOP - BOTTOM;
  const slot = W / days.length;
  const barW = slot * 0.56;
  const goalY = TOP + plot - (goal / scale) * plot;
  const empty = days.every((d) => d.xp === 0);
  const label = (d: WeekDay, i: number) =>
    i === days.length - 1 ? t.profile.today : (t.weekdays[d.weekdayIndex] ?? '');

  return (
    <figure className="rounded-card border-2 border-line bg-surface p-4">
      <figcaption className="mb-2 text-xl font-semibold">{t.profile.week}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
        {days.map((d, i) => {
          const h = Math.max(MIN_BAR, (d.xp / scale) * plot);
          const x = i * slot + (slot - barW) / 2;
          const y = TOP + plot - h;
          const isToday = i === days.length - 1;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={Math.min(6, barW / 3)}
                className={isToday ? 'fill-progress-fill' : 'fill-secondary'}
              />
              {d.xp === 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-ink-muted text-[12px]"
                >
                  0
                </text>
              )}
              {d.goalMet && (
                <path
                  d={`M${x + barW / 2 - 6} ${y - 10} l4 4 l8 -8`}
                  fill="none"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-success"
                />
              )}
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                className={`fill-ink-muted text-[12px] ${isToday ? 'font-bold' : ''}`}
              >
                {label(d, i)}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          x2={W}
          y1={goalY}
          y2={goalY}
          strokeDasharray="6 5"
          strokeWidth={2}
          className="stroke-line-strong"
        />
      </svg>
      <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted" aria-hidden="true">
        <span className="inline-block w-6 border-t-2 border-dashed border-line-strong" />
        {t.profile.goalLine(goal)}
      </p>
      {empty && <p className="mt-2 text-center text-ink-muted">{t.profile.weekEmpty}</p>}
      <table className="sr-only">
        <caption>{t.profile.weekCaption(goal)}</caption>
        <thead>
          <tr>
            <th scope="col">{t.profile.weekDay}</th>
            <th scope="col">{t.profile.weekXp}</th>
            <th scope="col">{t.profile.weekGoal}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.day}>
              <th scope="row">{`${label(d, i)} ${formatDayMonth(d.day)}`}</th>
              <td>{d.xp}</td>
              <td>{d.goalMet ? t.profile.yes : t.profile.no}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
