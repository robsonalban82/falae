import { useEffect, useId, useRef } from 'react';
import { toFlashcard } from '../../domain/cards/flashcard';
import type { StudyItem } from '../../content/course';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { SpeakText } from './SpeakText';
import { useCanSpeak } from './useCanSpeak';

type Props = {
  item: StudyItem;
  /** Element that opened the sheet; gets focus back on close. */
  returnTo: HTMLElement | null;
  onClose: () => void;
};

const focusable =
  'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/** Bottom sheet with the back of the card for a `ref` line: EN, PT, example, pronunciation, caution. */
export function LineDetailSheet({ item, returnTo, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const card = toFlashcard(item);
  const canSpeak = useCanSpeak();
  const wasSpeaking = useRef(canSpeak);

  // The speech button the user was on turns into text when the voice fails: keep focus in the sheet.
  useEffect(() => {
    const lost = wasSpeaking.current && !canSpeak;
    wasSpeaking.current = canSpeak;
    if (!lost) return;
    const active = document.activeElement;
    if (!active || active === document.body || active === ref.current) closeRef.current?.focus();
  }, [canSpeak]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
      if (dialog.open) dialog.close();
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [returnTo]);

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key !== 'Tab' || !ref.current) return;
        const items = [...ref.current.querySelectorAll<HTMLElement>(focusable)];
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto mb-0 h-fit max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink shadow-2xl backdrop:bg-black/60 sm:mb-auto sm:rounded-3xl"
    >
      <h2 className="font-display text-2xl font-semibold">
        <SpeakText text={card.front.en}>
          <span id={titleId}>{card.front.en}</span>
        </SpeakText>
      </h2>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm font-bold text-ink-muted">{t.maps.viewer.sheetPt}</dt>
          <dd>{card.back.pt}</dd>
        </div>
        {card.back.example && (
          <div>
            <dt className="text-sm font-bold text-ink-muted">{t.maps.viewer.sheetExample}</dt>
            <dd>
              <SpeakText text={card.back.example.en}>{card.back.example.en}</SpeakText>
              <span className="block text-ink-muted">{card.back.example.pt}</span>
            </dd>
          </div>
        )}
        {card.back.pronunciation && (
          <div>
            <dt className="text-sm font-bold text-ink-muted">{t.maps.viewer.sheetPronunciation}</dt>
            <dd>{card.back.pronunciation}</dd>
          </div>
        )}
        {card.back.caution && (
          <div>
            <dt className="text-sm font-bold text-ink-muted">{t.maps.viewer.sheetCaution}</dt>
            <dd>{card.back.caution}</dd>
          </div>
        )}
      </dl>
      <Button block variant="ghost" ref={closeRef} onClick={onClose}>
        {t.maps.viewer.sheetClose}
      </Button>
    </dialog>
  );
}
