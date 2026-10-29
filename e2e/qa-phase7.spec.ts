import { expect, test, type Page } from '@playwright/test';
import { answer, lessonExercises, noRecognition, playLesson } from './helpers/playLesson';
import { seed, startAt } from './helpers/seed';
import { answerWrong, current as currentEx } from './helpers/session';

/**
 * QA Phase 7 edge cases.
 * - Default suite (E2E build on 4173): offline lessons of units never opened online.
 * - Subpath suite: only runs with QA_BASE_URL (e.g. http://localhost:4175/falae/) pointing to a
 *   production build made with VITE_BASE=/falae/ (no test hooks there: real onboarding).
 */

const DAY = '2026-10-29';
const unitDone = (u: number) => [
  ...[1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => ({ lessonId: `u${u}-sk${s}-l${l}` }))),
  { lessonId: `u${u}-review` },
];

async function waitForSW(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.describe('offline: unidades nunca abertas', () => {
  test.skip(!!process.env.QA_BASE_URL, 'default server only');
  test.beforeEach(async ({ page }) => noRecognition(page));

  test('u3 e u4 offline sem nunca terem sido carregadas; dica e prática também', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await startAt(page, `${DAY}T12:00:00`);
    await seed(page, { lessonProgress: [...unitDone(1), ...unitDone(2), ...unitDone(3)] });
    await waitForSW(page);
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(r.url()));
    await context.setOffline(true);
    await page.reload();
    await playLesson(page, 'u4-sk1-l1');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.goto('/licao/u3-sk2-l1');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    await page.goto('/dica/u4-sk2');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Tentar de novo/)).toHaveCount(0);
    expect(failed).toEqual([]);
  });

  test('recarregar offline imediatamente após errar mantém o coração gasto', async ({
    page,
    context,
  }) => {
    await startAt(page, `${DAY}T12:00:00`);
    await waitForSW(page);
    await context.setOffline(true);
    await page.goto('/licao/u1-sk1-l1');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    const { ex } = await currentEx(page);
    test.skip(ex.type === 'match-pairs', 'first exercise has no single wrong answer');
    await answerWrong(page, ex);
    await page.getByRole('button', { name: 'Verificar' }).click();
    await page.reload();
    await expect(page.getByRole('img', { name: /4 corações/ })).toBeVisible();
  });
});

test.describe('subcaminho /falae/ (build de produção)', () => {
  const base = process.env.QA_BASE_URL;
  test.skip(!base, 'set QA_BASE_URL');
  test.use({ storageState: { cookies: [], origins: [] } });

  test('onboarding, lição, rota profunda, offline e manifest', async ({ page, context }) => {
    test.setTimeout(120_000);
    await noRecognition(page);
    const url = (p: string) => new URL(p, base).toString();
    await page.goto(url('./'));
    await expect(page).toHaveURL(/\/falae\/boas-vindas$/);
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.locator('label').filter({ hasText: '10 XP por dia' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Sou iniciante' }).click();
    await expect(page).toHaveURL(/\/falae\/?$/);
    const current = page.getByRole('link', { name: /atual$/ });
    await expect(current).toHaveAttribute('href', '/falae/licao/u1-sk1-l1');
    await current.click();
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    const first = lessonExercises('u1-sk1-l1')[0];
    if (first && first.type !== 'speak') await answer(page, first);
    await page.reload();
    await expect(page).toHaveURL(/\/falae\/licao\/u1-sk1-l1$/);
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();

    const m = await page.evaluate(async () => {
      const href = document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? '';
      const r = await fetch(href);
      // JSON payload; fields checked right below.
      return { href, json: (await r.json()) as Record<string, unknown> };
    });
    expect(m.json.start_url).toBe('/falae/');
    expect(m.json.scope).toBe('/falae/');
    // Manifest shape asserted by install.spec; here only icon srcs matter.
    const icons = m.json.icons as { src: string }[];
    const manifestUrl = new URL(m.href, page.url());
    for (const i of icons) {
      const status = await page.evaluate(
        async (s) => (await fetch(s)).status,
        new URL(i.src, manifestUrl).toString(),
      );
      expect(status).toBe(200);
    }

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto(url('./perfil'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto(url('./licao/u2-sk1-l1'));
    await expect(page.locator('body')).not.toBeEmpty();
    await page.goto(url('./'));
    await expect(current).toBeVisible();
  });
});
