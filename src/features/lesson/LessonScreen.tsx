import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { paths, type PathNotice } from '../../app/routes';
import type { LessonRef } from '../../content/course';
import { isDemoUnit, loadCourse } from '../../content/loader';
import { applyFallbacks } from '../../domain/lesson/fallbacks';
import { startLesson, type LessonState } from '../../domain/lesson/engine';
import { canOpenLesson } from '../../domain/progression/pathState';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { LessonPlayer } from './LessonPlayer';
import { discardSession, loadSession } from './sessionStore';

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
  const { course } = loadCourse();
  const ref = course.lessons.get(lessonId);
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
    setAllowed({ id: lessonId, ok: isDemoUnit(ref.unit.id) || canOpenLesson(pathState, lessonId) });
  }
  useEffect(() => {
    // A saved session of a lesson that became locked (import/reset) is dropped, never resumed.
    if (decided === false) discardSession(lessonId);
  }, [decided, lessonId]);

  if (!ref) return backToPath('lessonNotFound');
  if (decided === false) return backToPath('lessonLocked');
  if (decided === null || !profileLoaded || !settingsLoaded) return null;
  return <LessonBoot key={lessonId} lessonRef={ref} />;
}

/** Builds the initial state once: resume from sessionStorage, else start fresh with fallbacks. */
function LessonBoot({ lessonRef }: { lessonRef: LessonRef }) {
  const { course } = loadCourse();
  const heartsNow = useProfile((s) => s.heartsNow);
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
      (id) => course.items.get(id),
    );
    return startLesson({
      lessonId,
      kind: lessonRef.skill ? 'lesson' : 'review',
      exercises,
      hearts: heartsNow().hearts,
      nowMs: clock.now(),
    });
  });
  return <LessonPlayer initial={initial} knownWords={course.knownWords} />;
}
