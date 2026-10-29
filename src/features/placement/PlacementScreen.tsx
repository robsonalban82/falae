import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { paths } from '../../app/routes';
import { loadCourse, pathUnits } from '../../content/loader';
import { startLesson, type LessonState } from '../../domain/lesson/engine';
import { pickPlacementExercises } from '../../domain/progression/placement';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { useProfile } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { loadSession } from '../lesson/sessionStore';
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
  const unit = pathUnits()[0];
  const [initial] = useState<LessonState | null>(() => {
    const resumed = loadSession(PLACEMENT_LESSON_ID);
    if (resumed) return resumed;
    if (!unit) return null;
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
  if (!initial || !unit) return <Navigate to={paths.path} replace />;
  const unitItemIds = unit.skills.flatMap((s) => [...s.vocab, ...s.sentences].map((i) => i.id));
  return (
    <PlacementPlayer
      initial={initial}
      knownWords={loadCourse().course.knownWords}
      unitItemIds={unitItemIds}
    />
  );
}
