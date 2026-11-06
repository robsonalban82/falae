import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { paths } from '../../app/routes';
import { loadKnownWords } from '../../content/loader';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { buildMapPracticeSession, mapPracticeLessonId } from '../../stores/usePractice';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { useAsync } from '../../ui/useAsync';
import { LessonPlayer } from '../lesson/LessonPlayer';
import { loadSession } from '../lesson/sessionStore';

/** Route /mapas/:mapId/praticar (full screen): resumes the saved session or builds one from the map. */
export function MapPracticeSession() {
  const { mapId = '' } = useParams();
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const progressLoaded = useProgress((s) => s.loaded);
  const loadProgress = useProgress((s) => s.load);

  useEffect(() => {
    if (!profileLoaded) void loadProfile();
    if (!progressLoaded) void loadProgress();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per visit

  if (!profileLoaded || !settingsLoaded || !progressLoaded) return null;
  return <MapPracticeBoot key={mapId} mapId={mapId} />;
}

function MapPracticeBoot({ mapId }: { mapId: string }) {
  const speakDisabledUntil = useSettings((s) => s.settings.speakDisabledUntil);
  const { state, retry } = useAsync(`map-practice:${mapId}`, async () => {
    const knownWords = await loadKnownWords();
    // Only a saved run of this very map resumes: without its context the commit would skip mapProgress.
    const saved = loadSession(mapPracticeLessonId(mapId));
    const resumed = saved?.context?.mapId === mapId ? saved : null;
    const initial =
      resumed ??
      (await buildMapPracticeSession(mapId, {
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
  // Unknown map (or nothing to practice): back to the list.
  if (!initial) return <Navigate to={paths.maps} replace />;
  return <LessonPlayer initial={initial} knownWords={knownWords} exitTo={paths.map(mapId)} />;
}
