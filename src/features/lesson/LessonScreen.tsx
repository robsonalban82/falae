import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { paths, type PathNotice } from '../../app/routes';
import { indexUnits, type LessonRef } from '../../content/course';
import { findLesson, isDemoUnit, loadKnownWords, loadLesson } from '../../content/loader';
import { applyFallbacks } from '../../domain/lesson/fallbacks';
import { startLesson, type LessonState } from '../../domain/lesson/engine';
import { canOpenLesson } from '../../domain/progression/pathState';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { useAsync } from '../../ui/useAsync';
import { LessonPlayer } from './LessonPlayer';
import { discardSession, loadSession, readHeartsPending } from './sessionStore';

function backToPath(notice: PathNotice) {
  return <Navigate to={paths.path} replace state={{ notice }} />;
}

/** Route /licao/:lessonId — guards unlock rules, waits for profile/settings, then boots the lesson. */
export function LessonScreen() {
  const { lessonId = '' } = useParams();
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const progressLoaded = useProgress((s) => s.loaded);
  const loadProgress = useProgress((s) => s.load);
  const pathState = useProgress((s) => s.pathState);
  const ref = findLesson(lessonId);
  // Decided once per lesson id: finishing the lesson must not re-run the guard mid-screen.
  const [allowed, setAllowed] = useState<{ id: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!profileLoaded) void loadProfile();
  }, [profileLoaded, loadProfile]);
  useEffect(() => {
    if (!progressLoaded) void loadProgress();
  }, [progressLoaded, loadProgress]);

  const decided = allowed?.id === lessonId ? allowed.ok : null;
  if (ref && progressLoaded && decided === null) {
    // Adjusting state while rendering (React-sanctioned): decide once the progress is known.
    setAllowed({ id: lessonId, ok: isDemoUnit(ref.unitId) || canOpenLesson(pathState, lessonId) });
  }
  useEffect(() => {
    // A saved session of a lesson that became locked (import/reset) is dropped, never resumed.
    if (decided === false) discardSession(lessonId);
  }, [decided, lessonId]);

  if (!ref) return backToPath('lessonNotFound');
  if (decided === false) return backToPath('lessonLocked');
  if (decided === null || !profileLoaded || !settingsLoaded) return null;
  return <LessonLoad key={lessonId} lessonId={lessonId} />;
}

/** Imports and validates only the lesson's unit (ADR-012); skeleton while loading, error state if invalid. */
function LessonLoad({ lessonId }: { lessonId: string }) {
  const { state, retry } = useAsync(lessonId, async () => {
    const [lessonRef, knownWords] = await Promise.all([loadLesson(lessonId), loadKnownWords()]);
    if (!lessonRef) throw new Error(`Lesson ${lessonId} missing from its unit`);
    return { lessonRef, knownWords };
  });
  if (state.status === 'loading') return <ContentSkeleton />;
  if (state.status === 'error') return <ContentError onRetry={retry} />;
  return <LessonBoot {...state.value} />;
}

/** Builds the initial state once: resume from sessionStorage, else start fresh with fallbacks. */
function LessonBoot({
  lessonRef,
  knownWords,
}: {
  lessonRef: LessonRef;
  knownWords: ReadonlySet<string>;
}) {
  const items = useMemo(() => indexUnits([lessonRef.unit]).items, [lessonRef]);
  const heartsNow = useProfile((s) => s.heartsNow);
  const reconcileHearts = useProfile((s) => s.reconcileHearts);
  // Read before LessonPlayer saves the session again (its effects run first and drop the mark).
  const [pendingHearts] = useState(() => readHeartsPending(lessonRef.lesson.id));
  useEffect(() => {
    // A reload right after a mistake may have lost the heart write: re-apply it (idempotent).
    if (pendingHearts !== null) void reconcileHearts(pendingHearts);
  }, [pendingHearts, reconcileHearts]);
  const speakDisabledUntil = useSettings((s) => s.settings.speakDisabledUntil);
  const [initial] = useState<LessonState>(() => {
    const lessonId = lessonRef.lesson.id;
    const resumed = loadSession(lessonId);
    if (resumed) return resumed;
    const exercises = applyFallbacks(
      lessonRef.lesson.exercises,
      {
        tts: ttsSupported(),
        stt: sttSupported(),
        speakDisabled:
          speakDisabledUntil !== undefined && Date.parse(speakDisabledUntil) > clock.now(),
      },
      (id) => items.get(id),
    );
    return startLesson({
      lessonId,
      kind: lessonRef.skill ? 'lesson' : 'review',
      exercises,
      hearts: heartsNow().hearts,
      nowMs: clock.now(),
    });
  });
  return <LessonPlayer initial={initial} knownWords={knownWords} />;
}
