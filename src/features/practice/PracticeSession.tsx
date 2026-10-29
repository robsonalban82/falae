import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { paths } from '../../app/routes';
import { loadCourse } from '../../content/loader';
import type { LessonState } from '../../domain/lesson/engine';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { buildPracticeSession, PRACTICE_LESSON_ID, usePractice } from '../../stores/usePractice';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { LessonPlayer } from '../lesson/LessonPlayer';
import { loadSession } from '../lesson/sessionStore';

/** Route /praticar/sessao — resumes the saved practice (same exercises) or builds a new one. */
export function PracticeSession() {
  const [params] = useSearchParams();
  const fromOutOfHearts = params.get('from') === 'outOfHearts';
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const progressLoaded = useProgress((s) => s.loaded);
  const loadProgress = useProgress((s) => s.load);
  const cardsLoaded = usePractice((s) => s.loaded);
  const loadCards = usePractice((s) => s.load);

  useEffect(() => {
    if (!profileLoaded) void loadProfile();
    if (!progressLoaded) void loadProgress();
    void loadCards();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per visit

  if (!profileLoaded || !settingsLoaded || !progressLoaded || !cardsLoaded) return null;
  return <PracticeBoot exitTo={fromOutOfHearts ? paths.path : paths.practice} />;
}

function PracticeBoot({ exitTo }: { exitTo: string }) {
  const { course } = loadCourse();
  const speakDisabledUntil = useSettings((s) => s.settings.speakDisabledUntil);
  const [initial] = useState<LessonState | null>(() => {
    const resumed = loadSession(PRACTICE_LESSON_ID);
    if (resumed) return resumed;
    return buildPracticeSession(usePractice.getState().cards, useProgress.getState().pathState, {
      tts: ttsSupported(),
      stt: sttSupported(),
      speakDisabled:
        speakDisabledUntil !== undefined && Date.parse(speakDisabledUntil) > clock.now(),
    });
  });
  if (!initial) return <Navigate to={paths.practice} replace />;
  return <LessonPlayer initial={initial} knownWords={course.knownWords} exitTo={exitTo} />;
}
