import { useId } from 'react';
import { weekScale, type WeekDay } from '../../domain/stats/week';
import { t } from '../../i18n/pt-BR';
import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { formatDayMonth } from '../../ui/formatTime';

type Props = { days: WeekDay[]; goal: number };

const W = 320;
const H = 160;
const TOP = 36; // room for the XP value and the ✓ above the bars
const BOTTOM = 24; // weekday labels
const MIN_BAR = 2;

/** Seven bars with the goal line. Screen readers get the table below, not the rectangles. */
export function WeekChart({ days, goal }: Props) {
  const titleId = useId();
  const captionId = useId();
  const scale = weekScale(days, goal);
  const plot = H - TOP - BOTTOM;
  const slot = W / days.length;
  const barW = slot * 0.56;
  const goalY = TOP + plot - (goal / scale) * plot;
  const empty = days.every((d) => d.xp === 0);
  const label = (d: WeekDay, i: number) =>
    i === days.length - 1 ? t.profile.today : (t.weekdays[d.weekdayIndex] ?? '');

  if (empty) {
    return (
      <section
        aria-labelledby={titleId}
        className="rounded-card border-2 border-line bg-surface p-4"
      >
        <h2 id={titleId} className="mb-2 text-xl font-semibold">
          {t.profile.week}
        </h2>
        <p className="text-ink-muted">{t.profile.weekEmpty}</p>
        <Link
          to={paths.path}
          className="mt-2 inline-flex min-h-11 items-center font-bold text-ink underline underline-offset-4"
        >
          {t.profile.weekStart}
        </Link>
      </section>
    );
  }

  return (
    <figure className="rounded-card border-2 border-line bg-surface p-4">
      <figcaption id={titleId} className="mb-2 text-xl font-semibold">
        {t.profile.week}
      </figcaption>
      <p id={captionId} className="sr-only">
        {t.profile.weekCaption(goal)}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="list"
        aria-labelledby={titleId}
        aria-describedby={captionId}
      >
        {days.map((d, i) => {
          const h = Math.max(MIN_BAR, (d.xp / scale) * plot);
          const x = i * slot + (slot - barW) / 2;
          const y = TOP + plot - h;
          const isToday = i === days.length - 1;
          return (
            <g
              key={d.day}
              role="listitem"
              aria-label={t.profile.weekBar(
                `${label(d, i)} ${formatDayMonth(d.day)}`,
                d.xp,
                d.goalMet,
              )}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={Math.min(6, barW / 3)}
                className={isToday ? 'fill-progress-fill' : 'fill-secondary'}
              />
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                aria-hidden="true"
                className="fill-ink text-[12px] font-bold tabular-nums"
              >
                {d.xp}
              </text>
              {d.goalMet && (
                <path
                  aria-hidden="true"
                  d={`M${x + barW / 2 - 6} ${y - 26} l4 4 l8 -8`}
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
                aria-hidden="true"
                className={`fill-ink-muted text-[12px] ${isToday ? 'font-bold' : ''}`}
              >
                {label(d, i)}
              </text>
            </g>
          );
        })}
        <line
          aria-hidden="true"
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
    </figure>
  );
}
