/** First-run rule (derived, no migration): old profiles with progress are never sent to onboarding. */
export function needsOnboarding(
  profile: { onboardingDone: boolean; totalXp: number },
  completedLessons: number,
): boolean {
  return !profile.onboardingDone && profile.totalXp === 0 && completedLessons === 0;
}
