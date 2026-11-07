import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playLesson } from './helpers/playLesson';
import { noRecognition } from './helpers/playLesson';

/** QA (Cartas Fase 4, etapa 2): RouteError, quick-test gap width, MapLine spacing, decorative GoalRing. */

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navegação principal' });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('navegação geral após o errorElement na raiz', () => {
  test('abas, StatsBar e barra inferior', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    const bottom = info.project.name === 'mobile';
    // StatsBar present on tab routes: contains the goal ring image.
    const stats = page.getByRole('img', { name: /meta/i });
    for (const [label, url, hasStats] of [
      ['Trilha', '/', true],
      ['Mapas', '/mapas', true],
      ['Praticar', '/praticar', true],
      ['Perfil', '/perfil', true],
      ['Ajustes', '/config', false],
    ] as const) {
      await nav(page).getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${url === '/' ? '/$' : url + '$'}`));
      await expect(nav(page).getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      );
      if (hasStats) await expect(stats.first()).toBeVisible();
      else await expect(stats).toHaveCount(0);
    }
    // Map and collection hide the bottom bar on phones.
    for (const url of ['/mapas/mm-to-be', '/mapas/colecoes/' + firstCollection()]) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (bottom) await expect(nav(page)).toBeHidden();
      else await expect(nav(page)).toBeVisible();
      await expect(stats).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('lição e prática em tela cheia, sem navegação', async ({ page }) => {
    await page.goto('/licao/u1-sk1-l1');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    await expect(nav(page)).toHaveCount(0);
    await page.goto('/praticar/sessao');
    await expect(nav(page)).toHaveCount(0);
  });

  test('rota inexistente continua mostrando ComingSoon (não RouteError)', async ({ page }) => {
    await page.goto('/nao-existe');
    await expect(page.getByText('Algo deu errado por aqui')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
  });

  test('usuário novo é redirecionado a /boas-vindas e dá para voltar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/mapas');
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await ctx.close();
  });
});

test.describe('RouteError', () => {
  test('falha ao carregar o módulo da rota mostra a tela amigável com link funcional', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', baseURL });
    await ctx.addInitScript(() => localStorage.setItem('falae-e2e-onboarded', '1'));
    const page = await ctx.newPage();
    await page.route(/ProfileScreen-.*\.js/, (r) => r.abort());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      history.pushState({}, '', '/perfil');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    const h1 = page.getByRole('heading', { level: 1, name: 'Algo deu errado por aqui' });
    await expect(h1).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Error|Failed to fetch|at \w+ \(|dynamically imported/i);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // Keyboard: Tab reaches the reload button, then the link; Enter goes to the path.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Recarregar' })).toBeFocused();
    await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name: 'Voltar para a Trilha' });
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(nav(page)).toBeVisible();
    await ctx.close();
  });

  test('erro de render na lição mostra RouteError (não tela branca)', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', baseURL });
    await ctx.addInitScript(() => localStorage.setItem('falae-e2e-onboarded', '1'));
    const page = await ctx.newPage();
    await page.route(/LessonScreen-.*\.js/, (r) => r.abort());
    await page.goto('/licao/u1-sk1-l1');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Algo deu errado por aqui' }),
    ).toBeVisible();
    await ctx.close();
  });

  test('escape malformado na URL (%E0%A4%A) não deixa tela branca', async ({ page }) => {
    await page.route('**/mapas/%E0%A4%A', async (route) => {
      const shell = await page.request.fetch('/');
      await route.fulfill({ response: shell });
    });
    await page.goto('/mapas/%E0%A4%A');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 3000 });
  });
});

function firstCollection(): string {
  const c = JSON.parse(
    readFileSync(join(process.cwd(), 'src/content/collections.json'), 'utf8'),
  ) as { id: string }[];
  return c[0]?.id ?? '';
}

test.describe('Teste rápido: lacunas', () => {
  const dir = join(process.cwd(), 'src/content/mindmaps');
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));

  for (const id of ids) {
    test(`${id}: sem rolagem horizontal e campos dentro da tela`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone layout');
      await page.goto(`/mapas/${id}`);
      const heading = page.getByRole('heading', { level: 2, name: 'Teste rápido' });
      if ((await heading.count()) === 0) test.skip(true, 'map has no quick test');
      await heading.scrollIntoViewIfNeeded();
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll('input[type=text]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { l: r.left, r: r.right, w: r.width };
        }),
      );
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.l).toBeGreaterThanOrEqual(0);
        expect(b.r).toBeLessThanOrEqual(390);
        expect(b.w).toBeGreaterThan(50);
      }
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test('resposta longa digitada não estoura a largura e campo mantém foco', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layout');
    await page.goto('/mapas/mm-to-be');
    await page.getByRole('heading', { level: 2, name: 'Teste rápido' }).scrollIntoViewIfNeeded();
    const input = page.locator('input[type=text]').first();
    await input.fill('x'.repeat(200));
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const b = await input.boundingBox();
    expect(b!.x + b!.width).toBeLessThanOrEqual(390);
  });

  test('zoom de texto grande (fonte 200%): campos do teste rápido continuam na tela', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layout');
    await page.goto('/mapas/mm-to-be');
    await page.addStyleTag({ content: 'html{font-size:32px !important}' });
    await page.getByRole('heading', { level: 2, name: 'Teste rápido' }).scrollIntoViewIfNeeded();
    const right = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll('input[type=text]')].map(
          (el) => el.getBoundingClientRect().right,
        ),
      ),
    );
    expect(right).toBeLessThanOrEqual(390);
  });
});

test.describe('MapLine espaçamento', () => {
  test('linhas de texto têm respiro vertical e sem rolagem horizontal', async ({ page }, info) => {
    await page.goto('/mapas/mm-to-be');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const gaps = await page.evaluate(() => {
      const lis = [...document.querySelectorAll('main li')].filter(
        (li) =>
          getComputedStyle(li).display === 'flex' && getComputedStyle(li).paddingTop === '4px',
      );
      return lis.length;
    });
    expect(gaps).toBeGreaterThan(0);
    if (info.project.name === 'mobile') expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('leitor de tela: telas de fim', () => {
  test('fim da lição: anel da meta oculto, texto da meta presente, sem img duplicada', async ({
    page,
  }) => {
    await noRecognition(page);
    await playLesson(page, 'u1-sk1-l1');
    const heading = page.getByRole('heading', { name: 'Lição concluída!' });
    await expect(heading).toBeFocused();
    // The decorative ring must not expose an img with the goal label inside the finish screen.
    await expect(page.getByRole('main').getByRole('img', { name: /meta/i })).toHaveCount(0);
    await expect(page.getByText(/\d+ de \d+ XP|meta/i).first()).toBeVisible();
    const hiddenRing = await page.evaluate(
      () => document.querySelectorAll('[aria-hidden="true"] svg circle').length,
    );
    expect(hiddenRing).toBeGreaterThan(0);
  });

  test('fim do mapa: status/aria-live, anel oculto, foco no título', async ({ page }) => {
    await page.goto('/mapas/mm-phrasal-get');
    await page.getByRole('button', { name: 'Esconder o inglês' }).click();
    const peeks = page.getByRole('button', { name: /^Mostrar/ });
    for (let g = 0; g < 200 && (await peeks.count()) > 0; g++) await peeks.first().click();
    const done = page.locator('[data-testid="map-study-complete"]');
    await expect(done).toContainText('Mapa estudado!');
    await expect(done.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await expect(done.getByRole('img', { name: /meta/i })).toHaveCount(0);
  });
});
