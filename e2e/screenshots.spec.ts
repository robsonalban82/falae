import { expect, test, type Page } from '@playwright/test';
import { noRecognition } from './helpers/playLesson';
import { playPractice } from './helpers/session';
import { fakeTts } from './helpers/tts';
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
      // Images decode asynchronously: wait so full-page captures never show blank art.
      await page.evaluate(() =>
        Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined))),
      );
      const base = `e2e/screenshots/${info.project.name}-${theme}-${screen.name}`;
      // Viewport shot first: a full-page capture resizes the viewport and loses the scroll
      // position (the path's scroll to the current node), so "-tela" must come before it.
      if (screen.full) await page.screenshot({ path: `${base}-tela.png` });
      await page.screenshot({ path: `${base}.png`, fullPage: screen.full ?? false });
    });
  }
}

// Grayscale check (shape + icon + label must work without color), showcase only.
for (const theme of ['light', 'dark'] as const) {
  test(`@screens vitrine grayscale (${theme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await noRecognition(page);
    await startAt(page, `${DAY}T12:00:00`);
    await page.goto('/dev/showcase');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() =>
      Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined))),
    );
    await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    await page.screenshot({
      path: `e2e/screenshots/${info.project.name}-${theme}-vitrine-cinza.png`,
      fullPage: true,
    });
  });
}

// The 5-item navigation at 390px (touch targets and spacing); clipped to the bar, with Maps active.
for (const theme of ['light', 'dark'] as const) {
  test(`@screens navegacao-5-itens (${theme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await noRecognition(page);
    await startAt(page, `${DAY}T12:00:00`);
    await page.goto('/mapas');
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await nav.waitFor();
    await nav.screenshot({
      path: `e2e/screenshots/${info.project.name}-${theme}-navegacao-5-itens.png`,
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Mind maps (Fase 3 etapa 11): list, viewer states, collections and the map practice session.
// Output: e2e/screenshots/<project>-<theme>-mapa-<name>[-tela].png and the grayscale twin
// <project>-<theme>-mapa-<name>[-tela]-cinza.png (for the designer-de-mapas).
// ---------------------------------------------------------------------------------------------

const peeks = (p: Page) => p.getByRole('button', { name: 'Mostrar o trecho em inglês' });
const studyToggle = (p: Page) => p.getByRole('button', { name: 'Esconder o inglês' });
const mapHeading = (p: Page, name: string) =>
  expect(p.getByRole('heading', { level: 1, name })).toBeVisible();

const inViewport = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

async function revealSome(page: Page, n: number) {
  for (let i = 0; i < n; i++) await peeks(page).first().click();
}

async function revealAllMap(page: Page) {
  for (let guard = 0; guard < 200 && (await peeks(page).count()) > 0; guard++) {
    await peeks(page).first().click();
  }
  const finish = page.getByRole('button', { name: 'Concluir' });
  await expect(finish).toBeVisible();
  await finish.click();
}

type MapShot = {
  name: string;
  /** Also a full-page capture (besides the viewport one). */
  full?: boolean;
  run: (page: Page) => Promise<void>;
};

const mapShots: MapShot[] = [
  {
    name: 'lista',
    full: true,
    run: async (page) => {
      await page.goto('/mapas');
      await mapHeading(page, 'Mapas');
      await expect(page.getByRole('link', { name: /Verbo to be/ })).toBeVisible();
    },
  },
  {
    name: 'lista-com-filtro',
    full: true,
    run: async (page) => {
      await page.goto('/mapas?nivel=A2&q=get');
      await expect(page.locator('main a[href="/mapas/mm-phrasal-get"]')).toBeVisible();
    },
  },
  {
    name: 'lista-vazia-de-filtro',
    run: async (page) => {
      await page.goto('/mapas?nivel=A2&tipo=gramatica');
      await expect(page.getByText('Nenhum mapa com esses filtros.')).toBeVisible();
    },
  },
  {
    name: 'to-be-topo',
    full: true,
    run: async (page) => {
      await page.goto('/mapas/mm-to-be');
      await mapHeading(page, 'Verbo to be');
    },
  },
  {
    name: 'to-be-ramo-aberto',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be');
      await mapHeading(page, 'Verbo to be');
      await page.getByRole('button', { name: 'Fechar tudo' }).click();
      const branch = page.locator('main h2 > button[aria-expanded]').nth(1);
      await branch.click();
      await expect(branch).toHaveAttribute('aria-expanded', 'true');
      await branch.scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'to-be-painel',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be');
      await mapHeading(page, 'Verbo to be');
      await page
        .getByRole('button', { name: /^Ver detalhes de/ })
        .nth(1)
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'to-be-escondido-meio',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be');
      await mapHeading(page, 'Verbo to be');
      await studyToggle(page).click();
      await revealSome(page, 6);
      await expect(page.locator('main p[role="status"]').first()).toContainText('6 de');
    },
  },
  {
    name: 'to-be-concluido',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be');
      await mapHeading(page, 'Verbo to be');
      await studyToggle(page).click();
      await revealAllMap(page);
      const done = page.locator('[data-testid="map-study-complete"]');
      await expect(done).toContainText('+5 XP');
      await done.scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'to-be-teste-conferido',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be');
      await mapHeading(page, 'Verbo to be');
      const quiz = page.getByRole('region', { name: 'Teste rápido' });
      const field = (n: number) => quiz.getByRole('textbox', { name: new RegExp(`^Lacuna ${n}`) });
      await field(1).fill('am'); // right
      await field(2).fill('iss'); // wrong (no typo tolerance on 2-letter answers; see u1-sk1 shot)
      await field(3).fill('banana'); // wrong
      await field(4).fill("isn't"); // right
      // 5 left empty
      await quiz.getByRole('button', { name: 'Conferir tudo' }).click();
      await expect(quiz.locator('p[role="status"]')).toContainText('de 5 certas');
      await quiz.scrollIntoViewIfNeeded();
    },
  },
  {
    // "quase" needs a longer answer: to-be only has short words, which get no typo tolerance.
    name: 'u1-sk1-teste-certa-quase-errada',
    run: async (page) => {
      await page.goto('/mapas/mm-u1-sk1');
      const quiz = page.getByRole('region', { name: 'Teste rápido' });
      const field = (n: number) => quiz.getByRole('textbox', { name: new RegExp(`^Lacuna ${n}`) });
      await field(1).fill('evning'); // almost
      await field(2).fill('morning'); // right
      await field(3).fill('banana'); // wrong
      await quiz.getByRole('button', { name: 'Conferir tudo' }).click();
      await expect(quiz.getByText('Quase! A forma certa é:')).toHaveCount(1);
      await quiz.scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'falsos-cognatos-1',
    full: true,
    run: async (page) => {
      await page.goto('/mapas/mm-falsos-cognatos-1');
      await mapHeading(page, 'Falsos cognatos (1)');
    },
  },
  {
    name: 'colecao-frases',
    full: true,
    run: async (page) => {
      await page.goto('/mapas/colecoes/frases');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main li [lang="en"]').first()).toBeVisible();
    },
  },
  {
    name: 'colecao-phrasal',
    full: true,
    run: async (page) => {
      await page.goto('/mapas/colecoes/phrasal');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main li [lang="en"]').first()).toBeVisible();
    },
  },
  {
    name: 'colecao-expressoes',
    run: async (page) => {
      await page.goto('/mapas/colecoes/expressoes');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const informal = page.getByText('Informal', { exact: true }).first();
      const slang = page.getByText('Gíria', { exact: true }).first();
      await expect(informal).toBeAttached();
      await expect(slang).toBeAttached();
      // Scroll so both badges show when they are close together; otherwise end on the slang one.
      await informal.scrollIntoViewIfNeeded();
      if (!(await slang.isVisible()) || !(await slang.evaluate(inViewport))) {
        await slang.scrollIntoViewIfNeeded();
      }
    },
  },
  {
    name: 'praticar-pergunta',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be/praticar');
      await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    },
  },
  {
    name: 'praticar-fim',
    run: async (page) => {
      await page.goto('/mapas/mm-to-be/praticar');
      await playPractice(page);
    },
  },
];

for (const theme of ['light', 'dark'] as const) {
  for (const shot of mapShots) {
    test(`@screens mapa ${shot.name} (${theme})`, async ({ page }, info) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await fakeTts(page);
      await noRecognition(page);
      await startAt(page, `${DAY}T12:00:00`);
      await shot.run(page);
      await page.waitForLoadState('networkidle');
      // Scenes load lazily: scroll through the page so every <img> starts loading, then wait for them.
      if (shot.full) {
        await page.evaluate(async () => {
          for (const img of document.images) img.loading = 'eager';
          const step = Math.max(window.innerHeight - 100, 200);
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
      }
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images)
            // Skip lazy images that never started loading (off-screen): decode() would reject/hang.
            .filter((img) => img.complete || img.loading !== 'lazy')
            .map((img) => img.decode().catch(() => undefined)),
        ).then(() => document.fonts.ready),
      );
      const base = `e2e/screenshots/${info.project.name}-${theme}-mapa-${shot.name}`;
      const snap = async (suffix: string) => {
        await page.screenshot({ path: `${base}${suffix}.png` });
        if (shot.full) {
          // The fixed nav bar would show up in the middle of a full-page capture: hide it (script only).
          const hideNav = await page.addStyleTag({
            content: 'nav[aria-label="Navegação principal"] { visibility: hidden !important; }',
          });
          await page.screenshot({ path: `${base}${suffix}-completa.png`, fullPage: true });
          await hideNav.evaluate((el) => (el as Element).remove()); // a <style> element
        }
      };
      await snap('');
      // A filter on <html> alone is not always applied to a scrolled desktop viewport: a fixed
      // backdrop-filter layer grays whatever is visible as well.
      await page.addStyleTag({
        content:
          'html { filter: grayscale(1); } html::after { content: ""; position: fixed; inset: 0; backdrop-filter: grayscale(1); pointer-events: none; z-index: 2147483647; }',
      });
      await snap('-cinza');
    });
  }
}
