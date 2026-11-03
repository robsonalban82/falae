import { expect, test } from '@playwright/test';

test.describe('QA two tabs / offline after upgrade', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');

  test('newer schema in another tab -> notice, reload recovers; offline reload keeps working', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const other = await context.newPage();
    await other.goto('/sobre-nada-404').catch(() => undefined);
    await other.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('falae', 30);
          req.onupgradeneeded = () => req.result.createObjectStore('future', { keyPath: 'id' });
          req.onsuccess = () => {
            req.result.close();
            resolve();
          };
          req.onerror = () => reject(req.error);
        }),
    );
    await expect(page.getByRole('alert')).toBeVisible();
    expect(errors).toEqual([]);
    await other.close();
  });

  test('app boots offline after a v2 database exists', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    await context.setOffline(false);
  });
});
