import { expect, test, type Page } from '@playwright/test';
import { startAt } from './helpers/seed';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 7): "Esconder o inglês" study and the map commit. */

const MAP = '/mapas/mm-to-be';
const DAY = '2026-10-29';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

type Dump = {
  profile: { totalXp: number; hearts?: number; [k: string]: unknown }[];
  results: { id: string; lessonId: string; kind?: string; xp?: number }[];
  mapProgress: { mapId: string; timesStudied?: number; [k: string]: unknown }[];
  srs: { itemId: string }[];
};

async function dump(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = ['profile', 'results', 'mapProgress', 'srs'].filter((n) =>
            db.objectStoreNames.contains(n),
          );
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, unknown[]> = {
            profile: [],
            results: [],
            mapProgress: [],
            srs: [],
          };
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
const progressText = (p: Page) => p.locator('main p[role="status"]').first();

/** Reveals every chunk by tapping the first post-it; rates the last item if asked. */
async function revealAll(page: Page, rate: 'remembered' | 'skip' = 'skip') {
  for (let guard = 0; guard < 200; guard++) {
    const n = await peeks(page).count();
    if (n === 0) break;
    await peeks(page).first().click();
  }
  await expect(peeks(page)).toHaveCount(0);
  const finish = page.getByRole('button', { name: 'Concluir' });
  if (await finish.isVisible().catch(() => false)) {
    if (rate === 'skip') await finish.click();
    else await page.getByRole('button', { name: 'Lembrei', exact: true }).last().click();
  }
}

test.beforeEach(async ({ page }) => {
  await startAt(page, `${DAY}T12:00:00`);
});

test('ligar o modo: aria-pressed, ramos abrem, post-its, conteudo coberto inacessivel', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto(MAP);
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(peeks(page)).toHaveCount(0);
  // close everything first: turning the mode on must reopen the branches
  await page.getByRole('button', { name: 'Fechar tudo' }).click();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  for (const b of await page.locator('main h2 > button[aria-expanded]').all())
    await expect(b).toHaveAttribute('aria-expanded', 'true');
  const total = await peeks(page).count();
  expect(total).toBeGreaterThan(5);
  await expect(progressText(page)).toContainText(`0 de ${total} trechos revelados.`);
  // covered content: inert + invisible
  const covered = page.locator('[data-chunk] > span[inert]');
  expect(await covered.count()).toBe(total);
  // Tab through the whole page: focus never lands inside covered content
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[inert]'));
    expect(inside).toBe(false);
  }
  // off again
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(peeks(page)).toHaveCount(0);
  expect(await page.locator('[inert]').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('revelar so pelo teclado: foco vai ao trecho revelado e progresso muda', async ({ page }) => {
  await page.goto(MAP);
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  const total = await peeks(page).count();
  const first = peeks(page).first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(progressText(page)).toContainText(`1 de ${total} trechos revelados.`);
  await expect(peeks(page)).toHaveCount(total - 1);
  const where = await page.evaluate(() => {
    const a = document.activeElement;
    return {
      inChunk: !!a?.closest('[data-chunk]'),
      inert: !!a?.closest('[inert]'),
      tag: a?.tagName,
    };
  });
  expect(where.inChunk).toBe(true);
  expect(where.inert).toBe(false);
  // Space on the next one
  await peeks(page).first().focus();
  await page.keyboard.press('Space');
  await expect(progressText(page)).toContainText(`2 de ${total} trechos revelados.`);
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-chunk]'))).toBe(true);
});

test('clique duplo num post-it conta so um', async ({ page }) => {
  await page.goto(MAP);
  await toggle(page).click();
  const total = await peeks(page).count();
  await peeks(page).first().dblclick();
  await expect(progressText(page)).toContainText(`1 de ${total} trechos revelados.`);
});

test('Lembrei / Nao lembrei aparecem em linhas reveladas e viram escolha com texto', async ({
  page,
}) => {
  await page.goto(MAP);
  await toggle(page).click();
  const groups = page.getByRole('group', { name: 'Você lembrou?' });
  await expect(groups).toHaveCount(0);
  // reveal until a rating group shows up
  let shown = false;
  for (let i = 0; i < 200 && !shown; i++) {
    await peeks(page).first().click();
    shown = (await groups.count()) > 0;
  }
  expect(shown).toBe(true);
  await groups.first().getByRole('button', { name: 'Lembrei', exact: true }).click();
  await expect(page.locator('main p', { hasText: /^Lembrei$/ }).first()).toBeVisible();
  await expect(page.locator('main p', { hasText: /^Lembrei$/ }).first()).toBeFocused();
  // second rated line: "Nao lembrei"
  for (let i = 0; i < 200 && (await groups.count()) === 0; i++) await peeks(page).first().click();
  await groups.first().getByRole('button', { name: 'Não lembrei', exact: true }).click();
  await expect(page.locator('main p', { hasText: /^Não lembrei$/ })).toHaveCount(1);
  await expect(page.locator('main p', { hasText: /^Lembrei$/ })).toHaveCount(1);
});

test('concluir: +5 XP, XP do perfil sobe 5, coracoes iguais, srs so das linhas avaliadas', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto(MAP);
  const before = await dump(page);
  const xp0 = before.profile[0]?.totalXp ?? 0;
  await toggle(page).click();
  await revealAll(page, 'remembered');
  const panel = page.locator('[data-testid="map-study-complete"]');
  await expect(panel).toContainText('Mapa estudado!');
  await expect(panel).toContainText('+5 XP');
  await expect(panel.getByRole('link', { name: 'Praticar este mapa' })).toBeVisible();
  await expect(progressText(page)).toContainText('Tudo revelado!');
  const after = await dump(page);
  expect(after.profile[0]?.totalXp).toBe(xp0 + 5);
  expect(after.profile[0]?.hearts).toBe(before.profile[0]?.hearts ?? 5); // no row yet = full hearts
  const maps = after.results.filter((r) => r.lessonId === 'map:mm-to-be');
  expect(maps).toHaveLength(1);
  expect(maps[0]?.id).toMatch(/^map:mm-to-be-\d+$/);
  expect(after.mapProgress.find((m) => m.mapId === 'mm-to-be')?.timesStudied).toBe(1);
  expect(errors).toEqual([]);
});

