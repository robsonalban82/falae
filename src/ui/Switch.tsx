type Props = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

/** On/off toggle: role="switch" with aria-checked; state shown by position and text, not color alone. */
export function Switch({ id, label, hint, checked, disabled = false, onChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block font-bold text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-muted">
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors duration-150',
          checked ? 'border-secondary bg-secondary' : 'border-line-strong bg-surface-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'inline-block h-6 w-6 rounded-full shadow transition-transform duration-150 motion-reduce:transition-none',
            checked ? 'translate-x-6 bg-on-secondary' : 'translate-x-0.5 bg-line-strong',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
