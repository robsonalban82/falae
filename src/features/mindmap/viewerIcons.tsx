/** Icons used only by the map viewer (kept out of the initial bundle with the lazy route). Same line style as `ui/icons`. */
type IconProps = { className?: string; size?: number };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function SpeakerIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="M4 9.5v5h3.5l5 4v-13l-5 4z" />
      <path d="M16 9.2a4 4 0 0 1 0 5.6M18.5 6.8a7.4 7.4 0 0 1 0 10.4" />
    </svg>
  );
}

export function ChevronIcon({ className, size = 22 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={3} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function EyeIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}
