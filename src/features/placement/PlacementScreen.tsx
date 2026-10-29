import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { paths } from '../../app/routes';
import { loadKnownWords, loadUnit, pathUnits } from '../../content/loader';
import type { Unit } from '../../content/schema';
import { startLesson, type LessonState } from '../../domain/lesson/engine';
import { pickPlacementExercises } from '../../domain/progression/placement';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { useProfile } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { loadSession } from '../lesson/sessionStore';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { useAsync } from '../../ui/useAsync';
import { PlacementPlayer } from './PlacementPlayer';

const PLACEMENT_LESSON_ID = 'placement';

/** Route /nivelamento — taken once (a placement already on the profile goes back to the path). */
export function PlacementScreen() {
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const placement = useProfile((s) => s.profile.placement);
  // Decided once: saving the result sets `placement` and must not unmount the result screen.
  const [alreadyTaken, setAlreadyTaken] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profileLoaded) void loadProfile();
  }, [profileLoaded, loadProfile]);

  if (profileLoaded && alreadyTaken === null) setAlreadyTaken(placement !== undefined);
  if (!profileLoaded || !settingsLoaded || alreadyTaken === null) return null;
  if (alreadyTaken) return <Navigate to={paths.path} replace />;
  return <PlacementBoot />;
}

function PlacementBoot() {
  const first = pathUnits()[0];
  const { state, retry } = useAsync(first?.id ?? '', async () => {
    if (!first) return null;
    const [unit, knownWords] = await Promise.all([loadUnit(first.id), loadKnownWords()]);
    return { unit, knownWords };
  });
  if (state.status === 'loading') return <ContentSkeleton />;
  if (state.status === 'error') return <ContentError onRetry={retry} />;
  if (!state.value) return <Navigate to={paths.path} replace />;
  return <PlacementStart {...state.value} />;
}

function PlacementStart({ unit, knownWords }: { unit: Unit; knownWords: ReadonlySet<string> }) {
  const [initial] = useState<LessonState | null>(() => {
    const resumed = loadSession(PLACEMENT_LESSON_ID);
    if (resumed) return resumed;
    const exercises = pickPlacementExercises(
      unit,
      { tts: ttsSupported(), stt: sttSupported(), speakDisabled: true },
      clock.now(),
    );
    if (exercises.length === 0) return null;
    return startLesson({
      lessonId: PLACEMENT_LESSON_ID,
      kind: 'placement',
      exercises,
      hearts: 0,
      nowMs: clock.now(),
    });
  });
  if (!initial) return <Navigate to={paths.path} replace />;
  const unitItemIds = unit.skills.flatMap((s) => [...s.vocab, ...s.sentences].map((i) => i.id));
  return <PlacementPlayer initial={initial} knownWords={knownWords} unitItemIds={unitItemIds} />;
}
