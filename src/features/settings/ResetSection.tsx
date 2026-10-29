import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/routes';
import { repository } from '../../data';
import { normalize } from '../../domain/grading/normalize';
import { t } from '../../i18n/pt-BR';
import { clearLastShownDay } from '../../services/notifications';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { clearSession } from '../lesson/sessionStore';
import { exportProgress } from './exportProgress';
import { sectionClass } from './styles';

const matchesWord = (value: string) =>
  normalize(value, 'pt') === normalize(t.settings.resetConfirmWord, 'pt');

/** Double confirmation: explain (with "Exportar antes"), then type APAGAR. */
export function ResetSection() {
  const navigate = useNavigate();
  const origin = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const exportFirst = async () => {
    try {
      setExportMessage({ ok: true, text: t.settings.resetExported(await exportProgress()) });
    } catch (err) {
      console.error('[falae] Export failed', err);
      setExportMessage({ ok: false, text: t.settings.exportError });
    }
  };

  const close = () => {
    setExportMessage(null);
    setStep(0);
    setTyped('');
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await repository.resetAll(); // clears settings and quarantine too, and reloads the stores
      clearSession();
      clearLastShownDay();
      void navigate(paths.welcome, { replace: true });
    } catch (err) {
      console.error('[falae] Reset failed', err);
      setError(true);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="reset-title" className={sectionClass}>
      <h2 id="reset-title" className="text-xl font-semibold">
        {t.settings.reset}
      </h2>
      <p className="text-ink-muted">{t.settings.resetHint}</p>
      <Button
        ref={origin}
        variant="danger"
        onClick={() => {
          setError(false);
          setStep(1);
        }}
      >
        {t.settings.resetButton}
      </Button>
      <p role="alert" className="min-h-6 font-bold text-danger">
        {error ? t.settings.resetError : ''}
      </p>

      <ConfirmDialog
        open={step === 1}
        title={t.settings.resetTitle}
        confirmLabel={t.settings.resetContinue}
        cancelLabel={t.settings.cancel}
        danger
        returnFocus={origin}
        onConfirm={() => setStep(2)}
        onCancel={close}
        extra={
          <Button block variant="secondary" onClick={() => void exportFirst()}>
            {t.settings.resetExportFirst}
          </Button>
        }
        field={
          <>
            <p role="status" aria-live="polite" className="min-h-6 font-bold text-success">
              {exportMessage?.ok ? exportMessage.text : ''}
            </p>
            <p role="alert" className="font-bold text-danger empty:hidden">
              {exportMessage?.ok === false ? exportMessage.text : ''}
            </p>
          </>
        }
      >
        <p>{t.settings.resetBody}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={step === 2}
        title={t.settings.resetConfirmTitle}
        confirmLabel={t.settings.resetConfirm}
        cancelLabel={t.settings.cancel}
        danger
        returnFocus={origin}
        confirmDisabled={busy || !matchesWord(typed)}
        confirmHint={matchesWord(typed) ? t.settings.resetUnlockedHint : t.settings.resetLockedHint}
        onConfirm={() => void confirm()}
        onCancel={close}
        field={
          <div className="space-y-1">
            <label htmlFor="reset-confirm" className="block font-bold text-ink">
              {t.settings.resetConfirmLabel}
            </label>
            <input
              id="reset-confirm"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="min-h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-3 text-lg font-bold text-ink"
            />
          </div>
        }
      >
        <p>{t.settings.resetBody}</p>
      </ConfirmDialog>
    </section>
  );
}
