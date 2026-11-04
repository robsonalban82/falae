import { expect, test } from '@playwright/test';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 4): notebook showcase, font isolation, reflow, text zoom. */
test.use({ serviceWorkers: 'block' });

test('Patrick Hand nao e baixada em / nem em /licao, mas e no showcase', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (/patrick/i.test(r.url())) fonts.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.goto('/licao/u1-sk1-l1');
  await page.waitForLoadState('networkidle');
  expect(fonts).toEqual([]);
  await page.goto('/dev/showcase');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.load('22px "Patrick Hand"'));
  expect(fonts.length).toBeGreaterThan(0);
});

for (const dark of [false, true]) {
  test(`showcase Caderno (${dark ? 'escuro' : 'claro'}): rotulos em texto, 320px sem rolagem, zoom 200%`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/dev/showcase');
    await page.evaluate((d) => document.documentElement.classList.toggle('dark', d), dark);
    const section = page.locator('section[aria-labelledby="sc-notebook"]');
    await section.scrollIntoViewIfNeeded();
    // tags: text label present, svgs hidden from AT
    for (const label of ['regra', 'exemplo', 'exceção', 'erro comum', 'vocabulário']) {
      await expect(section.getByText(label, { exact: true }).first()).toBeVisible();
    }
    expect(await section.locator('svg:not([aria-hidden="true"])').count()).toBe(0);
    // Scoped to the notebook section: the rest of the dev showcase overflows at 320px + 200%.
    const noOverflow = () =>
      section.evaluate((s) =>
        [...s.querySelectorAll('*')].every(
          (e) => e.getBoundingClientRect().right <= innerWidth + 1,
        ),
      );
    expect(await noOverflow()).toBe(true);
    // 200% text zoom
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
    expect(await noOverflow()).toBe(true);
    // hand font never below 22px
    const size = await section
      .locator('.font-hand')
      .first()
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(22);
  });
}
