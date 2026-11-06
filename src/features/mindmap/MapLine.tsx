import { memo } from 'react';
import type { LineView } from '../../domain/mindmap/lines';
import { t } from '../../i18n/pt-BR';
import { CheckIcon, CrossIcon } from '../../ui/icons';
import { ChunkRating } from './ChunkRating';
import { HiddenChunk } from './HiddenChunk';
import { useHideChunks } from './hideContext';
import { RichText } from './RichText';
import { SpeakText } from './SpeakText';

type Props = {
  view: LineView;
  /** Position key of the line (`b{i}.n{j}.l{k}`), used by "Hide the English". */
  chunkKey: string;
  /** Class of the branch color for bold/key text. */
  keyClass: string;
  /** Opens the detail sheet of an item line; `trigger` gets focus back on close. */
  onDetails: (itemId: string, trigger: HTMLElement) => void;
};

/** One line of a card: item (with detail button), own English rule/example, fix pair or PT note. */
function MapLineView({ view, chunkKey, keyClass, onDetails }: Props) {
  const hide = useHideChunks();
  switch (view.kind) {
    case 'item':
      return (
        <li className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-snug">
          {/* One text group so the details button stays on the same line as the words. */}
          <span className="min-w-0 flex-1 space-x-2">
            <HiddenChunk chunkKey={chunkKey} describedBy={`${chunkKey}-pt`}>
              <SpeakText text={view.en} className={view.strong ? 'font-bold' : ''}>
                {view.en}
              </SpeakText>
            </HiddenChunk>
            <span id={`${chunkKey}-pt`} className="text-ink-muted">
              {view.pt}
            </span>
            {view.hint && <span className="text-sm text-ink-muted">({view.hint})</span>}
          </span>
          {/* While covered its label and sheet would give the English away: keep only its space,
              so revealing never changes where the line breaks. */}
          {hide.on && !hide.isRevealed(chunkKey) ? (
            <span
              aria-hidden="true"
              className="invisible inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-bold underline"
            >
              {t.maps.viewer.details}
            </span>
          ) : (
            <button
              type="button"
              aria-label={t.maps.viewer.detailsOf(view.en)}
              onClick={(e) => onDetails(view.itemId, e.currentTarget)}
              className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-bold text-secondary-shade underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus dark:text-secondary"
            >
              {t.maps.viewer.details}
            </button>
          )}
          <ChunkRating chunkKey={chunkKey} />
        </li>
      );
    case 'text':
      return (
        <li className="flex flex-wrap items-center gap-x-2 leading-snug">
          <HiddenChunk chunkKey={chunkKey} describedBy={view.pt ? `${chunkKey}-pt` : undefined}>
            <SpeakText text={view.speakText}>
              <RichText segments={view.en} boldClassName={keyClass} />
            </SpeakText>
          </HiddenChunk>
          {view.pt && (
            <span id={`${chunkKey}-pt`} className="text-ink-muted">
              {view.pt}
            </span>
          )}
        </li>
      );
    case 'fix':
      return (
        <li className="space-y-0.5 leading-snug">
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1 text-mark-wrong">
              <CrossIcon size={18} />
              <span className="sr-only">{t.maps.viewer.wrong}</span>
              <del lang="en">{view.wrong}</del>
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2">
            <CheckIcon size={18} className="text-mark-right" />
            <span className="sr-only">{t.maps.viewer.right}</span>
            <HiddenChunk chunkKey={chunkKey}>
              <SpeakText text={view.right} className="font-bold text-mark-right">
                {view.right}
              </SpeakText>
            </HiddenChunk>
          </p>
          {view.note && <p className="text-sm text-ink-muted">{view.note}</p>}
        </li>
      );
    case 'note':
      return <li className="leading-snug text-ink-muted">{view.text}</li>;
  }
}

export const MapLine = memo(MapLineView);
