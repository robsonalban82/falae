import { expect, test, type Page } from '@playwright/test';
import { noRecognition, playLesson } from './helpers/playLesson';
import { advanceDays, seed, startAt, today } from './helpers/seed';

/** Fase 5: path, unlock guard, streak with freezes, daily goal and achievements. */

const DAY = '2026-10-29';
const node = (page: Page, name: RegExp) => page.getByRole('link', { name });
const finishText = (page: Page) => page.locator('section').first();

test.beforeEach(async ({ page }) => {
  await noRecognition(page);
  await startAt(page, `${DAY}T12:00:00`);
});

test('the simulated clock survives reloads', async ({ page }) => {
  expect(await today(page)).toBe(DAY);
  await page.reload();
  expect(await today(page)).toBe(DAY);
});

test('new user: first lesson is current, the rest locked; locked URL redirects with a notice', async ({
  page,
}) => {
  await expect(node(page, /^Lição 1 de 3, .*, atual$/)).toHaveAttribute('href', '/licao/u1-sk1-l1');
  const locked = page.getByRole('button', { name: /bloqueada/ });
  expect(await locked.count()).toBeGreaterThan(10);
  await expect(locked.first()).toHaveAccessibleName(/bloqueada — termine a lição anterior$/);
  // Future units are collapsed with a summary.
  await expect(page.getByText('4 habilidades · conclua a Unidade 1 para abrir')).toBeVisible();
  await page.goto('/licao/u1-sk1-l2');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('status').first()).toHaveText(/ainda está bloqueada/);
});

test('finishing a lesson shows XP, streak +1, and the path moves on', async ({ page }) => {
  await playLesson(page, 'u1-sk1-l1');
  await expect(finishText(page)).toContainText('Ofensiva: 1 dia');
  await expect(finishText(page)).toContainText('+1');
  await expect(page.locator('dd').first()).toHaveText(/^\+\d+$/);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(node(page, /^Lição 1 de 3, .*, concluída$/).first()).toBeVisible();
  await expect(node(page, /^Lição 2 de 3, .*, atual$/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Ofensiva: 1 dia/ })).toBeVisible();
});

test.describe('streak', () => {
  test('next day continues (+1)', async ({ page }) => {
    await playLesson(page, 'u1-sk1-l1');
    await advanceDays(page, 1);
    await playLesson(page, 'u1-sk1-l2');
    await expect(finishText(page)).toContainText('Ofensiva: 2 dias');
  });

  test('one missed day with a freeze: freeze used, streak grows', async ({ page }) => {
    await seed(page, {
      profile: {
        streak: { current: 2, longest: 2, lastActiveDay: DAY, freezes: 1, xpTowardFreeze: 0 },
      },
    });
    await advanceDays(page, 2);
    await expect(page.getByRole('img', { name: /congelamento vai proteger/ })).toBeVisible();
    await playLesson(page, 'u1-sk1-l1');
    await expect(finishText(page)).toContainText('Ofensiva: 3 dias');
    await expect(finishText(page)).toContainText('Congelamento usado');
  });

  test('two or more missed days reset to 1', async ({ page }) => {
    await seed(page, {
      profile: {
        streak: { current: 5, longest: 5, lastActiveDay: DAY, freezes: 2, xpTowardFreeze: 0 },
      },
    });
    await advanceDays(page, 3);
    await expect(page.getByRole('img', { name: /^Ofensiva: 0 dias/ })).toBeVisible();
    await playLesson(page, 'u1-sk1-l1');
    await expect(finishText(page)).toContainText('Ofensiva: 1 dia');
    await expect(finishText(page)).not.toContainText('Congelamento usado');
  });
});

test('daily goal of 10 XP celebrates once a day; first-lesson achievement shows once', async ({
  page,
}) => {
  await seed(page, { settings: { dailyGoalXp: 10 } });
  await playLesson(page, 'u1-sk1-l1');
  await expect(finishText(page)).toContainText('Meta batida!');
  await expect(finishText(page)).toContainText('Primeira lição');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await playLesson(page, 'u1-sk1-l2');
  await expect(finishText(page)).not.toContainText('Meta batida!');
  await expect(finishText(page)).not.toContainText('Primeira lição');
});

test('keyboard only: Tab reaches the current lesson and Enter opens it', async ({ page }) => {
  await expect(node(page, /atual$/)).toBeVisible();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (label && /atual$/.test(label)) break;
  }
  await expect(node(page, /atual$/)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/licao\/u1-sk1-l1$/);
});

test('tip opens from the path and goes back', async ({ page }) => {
  await page.getByRole('link', { name: 'Dica: Olá e tchau' }).click();
  await expect(page).toHaveURL(/\/dica\/u1-sk1$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cumprimentos ao longo do dia' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para a trilha' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('the review opens after 4 crowns (seeded) and the next unit after the review', async ({
  page,
}) => {
  const unit1 = [1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => `u1-sk${s}-l${l}`));
  await seed(page, { lessonProgress: unit1.map((lessonId) => ({ lessonId })) });
  await expect(page.getByRole('link', { name: 'Revisão da unidade 1, atual' })).toBeVisible();
  await seed(page, {
    lessonProgress: [...unit1, 'u1-review'].map((lessonId) => ({ lessonId })),
  });
  await expect(node(page, /^Lição 1 de 3, .*, atual$/)).toHaveAttribute('href', '/licao/u2-sk1-l1');
});
