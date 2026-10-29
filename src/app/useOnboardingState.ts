import { useEffect } from 'react';
import { e2eSkipsOnboarding } from '../dev/testHooks';
import { needsOnboarding } from '../domain/progression/onboarding';
import { useProfile } from '../stores/useProfile';
import { useProgress } from '../stores/useProgress';

/** null while loading; otherwise whether the first-run flow is still pending. */
export function useOnboardingPending(): boolean | null {
  const profile = useProfile((s) => s.profile);
  const profileLoaded = useProfile((s) => s.loaded);
  const loadProfile = useProfile((s) => s.load);
  const progressLoaded = useProgress((s) => s.loaded);
  const progressCount = useProgress((s) => s.progress.length);
  const loadProgress = useProgress((s) => s.load);

  useEffect(() => {
    if (!profileLoaded) void loadProfile();
    if (!progressLoaded) void loadProgress();
  }, [profileLoaded, progressLoaded, loadProfile, loadProgress]);

  if (!profileLoaded || !progressLoaded) return null;
  if (import.meta.env.VITE_E2E === '1' && e2eSkipsOnboarding()) return false;
  return needsOnboarding(profile, progressCount);
}
