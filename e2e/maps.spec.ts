import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { noRecognition } from './helpers/playLesson';
import { playPractice } from './helpers/session';
import { startAt } from './helpers/seed';
import { fakeTts } from './helpers/tts';

test.describe('Mapas tab', () => {
  test('navigation has 5 items in order and Maps opens the list', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link')).toHaveText([
      'Trilha',
      'Mapas',
      'Praticar',
      'Perfil',
      'Ajustes',
    ]);
    await nav.getByRole('link', { name: 'Mapas' }).click();
    await expect(page).toHaveURL(/\/mapas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Mapas' })).toHaveAttribute('aria-current', 'page');
  });

  test('touch targets are at least 44px and fit in the viewport', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'bottom bar is a phone layout');
    await page.goto('/mapas');
    const links = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link');
    const boxes = await links.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, right: r.right, left: r.left };
      }),
    );
    expect(boxes).toHaveLength(5);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(78);
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(390);
    }
  });

  test('filters and search live in the URL and survive a reload', async ({ page }) => {
    await page.goto('/mapas');
    await page.getByText('Filtros', { exact: true }).click();
    await page.getByLabel('Tipo').selectOption('gramatica');
    await expect(page).toHaveURL(/tipo=gramatica/);
    await page.getByLabel('Buscar mapa').fill('to be');
    await expect(page).toHaveURL(/q=to\+be|q=to%20be/);
    await expect(page.getByRole('link', { name: /Verbo to be/ })).toBeVisible();
    await expect(page.getByText('1 mapa', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
    await expect(page.getByLabel('Buscar mapa')).toHaveValue('to be');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).toHaveURL(/\/mapas$/);
  });

  test('the notebook font loads only on the maps routes', async ({ page }) => {
    const fonts: string[] = [];
    page.on('request', (r) => {
      if (/patrick-hand/i.test(r.url())) fonts.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    await page.waitForLoadState('networkidle');
    expect(fonts).toEqual([]);
  });

  test('the notebook font-face exists on /mapas and not on the path', async ({ page }) => {
    const hasHandFace = () =>
      page.evaluate(() =>
        Array.from(document.styleSheets).some((sheet) => {
          try {
            return Array.from(sheet.cssRules).some(
              (r) => r instanceof CSSFontFaceRule && /Patrick Hand/i.test(r.cssText),
            );
          } catch {
            return false;
          }
        }),
      );
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await hasHandFace()).toBe(false);
    await page.getByRole('link', { name: 'Mapas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
    expect(await hasHandFace()).toBe(true);
  });
});

function readXp(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const r = db.transaction('profile', 'readonly').objectStore('profile').getAll();
            r.onerror = () => {
              db.close();
              reject(r.error);
            };
            r.onsuccess = () => {
              db.close();
              resolve((r.result[0] as { totalXp?: number } | undefined)?.totalXp ?? 0);
            };
          } catch (e) {
            db.close();
            reject(e);
          }
        };
      }),
  );
}

/** Quick-test answers read from the map JSON (first accepted answer of each item). */
function quizAnswers(mapId: string): string[] {
  const raw = readFileSync(join(process.cwd(), `src/content/mindmaps/${mapId}.json`), 'utf8');
  const map = JSON.parse(raw) as { quiz: { items: { accepted: string[] }[] } };
  return map.quiz.items.map((i) => {
    const first = i.accepted[0];
    if (first === undefined) throw new Error(`quiz item without an accepted answer in ${mapId}`);
    return first;
  });
}

const peeks = (p: Page) => p.getByRole('button', { name: 'Mostrar o trecho em inglês' });

