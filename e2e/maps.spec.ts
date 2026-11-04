import { expect, test } from '@playwright/test';

test.describe('Mapas tab', () => {
  test('navigation has 5 items in order and Maps opens the list', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link')).toHaveText([
      'Trilha',
      'Mapas',
      'Praticar',
      'Perfil',
      'Ajustes',
    ]);
    await nav.getByRole('link', { name: 'Mapas' }).click();
    await expect(page).toHaveURL(/\/mapas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Mapas' })).toHaveAttribute('aria-current', 'page');
  });

  test('touch targets are at least 44px and fit in the viewport', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'bottom bar is a phone layout');
    await page.goto('/mapas');
    const links = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link');
    const boxes = await links.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, right: r.right, left: r.left };
      }),
    );
    expect(boxes).toHaveLength(5);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(78);
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(390);
    }
  });

  test('filters and search live in the URL and survive a reload', async ({ page }) => {
    await page.goto('/mapas');
    await page.getByText('Filtros', { exact: true }).click();
    await page.getByLabel('Tipo').selectOption('gramatica');
    await expect(page).toHaveURL(/tipo=gramatica/);
    await page.getByLabel('Buscar mapa').fill('to be');
    await expect(page).toHaveURL(/q=to\+be|q=to%20be/);
    await expect(page.getByRole('link', { name: /Verbo to be/ })).toBeVisible();
    await expect(page.getByText('1 mapa', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
    await expect(page.getByLabel('Buscar mapa')).toHaveValue('to be');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).toHaveURL(/\/mapas$/);
  });

  test('the notebook font loads only on the maps routes', async ({ page }) => {
    const fonts: string[] = [];
    page.on('request', (r) => {
      if (/patrick-hand/i.test(r.url())) fonts.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    await page.waitForLoadState('networkidle');
    expect(fonts).toEqual([]);
  });

  test('the notebook font-face exists on /mapas and not on the path', async ({ page }) => {
    const hasHandFace = () =>
      page.evaluate(() =>
        Array.from(document.styleSheets).some((sheet) => {
          try {
            return Array.from(sheet.cssRules).some(
              (r) => r instanceof CSSFontFaceRule && /Patrick Hand/i.test(r.cssText),
            );
          } catch {
            return false;
          }
        }),
      );
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await hasHandFace()).toBe(false);
    await page.getByRole('link', { name: 'Mapas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
    expect(await hasHandFace()).toBe(true);
  });
});
