import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/routes';
import { gradeExercise, type ExerciseResponse } from '../../domain/grading/grade';
import {
  answeredCounts,
  currentExercise,
  lessonReducer,
  summarize,
  type LessonState,
} from '../../domain/lesson/engine';
import { placementPassed, placementScore } from '../../domain/progression/placement';
import { t } from '../../i18n/pt-BR';
import { clock } from '../../services/clock';
import { useProfile, type CommitSummary } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { ExitDialog } from '../lesson/ExitDialog';
import { ExerciseView } from '../lesson/exercises/exerciseRegistry';
import { clearSession, saveSession } from '../lesson/sessionStore';
import { PlacementResult } from './PlacementResult';

type Props = { initial: LessonState; knownWords: ReadonlySet<string>; unitItemIds: string[] };

/** No feedback until the end: no sounds, no colors, "Confirmar" goes straight to the next one. */
export function PlacementPlayer({ initial, knownWords, unitItemIds }: Props) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(lessonReducer, initial);
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [exitError, setExitError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [commit, setCommit] = useState<CommitSummary | null>(null);
  const committedAttempt = useRef(-1);
  const dailyGoalXp = useSettings((s) => s.settings.dailyGoalXp);
  const commitLesson = useProfile((s) => s.commitLesson);
  const completeOnboarding = useProfile((s) => s.completeOnboarding);

  const exercise = currentExercise(state);
  const total = state.exercises.length;
  const position = Math.min(total, total - state.queue.length + 1);

  useEffect(() => saveSession(state), [state]);

  const finished = state.status === 'finished';
  const outcome = useMemo(() => (finished ? answeredCounts(state) : null), [finished]); // eslint-disable-line react-hooks/exhaustive-deps -- fixed at the finish line
  const score = outcome ? placementScore(outcome) : 0;
  const passed = placementPassed(score);

  useEffect(() => {
    if (!outcome || committedAttempt.current === saveAttempt) return;
    committedAttempt.current = saveAttempt;
    commitLesson(state, summarize(state, clock.now()), dailyGoalXp, {
      score,
      passed,
      unitItemIds,
    }).then(
      (saved) => {
        clearSession();
        setCommit(saved);
        setSaveStatus('saved');
      },
      (err: unknown) => {
        console.error('[falae] Could not save placement', err);
        setSaveStatus('error');
      },
    );
  }, [outcome, saveAttempt]); // eslint-disable-line react-hooks/exhaustive-deps -- save once per attempt

  const confirm = useCallback(
    (override?: ExerciseResponse) => {
      const answer = override ?? response;
      if (state.status !== 'answering' || !exercise || !answer) return;
      dispatch({ type: 'answer', grade: gradeExercise(exercise, answer, { knownWords }) });
      setResponse(null);
    },
    [state.status, exercise, response, knownWords],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || confirmExit) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) return;
      if (state.status === 'answering') {
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, confirm, confirmExit]);

  if (finished && outcome) {
    return (
      <PlacementResult
        correct={outcome.correct}
        answered={outcome.answered}
        passed={passed}
        missed={state.missed.map((i) => state.exercises[i]).filter((e) => e !== undefined)}
        saving={saveStatus === 'saving'}
        saveError={saveStatus === 'error'}
        saved={commit !== null}
        onRetry={() => {
          setSaveStatus('saving');
          setSaveAttempt((n) => n + 1);
        }}
        onContinue={() => void navigate(paths.path, { replace: true })}
      />
    );
  }
  if (!exercise) return null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          aria-label={t.placement.exit}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2"
        >
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <ProgressBar value={position - 1} max={total} label={t.placement.progressLabel} />
        <span className="tabular shrink-0 font-bold text-ink-muted">
          {t.placement.progress(position, total)}
        </span>
      </header>

      <main id="conteudo" className="flex-1 py-6">
        <ExerciseView
          key={`${exercise.id}-${state.turn}`}
          exercise={exercise}
          disabled={false}
          onChange={setResponse}
          onSubmit={confirm}
          onSkip={() => dispatch({ type: 'skip' })}
          sound={false}
        />
      </main>

      <footer className="sticky bottom-0 bg-bg pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p role="alert" className="mb-2 text-center font-bold text-danger empty:hidden">
          {exitError ? t.placement.exitError : ''}
        </p>
        <Button block disabled={!response} onClick={() => confirm()}>
          {t.placement.confirm}
        </Button>
      </footer>

      <ExitDialog
        open={confirmExit}
        texts={t.placement.confirmExit}
        onStay={() => setConfirmExit(false)}
        onLeave={() => {
          setExitError(false);
          completeOnboarding().then(
            () => {
              clearSession();
              void navigate(paths.path, { replace: true });
            },
            (err: unknown) => {
              // Stay here and say so, instead of leaving to a path that would bounce back.
              console.error('[falae] Could not finish onboarding', err);
              setConfirmExit(false);
              setExitError(true);
            },
          );
        }}
      />
    </div>
  );
}
