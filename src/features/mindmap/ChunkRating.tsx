import { useEffect, useRef } from 'react';
import { t } from '../../i18n/pt-BR';
import { CheckIcon, CrossIcon } from '../../ui/icons';
import { useHideChunks } from './hideContext';

/** Optional "Lembrei / Não lembrei" under a revealed item line (MAPAS-E-CARTAS §3). */
export function ChunkRating({ chunkKey }: { chunkKey: string }) {
  const hide = useHideChunks();
  const rating = hide.rating(chunkKey);
  const choiceRef = useRef<HTMLParagraphElement>(null);
  const focusChoice = useRef(false);

  // The buttons go away once rated: keep keyboard focus on the choice instead of <body>.
  useEffect(() => {
    if (!rating || !focusChoice.current) return;
    focusChoice.current = false;
    choiceRef.current?.focus({ preventScroll: true });
  }, [rating]);

  if (!hide.on || !hide.isRevealed(chunkKey)) return null;

  if (rating) {
    const remembered = rating === 'remembered';
    return (
      <p
        ref={choiceRef}
        tabIndex={-1}
        className={`flex min-h-11 w-full items-center gap-1 rounded-sm text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${remembered ? 'text-mark-right' : 'text-mark-wrong'}`}
      >
        {remembered ? <CheckIcon size={18} /> : <CrossIcon size={18} />}
        {remembered ? t.maps.viewer.hide.remembered : t.maps.viewer.hide.forgot}
      </p>
    );
  }

  if (hide.locked) return null;

  const choose = (r: 'remembered' | 'forgot') => {
    focusChoice.current = true;
    hide.rate(chunkKey, r);
  };
  const btn =
    'inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-3 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';
  return (
    <div
      role="group"
      aria-label={t.maps.viewer.hide.rateLabel}
      className="flex w-full flex-wrap gap-2"
    >
      <button
        type="button"
        onClick={() => choose('remembered')}
        className={`${btn} border-mark-right text-mark-right`}
      >
        <CheckIcon size={16} />
        {t.maps.viewer.hide.remembered}
      </button>
      <button
        type="button"
        onClick={() => choose('forgot')}
        className={`${btn} border-mark-wrong text-mark-wrong`}
      >
        <CrossIcon size={16} />
        {t.maps.viewer.hide.forgot}
      </button>
    </div>
  );
}
