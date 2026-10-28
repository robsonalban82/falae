import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '../../app/routes';
import type { LessonRef } from '../../content/course';
import { loadCourse } from '../../content/loader';
import { applyFallbacks } from '../../domain/lesson/fallbacks';
import { startLesson, type LessonState } from '../../domain/lesson/engine';
import { t } from '../../i18n/pt-BR';
import { clock } from '../../services/clock';
import { sttSupported, ttsSupported } from '../../services/speech';
import { useProfile } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';
import { LessonPlayer } from './LessonPlayer';
import { loadSession } from './sessionStore';

/** Route /licao/:lessonId — waits for profile/settings, then boots the lesson. */
export function LessonScreen() {
  const { lessonId = '' } = useParams();
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const { course } = loadCourse();
  const ref = course.lessons.get(lessonId);

  useEffect(() => {
    if (!profileLoaded) void loadProfile();
  }, [profileLoaded, loadProfile]);

  if (!ref) {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">{t.lesson.notFound}</h1>
        <Link to={paths.path} className="font-bold text-secondary underline underline-offset-4">
          {t.lesson.backToPath}
        </Link>
      </section>
    );
  }
  if (!profileLoaded || !settingsLoaded) return null;
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
