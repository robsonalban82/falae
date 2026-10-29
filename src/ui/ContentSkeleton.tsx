import { t } from '../i18n/pt-BR';

/** Placeholder while unit content loads (revealed late, so fast loads never flash). */
export function ContentSkeleton({ label = t.errors.contentLoading }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="appear-late mx-auto w-full max-w-xl p-6">
      <div className="animate-pulse space-y-5 motion-reduce:animate-none">
        <div className="h-4 rounded-full bg-surface-2" />
        <div className="h-8 w-3/4 rounded-card bg-surface-2" />
        <div className="h-24 rounded-card bg-surface-2" />
        <div className="h-14 rounded-full bg-surface-2" />
      </div>
    </div>
  );
}
