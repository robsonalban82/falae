import { expect, test, type Page } from '@playwright/test';
import { lessonExercises, noRecognition, playLesson } from './helpers/playLesson';
import { advanceDays, seed, startAt, today } from './helpers/seed';

/** QA (Fase 5): trying to break path, guard, streak, goal, achievements and finish screen. */

const DAY = '2026-10-29';
const finish = (page: Page) => page.locator('section').first();
const streakImg = (page: Page) => page.getByRole('img', { name: /^Ofensiva:/ });

/** Raw IndexedDB snapshot (bypasses the app so we see what was really written). */
async function dbDump(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = ['profile', 'results', 'lessonProgress', 'daily', 'achievements'];
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, unknown[]> = {};
          let left = names.length;
          for (const n of names) {
            const r = tx.objectStore(n).getAll();
            r.onsuccess = () => {
              out[n] = r.result;
              if (--left === 0) {
                db.close();
                resolve(out);
              }
            };
          }
        };
      }),
  );
}
type P = { totalXp: number; streak: { current: number; freezes: number; lastActiveDay?: string } };
const profileOf = (d: Record<string, unknown[]>) => d.profile?.[0] as P;

test.beforeEach(async ({ page }) => {
  await noRecognition(page);
  await startAt(page, `${DAY}T12:00:00`);
});

test.describe('virada de dia e relógio', () => {
  test('lesson at 23:59, next at 00:01 next day: streak 2', async ({ page }) => {
    await startAt(page, `${DAY}T23:58:00`);
    await playLesson(page, 'u1-sk1-l1');
    await page.evaluate(() =>
      (window as unknown as { __falae: { setNow: (v: string) => void } }).__falae.setNow(
        '2026-10-30T00:01:00',
      ),
    );
    await page.goto('/');
    expect(await today(page)).toBe('2026-10-30');
    await expect(streakImg(page)).toHaveAccessibleName(/^Ofensiva: 1 dia/);
    await playLesson(page, 'u1-sk1-l2');
    await expect(finish(page)).toContainText('Ofensiva: 2 dias');
  });

  test('anteontem without freeze: path shows 0 and lesson resets to 1', async ({ page }) => {
    await seed(page, {
      profile: {
        streak: { current: 6, longest: 6, lastActiveDay: DAY, freezes: 0, xpTowardFreeze: 0 },
      },
    });
    await advanceDays(page, 2);
    await expect(streakImg(page)).toHaveAccessibleName(/^Ofensiva: 0 dias/);
    await playLesson(page, 'u1-sk1-l1');
    await expect(finish(page)).toContainText('Ofensiva: 1 dia');
    await expect(finish(page)).not.toContainText('Congelamento usado');
  });

  test('opening the app on a risky day writes nothing (lazy consumption)', async ({ page }) => {
    await seed(page, {
      profile: {
        streak: { current: 2, longest: 2, lastActiveDay: DAY, freezes: 1, xpTowardFreeze: 0 },
      },
    });
    await advanceDays(page, 2);
    await page.reload();
    const p = profileOf(await dbDump(page));
    expect(p.streak).toMatchObject({ current: 2, freezes: 1, lastActiveDay: DAY });
  });

  test('clock goes back a day: streak and lastActiveDay intact', async ({ page }) => {
    await seed(page, {
      profile: {
        streak: { current: 3, longest: 3, lastActiveDay: DAY, freezes: 0, xpTowardFreeze: 0 },
      },
    });
    await advanceDays(page, -1);
    await expect(streakImg(page)).toHaveAccessibleName(/^Ofensiva: 3 dias/);
    await playLesson(page, 'u1-sk1-l1');
    await expect(finish(page)).toContainText('Ofensiva: 3 dias');
    const p = profileOf(await dbDump(page));
    expect(p.streak).toMatchObject({ current: 3, lastActiveDay: DAY });
  });
});