test('estudar de novo no mesmo dia: sem XP; selo Ja estudado em /mapas; XP na Trilha', async ({
  page,
}) => {
  await page.goto(MAP);
  await toggle(page).click();
  await revealAll(page);
  await expect(page.locator('[data-testid="map-study-complete"]')).toContainText('+5 XP');
  const xp1 = (await dump(page)).profile[0]?.totalXp ?? 0;
  // again
  await toggle(page).click(); // off
  await toggle(page).click(); // on, new run
  await expect(peeks(page).first()).toBeVisible();
  await expect(page.locator('[data-testid="map-study-complete"]')).toHaveCount(0);
  await revealAll(page);
  const panel = page.locator('[data-testid="map-study-complete"]');
  await expect(panel).toContainText('Você já estudou este mapa hoje: sem XP desta vez.');
  await expect(panel).not.toContainText('+5 XP');
  const d = await dump(page);
  expect(d.profile[0]?.totalXp).toBe(xp1);
  expect(d.mapProgress.find((m) => m.mapId === 'mm-to-be')?.timesStudied).toBe(2);
  // stats bar absent on the map screen
  await expect(page.getByRole('img', { name: /^Ofensiva:/ })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /XP no total/ })).toHaveCount(0);
  // badge in the list
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await expect(page.locator('main a[href="/mapas/mm-to-be"]')).toContainText('Já estudado');
  await expect(page.locator('main a[href="/mapas/mm-in-on-at"]')).not.toContainText('Já estudado');
  // Trilha shows the updated XP
  await page.getByRole('link', { name: 'Trilha' }).first().click();
  await expect(page.getByRole('img', { name: `${xp1} XP no total` })).toBeVisible();
});

