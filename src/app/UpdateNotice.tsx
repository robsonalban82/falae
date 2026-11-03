import { useSyncExternalStore } from 'react';
import { getDbNotice, onDbOutdated } from '../data/events';
import { t } from '../i18n/pt-BR';

/**
 * Shown when the DB connection was closed by another tab, or while an upgrade is blocked by
 * one. It is in the flow (sticky, not overlaid), so the content below is pushed down, never
 * covered; the safe-area inset keeps it clear of notches.
 */
export function UpdateNotice() {
  const notice = useSyncExternalStore(onDbOutdated, getDbNotice);
  if (!notice) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 border-b-2 border-line-strong bg-surface-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 text-ink shadow-sm"
    >
      <p className="font-bold">{t.updateNotice[notice]}</p>
      {notice !== 'blocked' && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-full bg-secondary px-5 font-bold text-on-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {t.updateNotice.reload}
        </button>
      )}
    </div>
  );
}
