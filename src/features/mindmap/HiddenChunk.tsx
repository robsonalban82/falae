import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../../i18n/pt-BR';
import { useHideChunks } from './hideContext';
import { EyeIcon } from './viewerIcons';

type Props = {
  /** Stable chunk key (`b{i}.n{j}.l{k}`, from `hideableChunks`). */
  chunkKey: string;
  /** Id of the Portuguese text of the same line: gives the identical post-its a distinct hint. */
  describedBy?: string;
  children: ReactNode;
};

/**
 * An English chunk that "Hide the English" covers with a kraft post-it. The covered content is
 * invisible and `inert`; revealing it moves focus to it (its speak button when there is one).
 */
export function HiddenChunk({ chunkKey, describedBy, children }: Props) {
  const hide = useHideChunks();
  const hidden = hide.on && !hide.isRevealed(chunkKey);
  const contentRef = useRef<HTMLSpanElement>(null);
  const focusOnReveal = useRef(false);

  useEffect(() => {
    if (hidden || !focusOnReveal.current) return;
    focusOnReveal.current = false;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>('button') ?? content;
    target?.focus({ preventScroll: true });
  }, [hidden]);

  return (
    <span data-chunk={chunkKey} className="relative my-1 inline-flex max-w-full min-w-0">
      <span
        ref={contentRef}
        tabIndex={-1}
        inert={hidden}
        className={`min-w-0 rounded-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${hidden ? 'invisible' : ''}`}
      >
        {children}
      </span>
      {hidden && (
        <button
          type="button"
          aria-label={t.maps.viewer.hide.peek}
          aria-describedby={describedBy}
          onClick={() => {
            focusOnReveal.current = true;
            hide.reveal(chunkKey);
          }}
          className={[
            'absolute -inset-x-1 -inset-y-px grid min-w-14 cursor-pointer place-items-center',
            'rounded-[3px] border-2 border-postit-edge bg-postit text-ink',
            'shadow-[2px_2px_0_rgb(var(--shadow)/0.18)]',
            'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
            // A bit of tape on top, and an invisible 44 px touch target around the post-it.
            "before:absolute before:-top-1.5 before:left-1/2 before:h-2 before:w-6 before:-translate-x-1/2 before:rounded-[1px] before:bg-line-strong/40 before:content-['']",
            "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
          ].join(' ')}
        >
          <EyeIcon />
        </button>
      )}
    </span>
  );
}
