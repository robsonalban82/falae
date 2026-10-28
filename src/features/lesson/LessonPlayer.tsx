import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/routes';
import type { Exercise } from '../../content/schema';
import { gradeExercise, type ExerciseResponse } from '../../domain/grading/grade';
import { COMBO_STEP } from '../../domain/gamification/xp';
import {
  currentExercise,
  lessonProgress,
  lessonReducer,
  summarize,
  type LessonState,
  type LessonSummary,
} from '../../domain/lesson/engine';
import { t } from '../../i18n/pt-BR';
import { clock } from '../../services/clock';
import { vibrate } from '../../services/haptics';
import { playSound } from '../../services/sound';
import { useProfile } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { Button } from '../../ui/Button';
import { En } from '../../ui/En';
import { ProgressBar } from '../../ui/ProgressBar';
import { ExerciseView } from './exercises/exerciseRegistry';
import { FeedbackPanel } from './FeedbackPanel';
import { HeartsBadge } from './HeartsBadge';
import { LessonComplete } from './LessonComplete';
import { OutOfHearts } from './OutOfHearts';
import { clearSession, saveSession } from './sessionStore';
import { ExitDialog } from './ExitDialog';

const SPEAK_PAUSE_MS = 60 * 60 * 1000;

type Props = { initial: LessonState; knownWords: ReadonlySet<string> };

/** Answer language for the correct-answer line in feedback. */
const answerLang = (ex: Exercise): 'en' | 'pt' => (ex.type === 'translate-typing' ? 'pt' : 'en');

