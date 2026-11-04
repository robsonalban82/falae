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

export function MapsIcon({ filled, className }: IconProps) {
  const fill = filled ? 'currentColor' : 'none';
  return (
    <svg {...base(filled)} className={className}>
      <circle cx="12" cy="12" r="3" fill={fill} />
      <circle cx="4.8" cy="5.8" r="1.8" fill={fill} />
      <circle cx="19.2" cy="5.8" r="1.8" fill={fill} />
      <circle cx="12" cy="20" r="1.8" fill={fill} />
      <path d="M6.2 7.1 9.9 10M17.8 7.1 14.1 10M12 15v3.2" />
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

type SizedIconProps = IconProps & { size?: number };

const solid = (size: number) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'currentColor',
  'aria-hidden': true,
});

export function LockIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={2.4} className={className}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

export function CheckIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={3.2} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CrossIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={3.2} className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

/** "Almost": a tilde, distinct from check and cross. */
export function AlmostIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={3} className={className}>
      <path d="M4.5 13.5c2-3 4.5-3 7.5 0s5.5 3 7.5 0" />
    </svg>
  );
}

export function StarIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...solid(size)} className={className}>
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
    </svg>
  );
}

export function CrownIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...solid(size)} className={className}>
      <path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 10H5z" />
      <rect x="5" y="19" width="14" height="2" rx="1" />
    </svg>
  );
}

export function TrophyIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...solid(size)} className={className}>
      <path d="M7 3h10v2h3v2.5a4.5 4.5 0 0 1-4.1 4.5A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1A5 5 0 0 1 8.1 12 4.5 4.5 0 0 1 4 7.5V5h3zm0 4H6v.5a2.5 2.5 0 0 0 1.2 2.1A5 5 0 0 1 7 8.5zm10 0v1.5a5 5 0 0 1-.2 1.1A2.5 2.5 0 0 0 18 7.5V7z" />
    </svg>
  );
}

export function FlameIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...solid(size)} className={className}>
      <path d="M12 2.5c.6 3.2 2.4 4.6 4 6.4 1.5 1.7 2.5 3.5 2.5 5.6A6.5 6.5 0 0 1 5.5 14.5c0-2.4 1.2-4.2 2.6-5.6-.1 1.6.4 3 1.6 3.6C9.4 8.6 10.6 5.2 12 2.5z" />
    </svg>
  );
}

/** Streak freeze: an ice crystal. */
export function FreezeIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />
    </svg>
  );
}

export function BoltIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...solid(size)} className={className}>
      <path d="M13.5 2L4 13.5h6.5L9.5 22 20 9.5h-6.6z" />
    </svg>
  );
}

export function HeartIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...solid(size)} className={className}>
      <path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.1 4.4 2.5.8-1.4 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.1C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function BulbIcon({ className, size = 22 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function BookIcon({ className, size = 26 }: SizedIconProps) {
  return (
    <svg {...base(false)} width={size} height={size} strokeWidth={2.2} className={className}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7h8" />
    </svg>
  );
}
