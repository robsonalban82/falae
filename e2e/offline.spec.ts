import { expect, test, type Page } from '@playwright/test';
import { noRecognition, playLesson } from './helpers/playLesson';
import { seed, startAt } from './helpers/seed';

/**
 * Offline after the first visit (production build with the service worker, `vite preview`).
 * Both Playwright projects are Chromium: `context.setOffline` also cuts the service worker's
 * network, so everything below must come from the precache.
 */

const DAY = '2026-10-29';
const unit1 = [1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => ({ lessonId: `u1-sk${s}-l${l}` })));

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // First visit: the page is controlled once the SW claims it (or after one reload).
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await noRecognition(page);
});

test('offline completo: recarregar, lição de outra unidade, perfil e ajustes', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await startAt(page, `${DAY}T12:00:00`);
  // Unit 1 done → unit 2 unlocked; its JSON chunk was never loaded online.
  await seed(page, { lessonProgress: [...unit1, { lessonId: 'u1-review' }] });
  await waitForServiceWorker(page);

  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.url()} (${r.failure()?.errorText ?? ''})`));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: /atual$/ })).toHaveAttribute(
    'href',
    '/licao/u2-sk1-l1',
  );

  await playLesson(page, 'u2-sk1-l1');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('link', { name: 'Perfil' }).click();
  await expect(page.locator('dt', { hasText: 'XP total' }).locator('+ dd')).not.toHaveText('0');
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Backup do progresso' })).toBeVisible();

  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test('rota profunda recarregada offline: o SW serve o index.html (SPA fallback)', async ({
  page,
  context,
}) => {
  await startAt(page, `${DAY}T12:00:00`);
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.goto('/licao/u1-sk1-l1');
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  await page.goto('/dica/u1-sk1');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
