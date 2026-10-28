import { expect, test } from '@playwright/test';

test('app loads with title, navigation and mascot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Falaê/);
  await expect(page.getByRole('heading', { level: 1, name: 'Falaê' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Tuca, o tucano, comemorando/ })).toBeVisible();
});

test('theme choice persists after reload', async ({ page }) => {
  await page.goto('/');
  // The native radio is visually hidden; users click its pill (label).
  await page.locator('label').filter({ hasText: 'Escuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  // The native radio is visually hidden; users click its pill (label).
  await page.locator('label').filter({ hasText: 'Claro' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('navigation reaches placeholder screens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Praticar' }).click();
  await expect(page).toHaveURL(/\/praticar$/);
  await expect(page.getByRole('heading', { name: 'Em construção' })).toBeVisible();
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait until the SW controls the page so navigations go through it.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('/perfil');
  await expect(page.getByRole('heading', { name: 'Em construção' })).toBeVisible();
  await context.setOffline(false);
});

test('clock can be simulated in E2E builds', async ({ page }) => {
  await page.goto('/');
  const hasHook = await page.evaluate(
    () =>
      typeof (window as unknown as { __falae?: { advanceDays?: unknown } }).__falae?.advanceDays ===
      'function',
  );
  expect(hasHook).toBe(true);
});