test.describe('Maps journey', () => {
  test('path -> maps -> filter -> search -> open -> study -> XP -> again -> quiz -> practice', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await fakeTts(page);
    await noRecognition(page);
    await startAt(page, '2026-10-29T12:00:00');

    // Path -> Maps tab
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await nav.getByRole('link', { name: 'Mapas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();

    // Filter by A2, then search "get"
    await page.getByText('Filtros', { exact: true }).click();
    await page.getByLabel('Nível').selectOption('A2');
    await expect(page).toHaveURL(/nivel=A2/);
    await page.getByLabel('Buscar mapa').fill('get');
    await expect(page).toHaveURL(/q=get/);
    const hit = page.locator('main a[href="/mapas/mm-phrasal-get"]');
    await expect(hit).toBeVisible();
    await expect(page.locator('main ul li a[href^="/mapas/mm-"]')).toHaveCount(1);
    await expect(hit).not.toContainText('Já estudado');

    // Open the map
    await hit.click();
    await expect(page).toHaveURL(/\/mapas\/mm-phrasal-get$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Phrasal verbs com get' }),
    ).toBeVisible();

    // Branch by keyboard: Enter closes, Space reopens
    const branch = page.locator('main h2 > button[aria-expanded]').first();
    const panelId = await branch.getAttribute('aria-controls');
    await branch.focus();
    await page.keyboard.press('Enter');
    await expect(branch).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`[id="${panelId}"]`)).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(branch).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
    await expect(branch).toBeFocused();

    // Listen to a chunk (simulated TTS)
    const audio = page.locator('main button[aria-pressed]', { hasText: 'Ouvir:' }).first();
    await audio.click();
    await expect(audio).toHaveAttribute('aria-pressed', 'true');
    await expect(audio).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
    const spoken = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken,
    );
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toBeTruthy();
    expect(await audio.textContent()).toContain(spoken[0]);

    // One-line detail panel
    const trigger = page.getByRole('button', { name: /^Ver detalhes de/ }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Em português')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Hide English, reveal everything, rate one item
    const xp0 = await readXp(page);
    const toggle = page.getByRole('button', { name: 'Esconder o inglês' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const total = await peeks(page).count();
    expect(total).toBeGreaterThan(5);
    const groups = page.getByRole('group', { name: 'Você lembrou?' });
    let rated = false;
    for (let guard = 0; guard < 200 && (await peeks(page).count()) > 0; guard++) {
      await peeks(page).first().click();
      if (!rated && (await groups.count()) > 0) {
        await groups.first().getByRole('button', { name: 'Lembrei', exact: true }).click();
        rated = true;
      }
    }
    expect(rated).toBe(true);
    await expect(peeks(page)).toHaveCount(0);
    const finish = page.getByRole('button', { name: 'Concluir' });
    const done = page.locator('[data-testid="map-study-complete"]');
    // In mm-phrasal-get the last chunk is not an item, so the study saves itself: no "Concluir".
    const finishStudy = async () => {
      await expect(done).toContainText('Mapa estudado!');
      await expect(finish).toHaveCount(0);
    };
    await finishStudy();
    await expect(done).toContainText('Mapa estudado!');
    await expect(done).toContainText('+5 XP');
    await expect.poll(() => readXp(page)).toBe(xp0 + 5);

    // Back to the list: "Já estudado"
    await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
    await expect(page.locator('main a[href="/mapas/mm-phrasal-get"]')).toContainText('Já estudado');
    await page.locator('main a[href="/mapas/mm-phrasal-get"]').click();

    // Study again the same day: no XP
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(peeks(page).first()).toBeVisible();
    for (let guard = 0; guard < 200 && (await peeks(page).count()) > 0; guard++) {
      await peeks(page).first().click();
    }
    await finishStudy();
    await expect(done).toContainText('sem XP desta vez');
    await expect(done).not.toContainText('+5 XP');
    expect(await readXp(page)).toBe(xp0 + 5);

    // Quick test: all five right
    await page.getByRole('button', { name: 'Teste rápido' }).first().click();
    const quiz = page.getByRole('region', { name: 'Teste rápido' });
    const answers = quizAnswers('mm-phrasal-get');
    for (const [i, a] of answers.entries()) {
      await quiz.getByRole('textbox', { name: new RegExp(`^Lacuna ${i + 1}`) }).fill(a);
    }
    await quiz.getByRole('button', { name: 'Conferir tudo' }).click();
    await expect(quiz.locator('p[role="status"]')).toHaveText('5 de 5 certas');

    // Practice this map to the end
    await done.getByRole('link', { name: 'Praticar este mapa' }).click();
    await expect(page).toHaveURL(/\/mapas\/mm-phrasal-get\/praticar$/);
    await playPractice(page);
    await expect(page.getByRole('heading', { name: 'Prática concluída!' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/mapas\/mm-phrasal-get$/);
    expect(errors).toEqual([]);
  });
});

// Offline and reduced motion are covered elsewhere (not repeated here):
// - offline map + scenes: qa-mapas-etapa6 "offline: mapa ja visitado abre apos recarregar",
//   list: qa-mapas-etapa5, quiz: qa-mapas-etapa8, practice: qa-mapas-etapa9.
// - reduced motion branches: qa-mapas-etapa6 "movimento reduzido"; study flow: qa-mapas-etapa7.
