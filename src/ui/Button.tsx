import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  success: 'bg-success text-on-success',
  danger: 'bg-danger text-on-danger',
  ghost: 'bg-surface text-ink border-2 border-line-strong shadow-none',
};

type Props = ComponentProps<'button'> & {
  variant?: Variant;
  block?: boolean;
  /** Optional trailing icon (e.g. an arrow on "Continuar"). */
  trailing?: ReactNode;
};

/** Pill button with a soft shadow; pressing scales it slightly (transform only, no layout shift). */
export function Button({
  variant = 'primary',
  block = false,
  trailing,
  className = '',
  type = 'button',
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 py-3',
        'font-display text-lg font-semibold select-none',
        'shadow-[0_6px_16px_-6px_rgb(var(--shadow)/0.45)] transition-[transform,box-shadow] duration-150 ease-out',
        'enabled:active:scale-[0.97] enabled:active:shadow-none',
        'disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-line-strong',
        'disabled:bg-transparent disabled:text-ink-muted disabled:shadow-none',
        block ? 'w-full' : '',
        variants[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
      {trailing && (
        <span aria-hidden="true" className="-mr-1 inline-flex">
          {trailing}
        </span>
      )}
    </button>
  );
}
