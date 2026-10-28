/** Original line icons (24×24). `filled` is used for the active state. */
type IconProps = { filled?: boolean; className?: string };

const base = (filled: boolean | undefined) => ({
  viewBox: '0 0 24 24',
  width: 26,
  height: 26,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: filled ? 2.4 : 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function PathIcon({ filled, className }: IconProps) {
  return (
    <svg {...base(filled)} className={className}>
      <circle cx="6" cy="18" r="2.5" fill={filled ? 'currentColor' : 'none'} />
      <circle cx="18" cy="6" r="2.5" fill={filled ? 'currentColor' : 'none'} />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </svg>
  );
}

export function PracticeIcon({ filled, className }: IconProps) {
  return (
    <svg {...base(filled)} className={className}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
      {filled && <circle cx="12" cy="12" r="2.5" fill="currentColor" />}
    </svg>
  );
}

export function ProfileIcon({ filled, className }: IconProps) {
  return (
    <svg {...base(filled)} className={className}>
      <circle cx="12" cy="8" r="4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function SettingsIcon({ filled, className }: IconProps) {
  return (
    <svg {...base(filled)} className={className}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.5" fill={filled ? 'currentColor' : 'none'} />
      <circle cx="8" cy="17" r="2.5" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base(false)} width={22} height={22} strokeWidth={2.6} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