test('desligar no meio nao grava; religar recomeca do zero', async ({ page }) => {
  await page.goto(MAP);
  const before = await dump(page);
  await toggle(page).click();
  const total = await peeks(page).count();
  for (let i = 0; i < total - 1; i++) {
    if ((await peeks(page).count()) === 0) break;
    await peeks(page).first().click();
  }
  await toggle(page).click();
  await page.waitForTimeout(300);
  const after = await dump(page);
  expect(after.profile[0]?.totalXp ?? 0).toBe(before.profile[0]?.totalXp ?? 0);
  expect(after.results.filter((r) => r.lessonId.startsWith('map:'))).toHaveLength(0);
  expect(after.mapProgress).toHaveLength(before.mapProgress.length);
  await toggle(page).click();
  await expect(progressText(page)).toContainText(`0 de ${total} trechos revelados.`);
});

test('recarregar no meio do estudo nao grava e nao quebra', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(MAP);
  const before = await dump(page);
  await toggle(page).click();
  for (let i = 0; i < 5; i++) await peeks(page).first().click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  const after = await dump(page);
  expect(after.profile[0]?.totalXp ?? 0).toBe(before.profile[0]?.totalXp ?? 0);
  expect(after.results.filter((r) => r.lessonId.startsWith('map:'))).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('recarregar logo apos concluir nao duplica XP', async ({ page }) => {
  await page.goto(MAP);
  const xp0 = (await dump(page)).profile[0]?.totalXp ?? 0;
  await toggle(page).click();
  await revealAll(page);
  await expect(page.locator('[data-testid="map-study-complete"]')).toContainText('+5 XP');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await page.waitForTimeout(300);
  const d = await dump(page);
  expect(d.profile[0]?.totalXp).toBe(xp0 + 5);
  expect(d.results.filter((r) => r.lessonId === 'map:mm-to-be')).toHaveLength(1);
});

test('falha ao salvar: Tentar de novo sem perder o estado; sem duplicar', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __failWrites?: boolean };
    const orig = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      ...args: Parameters<IDBDatabase['transaction']>
    ) {
      if (w.__failWrites && args[1] === 'readwrite') {
        throw new DOMException('simulated', 'QuotaExceededError');
      }
      return orig.apply(this, args);
    } as typeof orig;
  });
  await page.goto(MAP);
  const xp0 = (await dump(page)).profile[0]?.totalXp ?? 0;
  await toggle(page).click();
  const total = await peeks(page).count();
  await page.evaluate(() => ((window as unknown as { __failWrites: boolean }).__failWrites = true));
  await revealAll(page);
  const panel = page.locator('[data-testid="map-study-complete"]');
  await expect(panel).toContainText('Não deu para salvar seu estudo');
  // state kept: everything still revealed
  await expect(peeks(page)).toHaveCount(0);
  await expect(progressText(page)).toContainText('Tudo revelado!');
  expect((await dump(page)).profile[0]?.totalXp ?? 0).toBe(xp0);
  await page.evaluate(
    () => ((window as unknown as { __failWrites: boolean }).__failWrites = false),
  );
  await panel.getByRole('button', { name: /Tentar de novo/ }).click();
  await expect(panel).toContainText('+5 XP');
  const d = await dump(page);
  expect(d.profile[0]?.totalXp).toBe(xp0 + 5);
  expect(d.results.filter((r) => r.lessonId === 'map:mm-to-be')).toHaveLength(1);
  expect(total).toBeGreaterThan(0);
});

test('reduced motion: fluxo completo funciona', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = watchErrors(page);
  await page.goto(MAP);
  await toggle(page).click();
  await revealAll(page);
  await expect(page.locator('[data-testid="map-study-complete"]')).toContainText('+5 XP');
  expect(errors).toEqual([]);
});

test('Praticar este mapa leva a /mapas/:id/praticar (rota da etapa 9) sem quebrar', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto(MAP);
  await toggle(page).click();
  await revealAll(page);
  await page.getByRole('link', { name: 'Praticar este mapa' }).click();
  await expect(page).toHaveURL(/\/mapas\/mm-to-be\/praticar$/);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

test('mapa sem desvio: sem rolagem horizontal com o modo ligado', async ({ page }) => {
  await page.goto(MAP);
  await toggle(page).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
