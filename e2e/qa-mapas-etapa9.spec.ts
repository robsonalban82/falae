import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { noRecognition } from './helpers/playLesson';
import { playPractice, sessionState } from './helpers/session';
import { seed, startAt } from './helpers/seed';
import { noTts } from './helpers/tts';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 9): "Praticar este mapa" (/mapas/:mapId/praticar). */

const MAP_ID = 'mm-to-be';
const MAP = `/mapas/${MAP_ID}`;
const PRACTICE = `${MAP}/praticar`;
const DAY = '2026-10-29';

function collectRefs(node: unknown, out: Set<string>) {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'ref' && typeof v === 'string') out.add(v);
      else collectRefs(v, out);
    }
  }
}
const mapJson = JSON.parse(
  readFileSync(join(process.cwd(), 'src/content/mindmaps', `${MAP_ID}.json`), 'utf8'),
) as unknown;
const mapItemIds = new Set<string>();
collectRefs(mapJson, mapItemIds);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

type Dump = {
  profile: { totalXp: number; hearts?: number }[];
  results: {
    id: string;
    lessonId: string;
    kind?: string;
    xp?: number;
    context?: { mapId?: string };
    itemOutcomes: { itemId: string }[];
  }[];
  mapProgress: { mapId: string; timesStudied: number; lastStudiedDay: string }[];
};

async function dump(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = ['profile', 'results', 'mapProgress'].filter((n) =>
            db.objectStoreNames.contains(n),
          );
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, unknown[]> = { profile: [], results: [], mapProgress: [] };
          let left = names.length;
          for (const n of names) {
            const r = tx.objectStore(n).getAll();
            r.onsuccess = () => {
              out[n] = r.result;
              if (--left === 0) {
                db.close();
                resolve(out as unknown as Dump);
              }
            };
          }
        };
      }),
  );
}

const toggle = (p: Page) => p.getByRole('button', { name: 'Esconder o inglês' });
const peeks = (p: Page) => p.getByRole('button', { name: 'Mostrar o trecho em inglês' });

async function revealAll(page: Page) {
  for (let guard = 0; guard < 200; guard++) {
    if ((await peeks(page).count()) === 0) break;
    await peeks(page).first().click();
  }
  await expect(peeks(page)).toHaveCount(0);
  const finish = page.getByRole('button', { name: 'Concluir' });
  if (await finish.isVisible().catch(() => false)) await finish.click();
}

/** The "Praticar este mapa" link only exists in the final study panel. */
async function openPracticeFromMap(page: Page) {
  await toggle(page).click();
  await revealAll(page);
  await page
    .locator('[data-testid="map-study-complete"]')
    .getByRole('link', { name: 'Praticar este mapa' })
    .click();
}

test.beforeEach(async ({ page }) => {
  await noRecognition(page);
  await startAt(page, `${DAY}T12:00:00`);
});

test('sanidade: o mapa tem itens para praticar', () => {
  expect(mapItemIds.size).toBeGreaterThan(2);
});

test('pela tela do mapa: estudar -> painel final -> Praticar este mapa -> sessao ate o fim', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto(MAP);
  await toggle(page).click();
  await revealAll(page);
  const panel = page.locator('[data-testid="map-study-complete"]');
  await expect(panel).toContainText('Mapa estudado!');
  await panel.getByRole('link', { name: 'Praticar este mapa' }).click();
  await expect(page).toHaveURL(new RegExp(`${PRACTICE}$`));
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  // full screen: no tab bar
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mapas', exact: true })).toHaveCount(0);
  await playPractice(page);
  await expect(page.getByRole('heading', { name: 'Prática concluída!' })).toBeVisible();
  await expect.poll(async () => (await dump(page)).results.length).toBe(2);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(new RegExp(`${MAP}$`));
  expect(errors).toEqual([]);
});

test('direto pela URL: so itens do mapa; +1 coracao; XP; mapProgress; results com contexto', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await seed(page, { profile: { hearts: 3, heartsUpdatedAt: `${DAY}T12:00:00.000Z` } });
  const before = await dump(page);
  await page.goto(PRACTICE);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  const st = await sessionState(page);
  expect(st).not.toBeNull();
  const ids = st!.exercises.flatMap((e) => (e as unknown as { itemIds: string[] }).itemIds);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(mapItemIds.has(id), `item ${id} is not in ${MAP_ID}`).toBe(true);
  await expect(page.getByRole('img', { name: /coraç/ })).toHaveCount(0);
  await playPractice(page);
  await expect(page.getByText('+1 coração')).toBeVisible();
  await expect.poll(async () => (await dump(page)).results.length).toBe(1);
  const d = await dump(page);
  const r = d.results[0]!;
  expect(r.lessonId).toBe(`map-practice:${MAP_ID}`);
  expect(r.kind).toBe('practice');
  expect(r.context?.mapId).toBe(MAP_ID);
  expect(r.xp).toBeGreaterThanOrEqual(8);
  for (const o of r.itemOutcomes) expect(mapItemIds.has(o.itemId)).toBe(true);
  expect(d.profile[0]?.hearts).toBe(4);
  expect(d.profile[0]?.totalXp).toBe((before.profile[0]?.totalXp ?? 0) + (r.xp ?? 0));
  const mp = d.mapProgress.find((m) => m.mapId === MAP_ID);
  expect(mp?.timesStudied).toBe(1);
  expect(mp?.lastStudiedDay).toBe(DAY);
  expect(errors).toEqual([]);
});

