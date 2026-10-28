import { test } from '@playwright/test';

/** Captures key screens for the revisor-ux. Output: e2e/screenshots/<project>-<theme>-<name>.png */
const screens = [{ name: 'vitrine', path: '/' }];

for (const theme of ['light', 'dark'] as const) {
  for (const screen of screens) {
    test(`@screens ${screen.name} (${theme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `e2e/screenshots/${info.project.name}-${theme}-${screen.name}.png`,
        fullPage: true,
      });
    });
  }
}
