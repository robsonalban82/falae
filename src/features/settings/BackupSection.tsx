import { useRef, useState } from 'react';
import { repository } from '../../data';
import { parseExportFile, type ImportFailure, type ImportSummary } from '../../data/exportImport';
import type { ExportFile } from '../../data/models';
import { t } from '../../i18n/pt-BR';
import { readTextFile } from '../../services/backup';
import { clock } from '../../services/clock';
import { useProfile } from '../../stores/useProfile';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { formatDate } from '../../ui/formatTime';
import { clearSession } from '../lesson/sessionStore';
import { exportProgress } from './exportProgress';
import { sectionClass } from './styles';

type Message = { kind: 'ok' | 'error'; text: string; issues?: string[] };

const failureText: Record<ImportFailure, string> = {
  json: t.settings.importErrors.json,
  notFalae: t.settings.importErrors.notFalae,
  newerVersion: t.settings.importErrors.newerVersion,
  invalid: t.settings.importErrors.invalid,
};

/** Export to a JSON file and import one back (summary + confirmation before replacing). */
export function BackupSection() {
  const currentXp = useProfile((s) => s.profile.totalXp);
  const currentStreak = useProfile((s) => s.profile.streak.current);
  const currentLongest = useProfile((s) => s.profile.streak.longest);
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<{ file: ExportFile; summary: ImportSummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentCounts, setCurrentCounts] = useState({ lessons: 0, achievements: 0 });

  const onExport = async () => {
    try {
      const name = await exportProgress();
      setMessage({ kind: 'ok', text: t.settings.exported(name) });
    } catch (err) {
      console.error('[falae] Export failed', err);
      setMessage({ kind: 'error', text: t.settings.exportError });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ''; // allow choosing the same file again
    if (!file) return;
    setMessage(null);
    const read = await readTextFile(file);
    if (!read.ok) {
      setMessage({
        kind: 'error',
        text: read.reason === 'tooBig' ? t.settings.importTooBig : t.settings.importErrors.read,
      });
      return;
    }
    const parsed = parseExportFile(read.text, clock.today());
    if (!parsed.ok) {
      setMessage({
        kind: 'error',
        text: failureText[parsed.reason],
        ...(parsed.issues ? { issues: parsed.issues } : {}),
      });
      return;
    }
    try {
      const [lessons, achievements] = await Promise.all([
        repository.getLessonProgress(),
        repository.getAchievements(),
      ]);
      setCurrentCounts({ lessons: lessons.length, achievements: achievements.length });
    } catch (err) {
      console.error('[falae] Could not read current progress', err);
    }
    setPending({ file: parsed.file, summary: parsed.summary });
  };

  const onConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await repository.importAll(pending.file); // notifies the stores (emitDataReplaced)
      clearSession(); // a lesson/practice in progress belongs to the old data
      setMessage({ kind: 'ok', text: t.settings.imported });
    } catch (err) {
      console.error('[falae] Import failed', err);
      setMessage({ kind: 'error', text: t.settings.importErrors.save });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const s = pending?.summary;

  return (
    <section aria-labelledby="backup-title" className={sectionClass}>
      <h2 id="backup-title" className="text-xl font-semibold">
        {t.settings.backup}
      </h2>
      <p className="text-ink-muted">{t.settings.backupHint}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => void onExport()}>
          {t.settings.export}
        </Button>
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border-2 border-line-strong bg-surface px-7 py-3 font-display text-lg font-semibold text-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
          {t.settings.import}
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {/* Successes are polite; errors interrupt (role="alert"). One region per kind, so nothing is announced twice. */}
      <div role="status" aria-live="polite" className="empty:sr-only">
        {message?.kind === 'ok' && (
          <div className="text-success">
            <p className="font-bold">{message.text}</p>
          </div>
        )}
      </div>
      <div role="alert" className="empty:sr-only">
        {message?.kind === 'error' && (
          <div className="text-danger">
            <p className="font-bold">{message.text}</p>
            {message.issues && message.issues.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {message.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={t.settings.importTitle}
        confirmLabel={t.settings.importConfirm}
        cancelLabel={t.settings.cancel}
        confirmDisabled={busy}
        danger
        onConfirm={() => void onConfirm()}
        onCancel={() => setPending(null)}
      >
        <p>{t.settings.importBody}</p>
        {s && (
          <>
            {(() => {
              const loss = {
                xp: Math.max(0, currentXp - s.totalXp),
                streak: Math.max(0, currentStreak - s.streak),
                lessons: Math.max(0, currentCounts.lessons - s.lessons),
                achievements: Math.max(0, currentCounts.achievements - s.achievements),
              };
              const anyLoss = Object.values(loss).some((n) => n > 0);
              return (
                anyLoss && (
                  <p className="rounded-2xl border-2 border-danger bg-danger-soft p-3 font-bold text-danger">
                    {t.settings.importLoss(loss)}
                  </p>
                )
              );
            })()}
            <div className="grid grid-cols-1 gap-2 text-ink sm:grid-cols-2">
              {[
                {
                  title: t.settings.importCurrentTitle,
                  lessons: currentCounts.lessons,
                  achievements: currentCounts.achievements,
                  xp: currentXp,
                  streak: currentStreak,
                  longest: currentLongest,
                  date: null,
                },
                {
                  title: t.settings.importSummary,
                  lessons: s.lessons,
                  achievements: s.achievements,
                  xp: s.totalXp,
                  streak: s.streak,
                  longest: s.longest,
                  date: s.exportedAt,
                },
              ].map((col) => (
                <div key={col.title} className="rounded-2xl bg-surface-2 p-3">
                  <p className="font-bold">{col.title}</p>
                  {/* Same rows in the same order in both columns, so they line up. */}
                  <ul className="mt-1 space-y-0.5">
                    <li>{t.settings.importLessons(col.lessons)}</li>
                    <li>{t.settings.importAchievements(col.achievements)}</li>
                    <li>{t.settings.importXp(col.xp)}</li>
                    <li>{t.settings.importStreak(col.streak, col.longest)}</li>
                  </ul>
                  {col.date && (
                    <p className="mt-1 text-sm text-ink-muted">
                      {t.settings.importDate(formatDate(col.date))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </ConfirmDialog>
    </section>
  );
}
