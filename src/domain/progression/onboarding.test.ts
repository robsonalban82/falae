import { needsOnboarding } from './onboarding';

describe('needsOnboarding', () => {
  it('only a brand-new profile goes to the welcome flow', () => {
    expect(needsOnboarding({ onboardingDone: false, totalXp: 0 }, 0)).toBe(true);
    expect(needsOnboarding({ onboardingDone: true, totalXp: 0 }, 0)).toBe(false);
    expect(needsOnboarding({ onboardingDone: false, totalXp: 10 }, 0)).toBe(false);
    expect(needsOnboarding({ onboardingDone: false, totalXp: 0 }, 1)).toBe(false);
  });
});