export function LessonPlayer({ initial, knownWords }: Props) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(lessonReducer, initial);
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [saveAttempt, setSaveAttempt] = useState(0);
  const committedAttempt = useRef(-1);
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const spendHeart = useProfile((s) => s.spendHeart);
  const commitLesson = useProfile((s) => s.commitLesson);
  const heartsNow = useProfile((s) => s.heartsNow);

  const exercise = currentExercise(state);
  const progress = lessonProgress(state);

  useEffect(() => saveSession(state), [state]);

  // Summary is fixed the moment the lesson finishes.
  const finished = state.status === 'finished';
  const summary = useMemo<LessonSummary | null>(
    () => (finished ? summarize(state, clock.now()) : null),
    [finished], // eslint-disable-line react-hooks/exhaustive-deps -- computed once at the finish line
  );

  useEffect(() => {
    // Guard: StrictMode re-runs effects in dev; a result must be written exactly once per attempt.
    if (!summary || committedAttempt.current === saveAttempt) return;
    committedAttempt.current = saveAttempt;
    if (saveAttempt === 0) {
      playSound('complete', settings.sound);
      vibrate('complete', settings.haptics);
    }
    commitLesson(state, summary, settings.dailyGoalXp).then(
      () => {
        clearSession();
        setSaveStatus('saved');
      },
      (err: unknown) => {
        console.error('[falae] Could not save lesson', err);
        setSaveStatus('error');
      },
    );
  }, [summary, saveAttempt]); // eslint-disable-line react-hooks/exhaustive-deps -- save once per attempt

  useEffect(() => {
    if (state.status === 'outOfHearts') clearSession();
  }, [state.status]);

  // "Não posso falar agora" pauses speak exercises for an hour, including later ones in this lesson.
  const speakPaused =
    settings.speakDisabledUntil !== undefined &&
    Date.parse(settings.speakDisabledUntil) > clock.now();
  useEffect(() => {
    if (state.status === 'answering' && exercise?.type === 'speak' && speakPaused)
      dispatch({ type: 'skip' });
  }, [state.status, exercise, speakPaused]);

  const check = useCallback(
    (override?: ExerciseResponse) => {
      const answer = override ?? response;
      if (state.status !== 'answering' || !exercise || !answer) return;
      const grade = gradeExercise(exercise, answer, { knownWords });
      const ok = grade.verdict !== 'wrong';
      playSound(
        ok ? ((state.combo + 1) % COMBO_STEP === 0 ? 'combo' : 'correct') : 'wrong',
        settings.sound,
      );
      vibrate(ok ? 'correct' : 'wrong', settings.haptics);
      if (!ok && state.usesHearts) void spendHeart();
      dispatch({ type: 'answer', grade });
    },
    [
      state.status,
      state.combo,
      state.usesHearts,
      exercise,
      response,
      knownWords,
      settings.sound,
      settings.haptics,
      spendHeart,
    ],
  );

  const next = useCallback(() => {
    setResponse(null);
    dispatch({ type: 'continue' });
  }, []);

  const skip = useCallback(() => {
    void updateSettings({
      speakDisabledUntil: new Date(clock.now() + SPEAK_PAUSE_MS).toISOString(),
    });
    setResponse(null);
    dispatch({ type: 'skip' });
  }, [updateSettings]);

  // Enter checks (outside text fields, which handle Enter themselves).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || confirmExit) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) return;
      if (state.status === 'answering') {
        // Prevent the same keypress from activating "Continuar", which receives focus right away.
        e.preventDefault();
        check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, check, confirmExit]);

  const praiseList = t.lesson.feedback.correct;
  const praise = praiseList[state.solved.length % praiseList.length] ?? praiseList[0];

  if (state.status === 'outOfHearts')
    return <OutOfHearts nextHeartInMs={heartsNow().nextHeartInMs} />;
  if (state.status === 'finished' && summary) {
    return (
      <LessonComplete
        summary={summary}
        saving={saveStatus === 'saving'}
        saveError={saveStatus === 'error'}
        onRetry={() => {
          setSaveStatus('saving');
          setSaveAttempt((n) => n + 1);
        }}
        onContinue={() => navigate(paths.path)}
      />
    );
  }
  if (!exercise) return null;

  const comboMessage =
    state.combo > 0 && state.combo % COMBO_STEP === 0
      ? t.lesson.feedback.combo(state.combo)
      : undefined;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          aria-label={t.lesson.close}
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
        <ProgressBar value={progress.done} max={progress.total} label={t.lesson.progress} />
        {state.usesHearts && <HeartsBadge hearts={state.hearts} />}
      </header>

      <main id="conteudo" className="flex-1 py-6">
        <ExerciseView
          key={`${exercise.id}-${state.turn}`}
          exercise={exercise}
          disabled={state.status !== 'answering'}
          onChange={setResponse}
          onSubmit={check}
          onSkip={skip}
          sound={settings.sound}
        />
      </main>

      <footer className="sticky bottom-0 bg-bg pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {state.status === 'feedback' && state.lastGrade ? (
          <FeedbackPanel
            grade={state.lastGrade}
            explanation={exercise.explanation}
            answerLang={answerLang(exercise)}
            praise={praise ?? ''}
            comboMessage={comboMessage}
            onContinue={next}
          />
        ) : (
          <Button block disabled={!response} onClick={() => check()}>
            {t.lesson.check}
          </Button>
        )}
      </footer>

      {/* Always mounted so screen readers announce changes (regions inserted with content are often skipped). */}
      <p role="status" aria-live="assertive" className="sr-only">
        {state.status === 'feedback' && state.lastGrade && (
          <>
            {state.lastGrade.verdict === 'correct'
              ? praise
              : state.lastGrade.verdict === 'almost'
                ? t.lesson.feedback.almost
                : t.lesson.feedback.wrong}
            {state.lastGrade.verdict !== 'correct' && (
              <>
                {' '}
                {t.lesson.feedback.correctAnswer}{' '}
                {answerLang(exercise) === 'en' ? (
                  <En>{state.lastGrade.correctAnswer}</En>
                ) : (
                  state.lastGrade.correctAnswer
                )}
              </>
            )}
          </>
        )}
      </p>

      <ExitDialog
        open={confirmExit}
        onStay={() => setConfirmExit(false)}
        onLeave={() => {
          clearSession();
          navigate(paths.path);
        }}
      />
    </div>
  );
}
