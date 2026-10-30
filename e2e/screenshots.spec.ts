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
      const base = `e2e/screenshots/${info.project.name}-${theme}-${screen.name}`;
      await page.screenshot({ path: `${base}.png`, fullPage: screen.full ?? false });
      // Full-page shots put the fixed nav mid-page; also capture what the viewport really shows.
      if (screen.full) await page.screenshot({ path: `${base}-tela.png` });
    });
  }
}
