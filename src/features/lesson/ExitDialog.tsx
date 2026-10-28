import { useEffect, useRef } from 'react';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';

type Props = { open: boolean; onStay: () => void; onLeave: () => void };

/** Native modal <dialog>: Esc, focus trap, inert background and focus return come from the browser. */
export function ExitDialog({ open, onStay, onLeave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      stay.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="exit-title"
      aria-describedby="exit-body"
      onClose={onStay}
      className="m-auto w-[calc(100%-2rem)] max-w-sm space-y-4 rounded-3xl bg-surface p-6 text-center text-ink backdrop:bg-black/40"
    >
      <h2 id="exit-title" className="text-2xl font-semibold">
        {t.lesson.confirmExit.title}
      </h2>
      <p id="exit-body" className="text-ink-muted">
        {t.lesson.confirmExit.body}
      </p>
      <Button block ref={stay} onClick={onStay}>
        {t.lesson.confirmExit.stay}
      </Button>
      <Button block variant="ghost" onClick={onLeave}>
        {t.lesson.confirmExit.leave}
      </Button>
    </dialog>
  );
}
