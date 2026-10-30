import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { PathNotice } from '../../app/routes';
import { pathUnits } from '../../content/loader';
import type { LessonNode } from '../../domain/progression/pathState';
import { t } from '../../i18n/pt-BR';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { PathHeader } from './PathHeader';
import { UnitSection } from './UnitSection';

const notices: Record<PathNotice, string> = {
  lessonLocked: t.path.lessonLocked,
  lessonNotFound: t.path.lessonNotFound,
  tipNotFound: t.path.tipNotFound,
};

function readNotice(state: unknown): PathNotice | null {
  if (state && typeof state === 'object' && 'notice' in state) {
    const n = state.notice;
    if (n === 'lessonLocked' || n === 'lessonNotFound' || n === 'tipNotFound') return n;
  }
  return null;
}

/** Route / — the course path with the real state of every lesson. */
export function PathScreen() {
  const location = useLocation();
  const reduceMotion = useReducedMotion() ?? false;
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const loadProgress = useProgress((s) => s.load);
  const progressLoaded = useProgress((s) => s.loaded);
  const pathState = useProgress((s) => s.pathState);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    // Always refresh on entry: the day may have changed since the last visit.
    void loadProgress();
    if (!profileLoaded) void loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per visit

  const ready = profileLoaded && progressLoaded && settingsLoaded;
  const units = pathUnits();

  // Scroll (never focus) to the current lesson once, after the real state is in.
  const currentRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el || scrolled.current) return;
      scrolled.current = true;
      // Wait for layout (fonts, unit sections below) so centering is right on tall mobile pages.
      requestAnimationFrame(() =>
        el.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }),
      );
    },
    [reduceMotion],
  );

  const onLockedPress = useCallback((node: LessonNode) => {
    const unit = pathUnits().find((u) => u.id === node.unitId);
    setLockedMessage(
      node.skillId === null ? t.path.reviewLocked(unit?.skills.length ?? 0) : t.path.nodeLocked,
    );
  }, []);

  // The redirect notice is shown once: keep it locally and drop it from history state,
  // so a reload does not bring it back.
  const navigate = useNavigate();
  const [notice] = useState(() => readNotice(location.state));
  useEffect(() => {
    if (readNotice(location.state)) void navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);
  const message = lockedMessage ?? (notice ? notices[notice] : null);

  return (
    <div>
      <h1 className="sr-only">{t.path.title}</h1>
      <div role="status">
        {message && (
          <p className="mb-4 rounded-card border-2 border-line-strong bg-surface-2 px-4 py-3 font-bold text-ink">
            {message}
          </p>
        )}
      </div>
      {!ready ? (
        <div aria-busy="true" aria-label={t.path.loading} className="animate-pulse space-y-6">
          <div className="h-14 rounded-card bg-surface-2" />
          <div className="h-24 rounded-card bg-surface-2" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mx-auto h-16 w-16 rounded-full bg-surface-2" />
          ))}
        </div>
      ) : (
        <>
          <PathHeader />
          {units.map((unit, i) => {
            const state = pathState.units[i];
            if (!state) return null;
            return (
              <UnitSection
                key={unit.id}
                unit={unit}
                state={state}
                number={unit.order}
                reduceMotion={reduceMotion}
                onLockedPress={onLockedPress}
                currentRef={currentRef}
              />
            );
          })}
          {pathState.currentLessonId === null && units.length > 0 && (
            <p className="text-center font-bold text-success">{t.path.courseDone}</p>
          )}
        </>
      )}
    </div>
  );
}
