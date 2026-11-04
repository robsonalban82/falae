import { test } from '@playwright/test';
import { noRecognition } from './helpers/playLesson';
import { DAY, screens } from './helpers/screens';
import { startAt } from './helpers/seed';

/**
 * Captures key screens for the revisor-ux (tagged @screens, excluded from `npm run e2e`).
 * Output: e2e/screenshots/<project>-<theme>-<name>.png (mobile 390×844 and desktop 1280×800).
 */

for (const theme of ['light', 'dark'] as const) {
  for (const screen of screens) {
    test(`@screens ${screen.name} (${theme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await noRecognition(page);
      await startAt(page, `${DAY}T12:00:00`);
      await screen.run(page);
      await page.waitForLoadState('networkidle');
      // Images decode asynchronously: wait so full-page captures never show blank art.
      await page.evaluate(() =>
        Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined))),
      );
      const base = `e2e/screenshots/${info.project.name}-${theme}-${screen.name}`;
      // Viewport shot first: a full-page capture resizes the viewport and loses the scroll
      // position (the path's scroll to the current node), so "-tela" must come before it.
      if (screen.full) await page.screenshot({ path: `${base}-tela.png` });
      await page.screenshot({ path: `${base}.png`, fullPage: screen.full ?? false });
    });
  }
}

// Grayscale check (shape + icon + label must work without color), showcase only.
for (const theme of ['light', 'dark'] as const) {
  test(`@screens vitrine grayscale (${theme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await noRecognition(page);
    await startAt(page, `${DAY}T12:00:00`);
    await page.goto('/dev/showcase');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() =>
      Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined))),
    );
    await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    await page.screenshot({
      path: `e2e/screenshots/${info.project.name}-${theme}-vitrine-cinza.png`,
      fullPage: true,
    });
  });
}
