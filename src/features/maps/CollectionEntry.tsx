import type { StudyItem } from '../../content/course';
import type { CollectionEntry as Entry } from '../../content/schemas/collection';
import { t } from '../../i18n/pt-BR';
import { SpeakText } from '../mindmap/SpeakText';

// Text label plus a distinct border style, so the seal never depends on color.
const sealStyles = {
  informal: 'border-solid',
  neutro: 'border-dashed',
  giria: 'border-dotted',
} as const;

/** One entry of a collection: EN (with audio), PT, situation, formality seal, avoid-when and caution. */
export function CollectionEntry({ entry, item }: { entry: Entry; item: StudyItem }) {
  const pt = typeof item.pt === 'string' ? item.pt : item.pt.join(' / ');
  const caution = item.kind === 'vocab' ? item.notes : undefined;
  return (
    <li className="space-y-1 rounded-card border-2 border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SpeakText text={item.en} className="font-display text-xl font-semibold text-ink">
          {item.en}
        </SpeakText>
        {entry.formality && (
          <span
            className={`inline-flex min-h-6 items-center rounded-full border-2 border-line-strong px-2.5 text-sm font-bold text-ink ${sealStyles[entry.formality]}`}
          >
            {t.maps.collection.formality[entry.formality]}
          </span>
        )}
      </div>
      <p className="text-ink">{pt}</p>
      {entry.situation && (
        <p className="text-sm text-ink-muted">
          <b>{t.maps.collection.situation}</b> {entry.situation}
        </p>
      )}
      {entry.avoidWhen && (
        <p className="text-sm text-ink-muted">
          <b>{t.maps.collection.avoidWhen}</b> {entry.avoidWhen}
        </p>
      )}
      {caution && (
        <p className="text-sm text-ink">
          <b>{t.maps.viewer.sheetCaution}</b> {caution}
        </p>
      )}
    </li>
  );
}
