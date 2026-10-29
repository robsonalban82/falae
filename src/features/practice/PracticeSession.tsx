import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { paths } from '../../app/routes';
import { loadKnownWords } from '../../content/loader';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { buildPracticeSession, PRACTICE_LESSON_ID, usePractice } from '../../stores/usePractice';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { useAsync } from '../../ui/useAsync';
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
  const speakDisabledUntil = useSettings((s) => s.settings.speakDisabledUntil);
  // Built once per mount: resume the saved session, else load the needed units and build one.
  const { state, retry } = useAsync('practice', async () => {
    const knownWords = await loadKnownWords();
    const resumed = loadSession(PRACTICE_LESSON_ID);
    const initial =
      resumed ??
      (await buildPracticeSession(usePractice.getState().cards, useProgress.getState().pathState, {
        tts: ttsSupported(),
        stt: sttSupported(),
        speakDisabled:
          speakDisabledUntil !== undefined && Date.parse(speakDisabledUntil) > clock.now(),
      }));
    return { initial, knownWords };
  });
  if (state.status === 'loading') return <ContentSkeleton />;
  if (state.status === 'error') return <ContentError onRetry={retry} />;
  const { initial, knownWords } = state.value;
  if (!initial) return <Navigate to={paths.practice} replace />;
  return <LessonPlayer initial={initial} knownWords={knownWords} exitTo={exitTo} />;
}
