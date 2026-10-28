import { t } from '../../i18n/pt-BR';

export function HeartsBadge({ hearts }: { hearts: number }) {
  return (
    <span
      role="img"
      aria-label={t.lesson.hearts(hearts)}
      className="inline-flex items-center gap-1 font-display text-xl font-semibold text-danger"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.1 4.4 2.5.8-1.4 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.1C19.5 16.4 12 21 12 21z" />
      </svg>
      <span className="tabular" aria-hidden="true">
        {hearts}
      </span>
    </span>
  );
}
