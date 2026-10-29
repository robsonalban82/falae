import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './Button';

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  danger?: boolean;
  /** Extra action between confirm and cancel (e.g. "Exportar antes"). */
  extra?: ReactNode;
  /** Element that gets focus back on close (default: whatever was focused when it opened). */
  returnFocus?: RefObject<HTMLElement | null>;
  /** Content between the body and the buttons (e.g. a confirmation field). */
  field?: ReactNode;
};

/**
 * Generic modal confirmation on the native <dialog>: focus is trapped and the background
 * inert (showModal), Esc cancels, the first focus goes to Cancel and focus returns to the opener.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  danger = false,
  extra,
  returnFocus,
  field,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current =
        returnFocus?.current ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      dialog.showModal();
      cancel.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, returnFocus]);

  // Scroll lock while open: the page behind must not move under the modal.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      onKeyDown={(e) => {
        // showModal makes the page inert, but Tab can still leave to the browser UI: cycle inside.
        if (e.key !== 'Tab' || !ref.current) return;
        const items = [
          ...ref.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
          ),
        ];
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
        onCancel();
      }}
      onClose={() => {
        const el = opener.current;
        opener.current = null;
        if (el?.isConnected) el.focus();
      }}
      className={[
        // Centered modal on wide screens, bottom sheet on phones; strong backdrop in both themes.
        'fixed inset-0 m-auto h-fit max-h-[90dvh] w-[calc(100%-2rem)] max-w-md space-y-4 overflow-y-auto',
        'rounded-3xl bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[2px]',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]',
      ].join(' ')}
    >
      <h2 id={titleId} className="text-2xl font-semibold">
        {title}
      </h2>
      {children && (
        <div id={bodyId} className="space-y-3 text-ink-muted">
          {children}
        </div>
      )}
      {field}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          block
          variant={danger ? 'danger' : 'primary'}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        {extra}
        <Button block variant="ghost" ref={cancel} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
