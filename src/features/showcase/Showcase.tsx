import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { useSettings } from '../../stores/useSettings';
import { Button } from '../../ui/Button';
import { En } from '../../ui/En';
import { ArrowRightIcon } from '../../ui/icons';
import { ProgressBar } from '../../ui/ProgressBar';
import { Tuca, type TucaMood } from '../../ui/Mascot/Tuca';
import type { Settings } from '../../data/models';

const swatches = [
  ['bg-primary text-on-primary', 'primary'],
  ['bg-secondary text-on-secondary', 'secondary'],
  ['bg-success text-on-success', 'success'],
  ['bg-danger text-on-danger', 'danger'],
  ['bg-xp text-on-xp', 'xp'],
  ['bg-surface-2 text-ink', 'sand'],
] as const;

const moods: TucaMood[] = ['happy', 'celebrating', 'sad', 'encouraging', 'thinking'];
const themes: Settings['theme'][] = ['system', 'light', 'dark'];

/** Temporary Phase 2 page for the UX review; replaced by the path in Phase 5. */
export function Showcase() {
  const theme = useSettings((s) => s.settings.theme);
  const update = useSettings((s) => s.update);
  const [progress, setProgress] = useState(4);
  const max = 12;

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        <Tuca mood="happy" size={96} decorative />
        <div>
          <h1 className="text-4xl font-semibold">{t.appName}</h1>
          <p className="text-ink-muted">{t.tagline}</p>
        </div>
      </header>
      <p>{t.showcase.intro}</p>

      <fieldset className="space-y-3">
        <legend className="mb-3 font-display text-2xl font-semibold">{t.showcase.theme}</legend>
        <div className="flex flex-wrap gap-2">
          {themes.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line-strong bg-surface px-4 font-bold has-checked:border-secondary has-checked:bg-secondary has-checked:text-on-secondary has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => void update({ theme: value })}
                className="sr-only"
              />
              {t.showcase.themes[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="sc-colors" className="space-y-3">
        <h2 id="sc-colors" className="text-2xl font-semibold">
          {t.showcase.colors}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {swatches.map(([cls, key]) => (
            <li key={key} className={`rounded-card p-4 font-bold ${cls}`}>
              {t.showcase.colorNames[key]}
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-2xl bg-success-soft p-4 font-bold text-success">
            <span aria-hidden="true">✓ </span>
            {t.showcase.feedbackOk} <En>“{t.showcase.feedbackOkEn}”</En>
          </p>
          <p className="rounded-2xl bg-danger-soft p-4 font-bold text-danger">
            <span aria-hidden="true">✗ </span>
            {t.showcase.feedbackWrong} <En>“{t.showcase.feedbackWrongEn}”</En>
          </p>
        </div>
      </section>

      <section aria-labelledby="sc-type" className="space-y-2">
        <h2 id="sc-type" className="text-2xl font-semibold">
          {t.showcase.type}
        </h2>
        <p className="font-display text-3xl font-semibold">{t.showcase.sampleHeading}</p>
        <p>
          {t.showcase.sampleBody} <En className="font-bold">“{t.showcase.sampleEn}”</En>
        </p>
        <p className="text-ink-muted">
          {t.showcase.secondaryText} · <span className="tabular">1234567890</span>
        </p>
      </section>

      <section aria-labelledby="sc-buttons" className="space-y-3">
        <h2 id="sc-buttons" className="text-2xl font-semibold">
          {t.showcase.buttons}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button trailing={<ArrowRightIcon />}>{t.showcase.buttonLabels.primary}</Button>
          <Button variant="secondary">{t.showcase.buttonLabels.secondary}</Button>
          <Button variant="ghost">{t.showcase.buttonLabels.ghost}</Button>
          <Button variant="success">{t.showcase.buttonLabels.success}</Button>
          <Button variant="danger">{t.showcase.buttonLabels.danger}</Button>
          <Button disabled>{t.showcase.buttonLabels.disabled}</Button>
        </div>
      </section>

      <section aria-labelledby="sc-progress" className="space-y-3">
        <h2 id="sc-progress" className="text-2xl font-semibold">
          {t.showcase.progress}
        </h2>
        <ProgressBar value={progress} max={max} label={t.showcase.progressLabel} />
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="text-2xl!"
            onClick={() => setProgress((p) => Math.max(0, p - 1))}
            aria-label={t.showcase.decrease}
          >
            −
          </Button>
          <Button
            variant="ghost"
            className="text-2xl!"
            onClick={() => setProgress((p) => Math.min(max, p + 1))}
            aria-label={t.showcase.increase}
          >
            +
          </Button>
        </div>
      </section>

      <section aria-labelledby="sc-mascot" className="space-y-3">
        <h2 id="sc-mascot" className="text-2xl font-semibold">
          {t.showcase.mascot}
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {moods.map((mood) => (
            <li key={mood} className="flex flex-col items-center gap-2 rounded-card bg-surface p-4">
              <Tuca mood={mood} size={120} />
              <span className="font-bold" aria-hidden="true">
                {t.mascot.moodNames[mood]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
