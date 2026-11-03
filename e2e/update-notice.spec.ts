import { expect, test } from '@playwright/test';

test('update notice pushes the page down instead of covering the sticky header', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();

  const other = await context.newPage();
  await other.goto('/sobre-nada-404').catch(() => undefined);
  await other.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('falae', 40);
        req.onupgradeneeded = () => req.result.createObjectStore('future', { keyPath: 'id' });
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await other.close();

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();

  // Scroll down: the banner stays pinned and the sticky stats bar sits right below it.
  await page.evaluate(() => window.scrollTo(0, 400));
  const banner = await alert.boundingBox();
  const stats = await page.getByRole('img', { name: /XP/ }).first().boundingBox();
  if (!banner || !stats) throw new Error('missing boxes');
  expect(banner.y).toBeGreaterThanOrEqual(0);
  expect(stats.y).toBeGreaterThanOrEqual(banner.y + banner.height - 1);
  await page.screenshot({ path: process.env['NOTICE_SHOT'] ?? 'test-results/update-notice.png' });
  await expect(page.getByRole('button', { name: 'Recarregar' })).toBeVisible();
});
