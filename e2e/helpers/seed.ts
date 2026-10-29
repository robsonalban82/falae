import type { Page } from '@playwright/test';

/** Partial data merged into a valid export file and imported via window.__falae.importForTest. */
export type Seed = {
  profile?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  lessonProgress?: { lessonId: string; completedCount?: number }[];
  daily?: { day: string; xp: number; lessons: number; goalMet: boolean }[];
  achievements?: { id: string; unlockedAt: string }[];
};

type Hooks = {
  setNow: (v: string) => void;
  advanceDays: (d: number) => void;
  today: () => string;
  importForTest: (file: unknown) => Promise<void>;
};

/** Fixes the simulated clock (survives reloads) and opens the path. */
export async function startAt(page: Page, isoLocal: string) {
  await page.goto('/');
  await page.evaluate((v) => (window as unknown as { __falae: Hooks }).__falae.setNow(v), isoLocal);
  await page.reload();
}

export async function advanceDays(page: Page, days: number) {
  await page.evaluate(
    (d) => (window as unknown as { __falae: Hooks }).__falae.advanceDays(d),
    days,
  );
  await page.goto('/');
}

export function today(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __falae: Hooks }).__falae.today());
}

/** Replaces all app data (validated by the app's own schema) and reloads the path. */
export async function seed(page: Page, data: Seed) {
  await page.evaluate(async (d) => {
    const hooks = (window as unknown as { __falae: Hooks }).__falae;
    const now = new Date().toISOString();
    const file = {
      app: 'falae',
      schemaVersion: 1,
      exportedAt: now,
      data: {
        profile: {
          id: 'me',
          createdAt: '2026-01-01T12:00:00.000Z',
          onboardingDone: true,
          totalXp: 0,
          hearts: 5,
          heartsUpdatedAt: now,
          streak: { current: 0, longest: 0, freezes: 0, xpTowardFreeze: 0 },
          ...d.profile,
        },
        settings: {
          id: 'me',
          dailyGoalXp: 20,
          sound: false,
          haptics: false,
          theme: 'system',
          reminder: { enabled: false, time: '19:00' },
          ...d.settings,
        },
        lessonProgress: (d.lessonProgress ?? []).map((p) => ({
          completedCount: 1,
          bestAccuracy: 1,
          firstCompletedAt: '2026-01-02T12:00:00.000Z',
          ...p,
        })),
        results: [],
        srs: [],
        daily: d.daily ?? [],
        achievements: d.achievements ?? [],
      },
    };
    await hooks.importForTest(file);
  }, data);
  await page.reload();
}
