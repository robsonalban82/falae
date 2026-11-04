import { expect, test } from '@playwright/test';

/** Dexie multiplies the declared version by 10 for the physical IndexedDB version. */
const V1_PHYSICAL_VERSION = 10;
const NOW = '2026-10-28T12:00:00.000Z';

const profile = {
  id: 'me',
  createdAt: '2026-10-01T10:00:00.000Z',
  onboardingDone: true,
  totalXp: 120,
  hearts: 4,
  heartsUpdatedAt: NOW,
  streak: { current: 3, longest: 5, lastActiveDay: '2026-10-28', freezes: 1, xpTowardFreeze: 20 },
};
const lessonProgress = [
  { lessonId: 'u1-sk1-l1', completedCount: 2, bestAccuracy: 0.9, firstCompletedAt: NOW },
];
const daily = [{ day: '2026-10-28', xp: 35, lessons: 2, goalMet: true }];

test.describe('migration v1 -> v2 (real physical database)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');

  test('a v1 database upgrades in place: progress intact, new tables empty', async ({ page }) => {
    // Create the physical v1 DB before any app script runs (once per tab, not on reload).
    await page.addInitScript(
      ({ version, seed, clock }) => {
        if (sessionStorage.getItem('v1-seeded')) return;
        sessionStorage.setItem('v1-seeded', '1');
        sessionStorage.setItem('falae-test-clock', JSON.stringify(clock));
        const req = indexedDB.open('falae', version);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('profile', { keyPath: 'id' });
          db.createObjectStore('settings', { keyPath: 'id' });
          db.createObjectStore('lessonProgress', { keyPath: 'lessonId' });
          const results = db.createObjectStore('results', { keyPath: 'id' });
          for (const ix of ['day', 'lessonId', 'finishedAt']) results.createIndex(ix, ix);
          const srs = db.createObjectStore('srs', { keyPath: 'itemId' });
          srs.createIndex('dueDay', 'dueDay');
          db.createObjectStore('daily', { keyPath: 'day' });
          db.createObjectStore('achievements', { keyPath: 'id' });
          db.createObjectStore('quarantine', { keyPath: 'id', autoIncrement: true });
          const tx = req.transaction;
          if (!tx) return;
          tx.objectStore('profile').put(seed.profile);
          for (const l of seed.lessonProgress) tx.objectStore('lessonProgress').put(l);
          for (const d of seed.daily) tx.objectStore('daily').put(d);
        };
        req.onsuccess = () => req.result.close();
      },
      {
        version: V1_PHYSICAL_VERSION,
        seed: { profile, lessonProgress, daily },
        clock: { fixedMs: Date.parse('2026-10-28T15:00:00.000Z'), offsetMs: 0 },
      },
    );

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    await expect(page.getByRole('link', { name: /Lição 1 de 3, .*, concluída/ })).toBeVisible();

    const exported = (await page.evaluate(() =>
      (
        window as unknown as { __falae?: { exportForTest?: () => Promise<unknown> } }
      ).__falae?.exportForTest?.(),
    )) as {
      data: Record<string, unknown>;
    };
    expect(exported.data['profile']).toEqual(profile);
    expect(exported.data['lessonProgress']).toEqual(lessonProgress);
    expect(exported.data['daily']).toEqual(daily);
    // The export is v2 now and includes the new tables, empty after the migration.
    expect(exported.data['userCards']).toEqual([]);
    expect(exported.data['mapProgress']).toEqual([]);
    expect(exported.data['planProgress']).toEqual([]);

    // The new tables exist (physical version 20) and are empty.
    const physical = await page.evaluate(
      () =>
        new Promise<{ version: number; counts: Record<string, number> }>((resolve, reject) => {
          const req = indexedDB.open('falae');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const names = ['userCards', 'mapProgress', 'planProgress'];
            const tx = db.transaction(names);
            const counts: Record<string, number> = {};
            let pending = names.length;
            for (const n of names) {
              const c = tx.objectStore(n).count();
              c.onsuccess = () => {
                counts[n] = c.result;
                if (--pending === 0) {
                  const version = db.version;
                  db.close();
                  resolve({ version, counts });
                }
              };
            }
          };
        }),
    );
    expect(physical.version).toBe(20);
    expect(physical.counts).toEqual({ userCards: 0, mapProgress: 0, planProgress: 0 });

    await page.goto('/perfil');
    // Scoped to the profile stats: the stats bar on top shows the same XP.
    const stats = page.locator('dl');
    await expect(stats.getByText('120', { exact: true })).toBeVisible();
    await expect(stats.getByText('3 dias', { exact: true })).toBeVisible();
  });
});
