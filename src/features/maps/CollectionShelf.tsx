import { Link } from 'react-router';
import { paths } from '../../app/routes';
import type { ManifestCollection } from '../../content/buildManifest';
import type { BranchColor } from '../../content/schemas/mindmap';
import { t } from '../../i18n/pt-BR';
import { NotebookIcon } from '../../ui/notebook/NotebookIcon';

// Full class names so Tailwind can see them.
const coverColors: Record<BranchColor, string> = {
  folha: 'border-map-folha-stroke bg-map-folha-tint text-map-folha-key',
  jabuticaba: 'border-map-jabuticaba-stroke bg-map-jabuticaba-tint text-map-jabuticaba-key',
  anil: 'border-map-anil-stroke bg-map-anil-tint text-map-anil-key',
  manga: 'border-map-manga-stroke bg-map-manga-tint text-map-manga-key',
  acerola: 'border-map-acerola-stroke bg-map-acerola-tint text-map-acerola-key',
  maracuja: 'border-map-maracuja-stroke bg-map-maracuja-tint text-map-maracuja-key',
};

const coverBase =
  'flex h-full min-h-11 flex-col gap-1 rounded-card border-2 p-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** A study-plan collection has no entries of its own, so its cover is not a link. */
function Cover({ collection: c }: { collection: ManifestCollection }) {
  const className = `${coverBase} ${coverColors[c.cover.color]}`;
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <NotebookIcon name={c.cover.icon} size={26} />
        <span className="text-sm font-bold text-ink">{t.maps.shelfCount(c.entryCount)}</span>
      </span>
      <span className="font-display text-lg leading-tight font-semibold text-ink">{c.title}</span>
      <span className="hidden text-sm text-ink-muted sm:block">{c.subtitle}</span>
    </>
  );
  if (c.kind === 'study-plan') return <div className={className}>{body}</div>;
  return (
    <Link to={paths.collection(c.id)} className={className}>
      {body}
    </Link>
  );
}

/**
 * Compact covers of the collections in the manifest (2 columns on phones, one row on desktop).
 * Each cover links to the read-only collection screen.
 */
export function CollectionShelf({ collections }: { collections: readonly ManifestCollection[] }) {
  if (collections.length === 0) return null;
  return (
    <section aria-labelledby="shelf-title" className="space-y-3">
      <h2 id="shelf-title" className="text-xl font-semibold">
        {t.maps.shelfTitle}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {collections.map((c) => (
          <li key={c.id}>
            <Cover collection={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}