test.describe('gravação única', () => {
  test('redo a completed lesson: opens, saves a 2nd result, streak same day unchanged', async ({
    page,
  }) => {
    await playLesson(page, 'u1-sk1-l1');
    await page.getByRole('button', { name: 'Continuar' }).click();
    // The simulated clock is frozen; move it so the second run gets its own startedAt.
    await page.evaluate(() =>
      (
        window as unknown as { __falae: { advanceHours: (h: number) => void } }
      ).__falae.advanceHours(1),
    );
    await page
      .getByRole('link', { name: /^Lição 1 de 3, .*, concluída$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/licao\/u1-sk1-l1$/);
    await playLesson(page, 'u1-sk1-l1');
    await expect(finish(page)).toContainText('Ofensiva: 1 dia');
    await expect(finish(page)).not.toContainText('Primeira lição');
    const d = await dbDump(page);
    expect(d.results).toHaveLength(2);
    expect(d.lessonProgress).toHaveLength(1);
    expect((d.lessonProgress?.[0] as { completedCount: number }).completedCount).toBe(2);
    expect(d.achievements?.filter((a) => (a as { id: string }).id === 'first-lesson')).toHaveLength(
      1,
    );
  });

  test('reload right after finishing does not save twice', async ({ page }) => {
    await playLesson(page, 'u1-sk1-l1');
    const before = await dbDump(page);
    await page.reload();
    await page.reload();
    const after = await dbDump(page);
    expect(after.results).toHaveLength(1);
    expect(profileOf(after).totalXp).toBe(profileOf(before).totalXp);
    expect((after.daily?.[0] as { lessons: number }).lessons).toBe(1);
  });

  test('back button after finishing does not save twice', async ({ page }) => {
    await playLesson(page, 'u1-sk1-l1');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.goBack();
    await page.waitForTimeout(500);
    await page.goto('/');
    const d = await dbDump(page);
    expect(d.results).toHaveLength(1);
  });

  test('reload mid-lesson keeps going and saves exactly once', async ({ page }) => {
    await page.goto('/licao/u1-sk1-l1');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    expect((await dbDump(page)).results).toHaveLength(0);
  });

  test('double click on Continuar at the end saves once', async ({ page }) => {
    await playLesson(page, 'u1-sk1-l1');
    await page.getByRole('button', { name: 'Continuar' }).dblclick();
    await expect(page).toHaveURL(/\/$/);
    expect((await dbDump(page)).results).toHaveLength(1);
  });
});

test.describe('guarda de rota', () => {
  for (const id of ['u1-sk2-l1', 'u1-review', 'u4-sk1-l1']) {
    test(`locked ${id} by URL redirects and writes nothing`, async ({ page }) => {
      const before = await dbDump(page);
      await page.goto(`/licao/${id}`);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('status').first()).toHaveText(/bloqueada/);
      const after = await dbDump(page);
      expect(after).toEqual(before);
    });
  }

  test('unknown lesson id redirects with a not-found notice', async ({ page }) => {
    await page.goto('/licao/nao-existe');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('status').first()).toBeVisible();
  });

  test('back after redirect does not land on the locked lesson', async ({ page }) => {
    await page.goto('/licao/u1-sk1-l3');
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/u1-sk1-l3/);
  });

  test('notice does not persist after reload', async ({ page }) => {
    await page.goto('/licao/u1-sk1-l2');
    await expect(page.getByRole('status').first()).toHaveText(/bloqueada/);
    await page.reload();
    await expect(page.getByText(/ainda está bloqueada/)).toHaveCount(0);
  });

  test('locked node button shows a hint and does not navigate', async ({ page }) => {
    // aria-disabled makes Playwright treat it as disabled; a real tap still fires.
    await page
      .getByRole('button', { name: /bloqueada/ })
      .first()
      .click({ force: true });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/Termine a lição anterior/)).toBeVisible();
  });

  test('session saved for a lesson that later becomes locked is discarded', async ({ page }) => {
    await seed(page, { lessonProgress: [{ lessonId: 'u1-sk1-l1' }] });
    await page.goto('/licao/u1-sk1-l2');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    await page.goto('/');
    await seed(page, {});
    await page.goto('/licao/u1-sk1-l2');
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => sessionStorage.getItem('falae-lesson-session'))).toBeNull();
  });

  test('unknown tip redirects; locked skill tip is readable', async ({ page }) => {
    await page.goto('/dica/nada');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/dica/u2-sk1');
    await expect(page).toHaveURL(/\/dica\/u2-sk1$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('teclado e acessibilidade', () => {
  test('Tab order on the path follows visual order and has visible focus', async ({ page }) => {
    const links = await page
      .locator('main ol a, main ol button')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top + window.scrollY));
    for (let i = 1; i < links.length; i++)
      expect(links[i]!).toBeGreaterThanOrEqual(links[i - 1]! - 1);
    await page
      .getByRole('button', { name: /bloqueada/ })
      .first()
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Termine a lição anterior/)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('path nodes are at least 44px', async ({ page }) => {
    const sizes = await page
      .locator('main ol a, main ol button')
      .evaluateAll((els) =>
        els.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]),
      );
    for (const [w, h] of sizes) {
      expect(w).toBeGreaterThanOrEqual(44);
      expect(h).toBeGreaterThanOrEqual(44);
    }
  });

  test('path scrolls to the current node without stealing focus', async ({ page }) => {
    const unit1 = [1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => `u1-sk${s}-l${l}`));
    await seed(page, { lessonProgress: [...unit1, 'u1-review'].map((lessonId) => ({ lessonId })) });
    const cur = page.getByRole('link', { name: /atual$/ });
    await expect(cur).toBeInViewport();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('A');
  });
});

test('offline after first load: path, lesson and save work', async ({ page }) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
  expect(lessonExercises('u1-sk1-l1').length).toBeGreaterThan(0);
  await playLesson(page, 'u1-sk1-l1');
  await expect(finish(page)).toContainText('Ofensiva: 1 dia');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('link', { name: /^Lição 2 de 3, .*, atual$/ })).toBeVisible();
  await page.context().setOffline(false);
});
