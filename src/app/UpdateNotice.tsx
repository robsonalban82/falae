import { useSyncExternalStore } from 'react';
import { isDbOutdated, onDbOutdated } from '../data/events';
import { t } from '../i18n/pt-BR';

/** Shown when the DB connection was closed by a schema change in another tab. */
export function UpdateNotice() {
  const outdated = useSyncExternalStore(onDbOutdated, isDbOutdated);
  if (!outdated) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-surface-2 px-4 py-3 text-ink"
    >
      <p className="font-bold">{t.updateNotice.text}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-full bg-secondary px-5 font-bold text-on-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t.updateNotice.reload}
      </button>
    </div>
  );
}
