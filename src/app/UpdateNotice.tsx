import { useSyncExternalStore } from 'react';
import { getDbNotice, onDbOutdated } from '../data/events';
import { t } from '../i18n/pt-BR';
import { useHeightVar } from '../ui/useHeightVar';

/**
 * Shown when the DB connection was closed by another tab, or while an upgrade is blocked by
 * one. It is sticky at the top and also in the flow (content is pushed down); sticky page
 * headers offset themselves by `--notice-h`, so nothing is covered. The safe-area inset keeps
 * it clear of notches.
 */
export function UpdateNotice() {
  const notice = useSyncExternalStore(onDbOutdated, getDbNotice);
  const ref = useHeightVar('--notice-h', notice !== null);
  if (!notice) return null;
  return (
    <div
      ref={ref}
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