test('com 5 coracoes: nao passa de 5', async ({ page }) => {
  await page.goto(PRACTICE);
  await playPractice(page);
  await expect.poll(async () => (await dump(page)).results.length).toBe(1);
  expect((await dump(page)).profile[0]?.hearts ?? 5).toBeLessThanOrEqual(5);
});

test('recarregar no meio retoma no mesmo ponto, com o mesmo contexto', async ({ page }) => {
  await page.goto(PRACTICE);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  const raw0 = await page.evaluate(() => sessionStorage.getItem('falae-lesson-session'));
  expect(raw0).toContain(`map-practice:${MAP_ID}`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  const raw1 = await page.evaluate(() => sessionStorage.getItem('falae-lesson-session'));
  const a = JSON.parse(raw0 ?? '{}').state;
  const b = JSON.parse(raw1 ?? '{}').state;
  expect(b.exercises).toEqual(a.exercises);
  expect(b.queue).toEqual(a.queue);
  expect(b.context).toEqual({ mapId: MAP_ID });
  // nothing saved yet
  expect((await dump(page)).results).toHaveLength(0);
  await playPractice(page);
  await expect.poll(async () => (await dump(page)).results.length).toBe(1);
  expect((await dump(page)).results[0]?.context?.mapId).toBe(MAP_ID);
});

test('recarregar depois de responder 2 exercicios mantem a fila', async ({ page }) => {
  await page.goto(PRACTICE);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  const { answer } = await import('./helpers/playLesson');
  for (let i = 0; i < 2; i++) {
    const s = await sessionState(page);
    const ex = s!.exercises[s!.queue[0]!]!;
    await answer(page, ex);
    if (ex.type !== 'match-pairs') await page.getByRole('button', { name: 'Verificar' }).click();
    const cont = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(cont).toBeVisible();
    await page.waitForTimeout(450);
    await cont.click();
  }
  const before = await sessionState(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  const after = await sessionState(page);
  expect(after?.queue).toEqual(before?.queue);
});

test('sair volta para o mapa e nao grava nada', async ({ page }) => {
  await page.goto(MAP);
  await openPracticeFromMap(page);
  await expect(page).toHaveURL(new RegExp(`${PRACTICE}$`));
  await page.getByRole('button', { name: 'Sair da prática' }).click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${MAP}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  const d = await dump(page);
  expect(d.results.filter((r) => r.lessonId.startsWith('map-practice'))).toHaveLength(0);
});

test('mapId invalido volta para /mapas', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/mapas/nao-existe/praticar');
  await expect(page).toHaveURL(/\/mapas$/);
  await expect(page.getByRole('heading', { name: 'Mapas', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sem TTS nao aparece exercicio de ouvir e a sessao termina', async ({ page }) => {
  await noTts(page);
  await page.goto(PRACTICE);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  expect(await page.evaluate(() => 'speechSynthesis' in window)).toBe(false);
  const st = await sessionState(page);
  const types = st!.exercises.map((e) => e.type);
  expect(types).not.toContain('listen-type');
  expect(types).not.toContain('speak');
  await expect(page.getByRole('button', { name: /Ouvir/ })).toHaveCount(0);
  await playPractice(page);
});

test('depois de praticar, estudar o mesmo mapa no mesmo dia da "sem XP desta vez"', async ({
  page,
}) => {
  await page.goto(PRACTICE);
  await playPractice(page);
  await expect.poll(async () => (await dump(page)).results.length).toBe(1);
  const xp1 = (await dump(page)).profile[0]?.totalXp ?? 0;
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(new RegExp(`${MAP}$`));
  await toggle(page).click();
  await revealAll(page);
  const panel = page.locator('[data-testid="map-study-complete"]');
  await expect(panel).toContainText('sem XP desta vez');
  await expect(panel).not.toContainText('+5 XP');
  const d = await dump(page);
  expect(d.profile[0]?.totalXp).toBe(xp1);
  expect(d.mapProgress.find((m) => m.mapId === MAP_ID)?.timesStudied).toBe(2);
});

test('clique duplo em Verificar nao conta duas vezes', async ({ page }) => {
  await page.goto(PRACTICE);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  const s = await sessionState(page);
  const ex = s!.exercises[s!.queue[0]!]!;
  const { answer } = await import('./helpers/playLesson');
  await answer(page, ex);
  if (ex.type !== 'match-pairs') {
    await page.getByRole('button', { name: 'Verificar' }).dblclick();
  }
  const after = await sessionState(page);
  expect(after?.queue.length).toBeLessThanOrEqual(s!.queue.length);
});

test('botao Voltar do navegador na sessao nao quebra', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(MAP);
  await openPracticeFromMap(page);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${MAP}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('offline apos visitar o mapa: Praticar este mapa funciona', async ({ page, context }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mapas');
  await page.goto(MAP);
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await openPracticeFromMap(page);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  await playPractice(page);
  await expect.poll(async () => (await dump(page)).results.length).toBe(2);
  expect(errors).toEqual([]);
});
