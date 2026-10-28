type Props = { value: number; max: number; label: string; className?: string };

/** Accessible progress bar; animates with transform only. */
export function ProgressBar({ value, max, label, className = '' }: Props) {
  const clamped = Math.min(max, Math.max(0, value));
  const ratio = max > 0 ? clamped / max : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      className={`h-4 w-full overflow-hidden rounded-full bg-progress-track ${className}`}
    >
      <div
        className="h-full origin-left rounded-full bg-progress-fill transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
