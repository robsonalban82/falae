import { CheckIcon } from './icons';

type Option<V extends string | number> = { value: V; label: string; detail?: string };

type Props<V extends string | number> = {
  name: string;
  legend: string;
  hint?: string;
  options: readonly Option<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Big cards (onboarding) instead of compact pills. */
  large?: boolean;
};

/** Native radio group styled as pills; the checked one also gets a ✓ (not color alone). */
export function RadioPills<V extends string | number>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  large = false,
}: Props<V>) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-bold text-ink">{legend}</legend>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      <div className={large ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={[
                'flex cursor-pointer items-center gap-2 border-2 font-bold',
                large ? 'min-h-16 rounded-card px-4 py-3' : 'min-h-11 rounded-full px-4',
                checked
                  ? 'border-secondary bg-secondary text-on-secondary'
                  : 'border-line-strong bg-surface text-ink',
                'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {checked && <CheckIcon size={18} />}
              <span className={large ? 'flex flex-col' : ''}>
                <span className={large ? 'font-display text-lg font-semibold' : ''}>{o.label}</span>
                {o.detail && (
                  <span className={`text-sm font-normal ${checked ? '' : 'text-ink-muted'}`}>
                    {o.detail}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
