import { expect, test } from '@playwright/test';
import { seed, startAt } from './helpers/seed';
import { playPractice } from './helpers/session';
import { card, DAY, progress, unit1 } from './helpers/screens';

/**
 * QA (MAPAS-E-CARTAS Fase 2, etapa 4): Practice now goes through loadItems. A unit chunk that
 * fails to download must show the content error (never a blank screen), and "Tentar de novo"
 * must work once the network is back (the failure is not cached).
 */
test.use({ serviceWorkers: 'block' }); // page.route must see the chunk requests

const mixedCards = ['u1-hi', 'u1-bye', 'u1-good-morning', 'u2-mother', 'u2-father'];

test('Praticar: chunk de unidade falha → erro amigável → "Tentar de novo" carrega e joga', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startAt(page, `${DAY}T12:00:00`);
  await seed(page, {
    lessonProgress: [...progress(unit1), { lessonId: 'u1-review' }],
    srs: mixedCards.map((id) => card(id)),
  });
  let block = true;
  const blocked: string[] = [];
  await page.route(/\/assets\/u0[12]-[^/]+\.js$/, (route) => {
    if (!block) return route.continue();
    blocked.push(route.request().url());
    return route.abort('internetdisconnected');
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/praticar/sessao');
  await expect(
    page.getByRole('heading', { name: 'Não deu para abrir este conteúdo' }),
  ).toBeVisible();
  expect(blocked.length).toBeGreaterThan(0);

  block = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await playPractice(page);
  expect(errors).toEqual([]);
});

test('Praticar com cartas de duas unidades monta a sessão sem itens órfãos', async ({ page }) => {
  test.setTimeout(90_000);
  await startAt(page, `${DAY}T12:00:00`);
  await seed(page, {
    lessonProgress: [...progress(unit1), { lessonId: 'u1-review' }],
    // an id that no longer exists in the content must be ignored, not crash
    srs: [...mixedCards, 'u9-ghost'].map((id) => card(id)),
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/praticar/sessao');
  await playPractice(page);
  expect(errors).toEqual([]);
});
