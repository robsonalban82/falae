import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { answer, noRecognition, playLesson } from './helpers/playLesson';
import { advanceDays, startAt } from './helpers/seed';
import { answerWrong, current, playPlacement, playPractice, sessionState } from './helpers/session';

/**
 * Full journey of docs/ARQUITETURA.md §15 in one chained run (mobile and desktop projects):
 * welcome → failed placement → 3 lessons (XP, goal, streak 1) → out of hearts → practice +1 heart
 * → next day: due practice + lesson (streak 2, week with 2 days) → reloads keep the state
 * → export, reset, import restore exactly the exported data.
 *
 * Order note: step 4 (practice with due items) runs after `advanceDays(1)`, because cards from
 * today's lessons only become due tomorrow.
 */

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial' });

const DAY = '2026-10-29';

type Dump = {
  profile?: { totalXp: number; hearts: number; streak: { current: number } };
  results: { xp: number; kind: string; day: string }[];
};

function dump(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['profile', 'results']);
          const p = tx.objectStore('profile').get('me');
          const r = tx.objectStore('results').getAll();
          tx.oncomplete = () => {
            db.close();
            resolve({ profile: p.result, results: r.result } as Dump);
          };
        };
      }),
  );
}

const xpLabel = (page: Page) => page.getByRole('img', { name: /XP no total$/ });
const streakLabel = (page: Page) => page.getByRole('img', { name: /^Ofensiva: / });
const goalLabel = (page: Page) => page.getByRole('img', { name: /^Meta diária: / });

async function finishToPath(page: Page) {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function exportFile(page: Page): Promise<Record<string, unknown>> {
  await page.goto('/config');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar progresso' }).click(),
  ]);
  const json = JSON.parse(readFileSync(await download.path(), 'utf8')) as Record<string, unknown>;
  delete json.exportedAt;
  return json;
}

test('jornada completa §15', async ({ page }) => {
  test.setTimeout(240_000);
  await noRecognition(page);

  // 1. Empty database → welcome → goal 20 → "Já sei um pouco" → failed placement.
  await startAt(page, `${DAY}T12:00:00`);
  await expect(page).toHaveURL(/\/boas-vindas$/);
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.locator('label').filter({ hasText: '20 XP por dia' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Já sei um pouco' }).click();
  await expect(page).toHaveURL(/\/nivelamento$/);
  await playPlacement(page, false);
  await page.getByRole('button', { name: 'Ir para a trilha' }).click();
  await expect(page.getByRole('link', { name: /atual$/ })).toHaveAttribute(
    'href',
    '/licao/u1-sk1-l1',
  );

  // 2. Three lessons in a row: XP in the header, goal met, streak 1.
  for (const id of ['u1-sk1-l1', 'u1-sk1-l2', 'u1-sk1-l3']) {
    await playLesson(page, id);
    await finishToPath(page);
  }
  const afterLessons = await dump(page);
  const xp = afterLessons.results.reduce((n, r) => n + r.xp, 0);
  expect(afterLessons.profile?.totalXp).toBe(xp);
  await expect(xpLabel(page)).toHaveAccessibleName(`${xp} XP no total`);
  await expect(goalLabel(page)).toHaveAccessibleName(`Meta diária: ${xp} de 20 XP`);
  expect(xp).toBeGreaterThanOrEqual(20);
  await expect(streakLabel(page)).toHaveAccessibleName(/^Ofensiva: 1 dia/);

  // 3. Mistakes until no hearts → "Praticar e ganhar coração" → +1 heart → path with 1 heart.
  await page.goto('/licao/u1-sk2-l1');
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  for (let guard = 0; guard < 30; guard++) {
    const out = page.getByRole('heading', { name: 'Seus corações acabaram' });
    if (await out.isVisible()) break;
    const { ex } = await current(page);
    if (ex.type === 'match-pairs') await answer(page, ex);
    else {
      await answerWrong(page, ex);
      await page.getByRole('button', { name: 'Verificar' }).click();
    }
    const cont = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(cont).toBeVisible();
    await page.waitForTimeout(450);
    await cont.click();
  }
  await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
  await expect.poll(async () => (await dump(page)).profile?.hearts).toBe(0);
  await page.getByRole('link', { name: 'Praticar e ganhar coração' }).click();
  await playPractice(page);
  await expect(page.getByText('+1 coração')).toBeVisible();
  await finishToPath(page);
  await expect(page.getByRole('img', { name: '1 coração' })).toBeVisible();

  // 4/5. Next day: practice with due items, then a lesson → streak 2; profile week with 2 days.
  await advanceDays(page, 1);
  await page.goto('/praticar');
  await expect(page.getByText(/para revisar hoje/)).toBeVisible();
  await page.getByRole('link', { name: 'Começar a praticar' }).click();
  await playPractice(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await playLesson(page, 'u1-sk2-l1');
  await finishToPath(page);
  await expect(streakLabel(page)).toHaveAccessibleName(/^Ofensiva: 2 dias/);
  await page.getByRole('link', { name: 'Perfil' }).click();
  const bars = page.getByRole('list', { name: 'Últimos 7 dias' }).getByRole('listitem');
  await expect(bars).toHaveCount(7);
  await expect(page.getByRole('listitem', { name: /: 0 XP$/ })).toHaveCount(5);

  // 6. Persistence: reload on the path, mid-lesson and on the profile.
  await page.goto('/');
  const xpBefore = await xpLabel(page).getAttribute('aria-label');
  await page.reload();
  await expect(xpLabel(page)).toHaveAccessibleName(xpBefore ?? '');
  await expect(streakLabel(page)).toHaveAccessibleName(/^Ofensiva: 2 dias/);

  await page.goto('/licao/u1-sk2-l2');
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  for (let i = 0; i < 2; i++) {
    const { ex } = await current(page);
    await answer(page, ex);
    if (ex.type !== 'match-pairs') await page.getByRole('button', { name: 'Verificar' }).click();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
  const before = await sessionState(page);
  const prompt = page.getByRole('heading', { level: 2 }).first();
  const heading = await prompt.textContent();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  await expect(prompt).toHaveText(heading ?? '');
  const after = await sessionState(page);
  expect(after?.turn).toBe(before?.turn);
  expect(after?.queue).toEqual(before?.queue);
  await page.getByRole('button', { name: 'Sair da lição' }).click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();

  await page.getByRole('link', { name: 'Perfil' }).click();
  const statsBefore = await page.locator('dl').first().innerText();
  await page.reload();
  await expect.poll(() => page.locator('dl').first().innerText()).toBe(statsBefore);

  // 7. Export → reset → import → identical data (exportedAt ignored).
  const exported = await exportFile(page);
  await page.getByRole('button', { name: 'Apagar todo o progresso' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Digite APAGAR para confirmar').fill('APAGAR');
  await page.getByRole('button', { name: 'Apagar tudo' }).click();
  await expect(page).toHaveURL(/\/boas-vindas$/);
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Sou iniciante' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/config');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Importar progresso').click(),
  ]);
  await chooser.setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...exported, exportedAt: new Date().toISOString() })),
  });
  await page.getByRole('button', { name: 'Substituir meu progresso' }).click();
  await expect(page.getByText('Progresso restaurado.')).toBeVisible();
  const restored = await exportFile(page);
  expect(restored).toEqual(exported);
  const data = restored.data as Record<string, unknown[]>;
  expect(data.results?.length).toBeGreaterThan(0);
  expect(data.achievements?.length).toBeGreaterThan(0);
  expect(data.srs?.length).toBeGreaterThan(0);
});
