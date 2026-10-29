import { expect, test, type Page } from '@playwright/test';
import { noRecognition, playLesson } from './helpers/playLesson';
import { seed, startAt } from './helpers/seed';

/**
 * Captures key screens for the revisor-ux (tagged @screens, excluded from `npm run e2e`).
 * Output: e2e/screenshots/<project>-<theme>-<name>.png (mobile 390×844 and desktop 1280×800).
 */

const DAY = '2026-10-29';
const unit1 = [1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => `u1-sk${s}-l${l}`));
const progress = (ids: string[]) => ids.map((lessonId) => ({ lessonId }));
const veteran = {
  totalXp: 340,
  hearts: 3,
  streak: { current: 6, longest: 9, lastActiveDay: DAY, freezes: 1, xpTowardFreeze: 40 },
};

/** Demo lesson: answers e01 (choice) and e02 (pairs), stopping at the word bank (e03). */
async function demoUpToBank(page: Page) {
  await page.goto('/licao/demo-sk1-l1');
  await page.getByText('hello', { exact: true }).click();
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  for (const [en, pt] of [
    ['hello', 'olá'],
    ['thanks', 'obrigado'],
    ['bye', 'tchau'],
    ['please', 'por favor'],
  ]) {
    await page.getByRole('button', { name: en, exact: true }).click();
    await page.getByRole('button', { name: pt, exact: true }).click();
  }
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

type Screen = { name: string; full?: boolean; run: (page: Page) => Promise<void> };

const screens: Screen[] = [
  {
    name: 'trilha-inicio',
    run: async (page) => {
      await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
    },
  },
  {
    name: 'trilha-meio-coroas',
    full: true,
    run: async (page) => {
      await seed(page, {
        profile: veteran,
        lessonProgress: progress([...unit1.slice(0, 7)]),
        daily: [{ day: DAY, xp: 12, lessons: 1, goalMet: false }],
      });
      await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
    },
  },
  {
    name: 'trilha-unidade-2',
    run: async (page) => {
      await seed(page, {
        profile: veteran,
        lessonProgress: progress([...unit1, 'u1-review', 'u2-sk1-l1']),
        daily: [{ day: DAY, xp: 25, lessons: 2, goalMet: true }],
      });
      await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'dica',
    full: true,
    run: async (page) => {
      await page.goto('/dica/u1-sk1');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.locator(':focus').evaluate((el) => (el as HTMLElement).blur());
    },
  },
  {
    name: 'fim-de-licao',
    full: true,
    run: async (page) => {
      await seed(page, {
        settings: { dailyGoalXp: 10 },
        profile: {
          totalXp: 90,
          streak: {
            current: 2,
            longest: 2,
            lastActiveDay: '2026-10-28',
            freezes: 0,
            xpTowardFreeze: 90,
          },
        },
      });
      await playLesson(page, 'u1-sk1-l1');
      await expect(page.getByText(/^Meta batida!/)).toBeVisible();
    },
  },
  {
    name: 'feedback-escolha-errada',
    run: async (page) => {
      await page.goto('/licao/demo-sk1-l1');
      await page.getByText('thanks', { exact: true }).click();
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
    },
  },
  {
    name: 'feedback-certo',
    run: async (page) => {
      await page.goto('/licao/demo-sk1-l1');
      await page.getByText('hello', { exact: true }).click();
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
    },
  },
  {
    name: 'feedback-quase',
    run: async (page) => {
      await demoUpToBank(page);
      for (const w of ['Nice', 'to', 'meet', 'you']) {
        await page.getByRole('button', { name: `Adicionar "${w}"` }).click();
      }
      await page.getByRole('button', { name: 'Verificar' }).click();
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByRole('textbox').fill('muito obrigdo');
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.locator('footer mark')).toBeVisible();
    },
  },
  {
    name: 'banco-de-palavras',
    run: async (page) => {
      await demoUpToBank(page);
      await page.getByRole('button', { name: 'Adicionar "Nice"' }).click();
      await page.getByRole('button', { name: 'Adicionar "to"' }).click();
    },
  },
  {
    name: 'vitrine',
    full: true,
    run: async (page) => {
      await page.goto('/dev/showcase');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    },
  },
];

for (const theme of ['light', 'dark'] as const) {
  for (const screen of screens) {
    test(`@screens ${screen.name} (${theme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await noRecognition(page);
      await startAt(page, `${DAY}T12:00:00`);
      await screen.run(page);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `e2e/screenshots/${info.project.name}-${theme}-${screen.name}.png`,
        fullPage: screen.full ?? false,
      });
    });
  }
}
