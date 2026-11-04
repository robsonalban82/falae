import { iconShapes, type NotebookIconName } from './notebookIconShapes';

type Props = { name: NotebookIconName; size?: number; className?: string };

/** Decorative hand-drawn icon; the label is always real text next to it. */
export function NotebookIcon({ name, size = 24, className }: Props) {
  const shape = iconShapes[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      className={className}
    >
      {shape.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {shape.dots?.map(([cx, cy, r, filled]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={filled ? 'currentColor' : 'none'} />
      ))}
    </svg>
  );
}
