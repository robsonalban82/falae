import { expect, test, type Page } from '@playwright/test';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 5): Maps tab, URL filters, studied badge, offline, fonts. */
type Hooks = {
  exportForTest: () => Promise<{ data: Record<string, unknown> } & Record<string, unknown>>;
  importForTest: (f: unknown) => Promise<void>;
};

async function markStudied(page: Page, mapIds: string[]) {
  await page.evaluate(async (ids) => {
    const h = (window as unknown as { __falae: Hooks }).__falae;
    const cur = await h.exportForTest();
    await h.importForTest({
      ...cur,
      data: {
        ...cur.data,
        mapProgress: ids.map((mapId) => ({
          mapId,
          firstStudiedAt: '2026-10-29T12:00:00.000Z',
          lastStudiedDay: '2026-10-29',
          timesStudied: 1,
        })),
      },
    });
  }, mapIds);
}

const summary = (p: Page) => p.locator('main details > summary');
const isOpen = (p: Page) =>
  p.locator('main details').evaluate((d) => (d as HTMLDetailsElement).open);
/** Opens the filters disclosure when it is closed. */
async function openFilters(p: Page) {
  if (!(await isOpen(p))) await summary(p).click();
  await expect(p.getByLabel('Tipo')).toBeVisible();
}

const search = (p: Page) => p.getByLabel('Buscar mapa');
const count = async (p: Page) =>
  (await p.locator('main ul li a[href^="/mapas/"]').count()) as number;

test('URLs invalidas ou combinadas nao quebram nem escondem a lista', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mapas');
  const total = await count(page);
  expect(total).toBeGreaterThan(1);
  for (const q of [
    '?nivel=Z9&tipo=xxx&unidade=nope&estudado=talvez',
    '?nivel=A1&nivel=A2',
    '?tipo=%00%ff&q=%E0%A4%A',
    '?q=' + 'a'.repeat(5000),
    '?q=%20%20%20',
    '?unidade=__proto__&nivel=constructor',
  ]) {
    await page.goto('/mapas' + q);
    await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
    if (q.includes('aaaa'))
      await expect(page.getByText('Nenhum mapa com esses filtros.')).toBeVisible();
    else if (!q.includes('nivel=A1') && !q.includes('q=%E0')) expect(await count(page)).toBe(total);
  }
  // combined real filters
  await page.goto('/mapas?nivel=A1&tipo=gramatica&estudado=nao');
  await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
  expect(await count(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('busca com acento, espacos, e sem acento dao o mesmo; voltar/avancar restauram', async ({
  page,
}) => {
  await page.goto('/mapas');
  await search(page).fill('  Você  ');
  const a = await count(page);
  await search(page).fill('voce');
  expect(await count(page)).toBe(a);
  await search(page).fill('zzzzqq');
  await expect(page.getByText('Nenhum mapa com esses filtros.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Limpar filtros' })).toBeVisible();
  // string longa
  await search(page).fill('x'.repeat(3000));
  await expect(page.getByText('Nenhum mapa com esses filtros.')).toBeVisible();
  await search(page).fill('');
  await expect(page).toHaveURL(/\/mapas$/);

  // history: select filter (push), then back/forward
  await openFilters(page);
  await page.getByLabel('Tipo').selectOption('gramatica');
  await expect(page).toHaveURL(/tipo=gramatica/);
  await openFilters(page);
  await page.getByLabel('Estudo').selectOption('nao');
  await expect(page).toHaveURL(/estudado=nao/);
  await page.goBack();
  await expect(page).not.toHaveURL(/estudado=nao/);
  await expect(page.getByLabel('Estudo')).toHaveValue('');
  await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
  await page.goBack();
  await expect(page).toHaveURL(/\/mapas$/);
  await expect(page.getByLabel('Tipo')).toHaveValue('');
  await page.goForward();
  await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
});

test('digitar a busca nao empilha historico (replace)', async ({ page }) => {
  await page.goto('/mapas');
  await openFilters(page);
  await page.getByLabel('Tipo').selectOption('gramatica');
  await search(page).pressSequentially('verbo', { delay: 20 });
  await expect(page).toHaveURL(/q=verbo/);
  await page.goBack();
  await expect(page).toHaveURL(/\/mapas$/);
});

test('selo "Ja estudado" e contador atualizam ao vivo e apos reload; filtro Estudo', async ({
  page,
}) => {
  await page.goto('/mapas');
  await expect(page.getByText(/^0 de \d+ mapas estudados$/)).toBeVisible();
  await expect(page.getByText('Já estudado', { exact: true })).toHaveCount(0);
  const hrefs = await page
    .locator('main ul li a[href^="/mapas/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')!.replace('/mapas/', '')));
  await markStudied(page, [hrefs[0]!]);
  await expect(page.getByText('Já estudado', { exact: true })).toHaveCount(1);
  await expect(page.getByText(/^1 de \d+ mapas? estudados?$/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('Já estudado', { exact: true })).toHaveCount(1);
  await openFilters(page);
  await page.getByLabel('Estudo').selectOption('sim');
  await expect(page.getByText('1 mapa', { exact: true })).toBeVisible();
  await openFilters(page);
  await page.getByLabel('Estudo').selectOption('nao');
  expect(await count(page)).toBe(hrefs.length - 1);
  // mapa desconhecido no progresso nao deve inflar o contador
  await markStudied(page, ['mm-fantasma', hrefs[0]!]);
  await page.reload();
  await expect(page.getByText(/^1 de \d+ mapas? estudados?$/)).toBeVisible();
});

test('rotas placeholder abrem sem erro e mantem Mapas ativo', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  for (const u of ['/mapas/mm-in-on-at', '/mapas/colecoes/qualquer', '/mapas/nao-existe']) {
    await page.goto(u);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The map viewer hides the bottom bar on phones by design (FASE-3 step 6); the rail stays on desktop.
    if (info.project.name === 'mobile' && /^\/mapas\/[^/]+$/.test(u)) {
      await expect(nav).toBeHidden();
    } else {
      await expect(nav.getByRole('link', { name: 'Mapas' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  }
  expect(errors).toEqual([]);
});

test('clique num mapa e voltar preserva filtros', async ({ page }) => {
  await page.goto('/mapas?tipo=gramatica');
  await page.locator('main ul li a[href^="/mapas/"]').first().click();
  await expect(page).toHaveURL(/\/mapas\/mm-/);
  await page.goBack();
  await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
});

test('teclado: tab chega em busca, selects e links com foco visivel', async ({ page }) => {
  await page.goto('/mapas');
  await expect(search(page)).toBeVisible();
  await search(page).focus();
  const outline = await search(page).evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(summary(page)).toBeFocused();
  const link = page.locator('main ul li a[href^="/mapas/"]').first();
  await link.focus();
  expect(await link.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/mapas\/mm-/);
});

test('mobile: menu >= 78px de largura, alvos >= 44px, sem rolagem horizontal', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('/mapas');
  const links = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link');
  const w = await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  for (const x of w) expect(x).toBeGreaterThanOrEqual(78);
  // controls in the list
  const small = await page
    .locator('main input, main select, main a, main button')
    .evaluateAll((els) =>
      els
        .map((e) => ({
          t: (e.textContent || e.id).slice(0, 30),
          h: e.getBoundingClientRect().height,
        }))
        .filter((x) => x.h > 0 && x.h < 44),
    );
  expect(small).toEqual([]);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(over).toBeLessThanOrEqual(0);
  // last list item is not hidden behind the bottom nav
  const last = page.locator('main ul li').last();
  await last.scrollIntoViewIfNeeded();
  const nav = await page.locator('nav').first().boundingBox();
  const box = await last.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y + 1);
});

test('320px: sem estouro horizontal em /mapas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/mapas');
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('modo escuro: texto da lista tem contraste legivel (sem fundo claro fixo)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    colorScheme: 'dark',
    baseURL: 'http://localhost:4173',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [{ name: 'falae-e2e-onboarded', value: '1' }],
        },
      ],
    },
  });
  const page = await ctx.newPage();
  await page.goto('/mapas');
  const first = page.locator('main ul li a[href^="/mapas/"]').first();
  await expect(first).toBeVisible();
  const lum = (c: string) => {
    const m = c.match(/[\d.]+/g)!.map(Number);
    const [r, g, b] = m.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const colors = await first.evaluate((e) => {
    const title = e.querySelector('span.font-display')!;
    let bg: Element | null = e;
    let bgc = 'rgba(0, 0, 0, 0)';
    while (bg && /rgba\(0, 0, 0, 0\)|transparent/.test(bgc)) {
      bgc = getComputedStyle(bg).backgroundColor;
      bg = bg.parentElement;
    }
    return { fg: getComputedStyle(title).color, bg: bgc };
  });
  const [a, b] = [lum(colors.fg), lum(colors.bg)];
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  await ctx.close();
});

test('Patrick Hand: nao baixa em /, /praticar, /perfil; baixa em /mapas', async ({ page }) => {
  test.setTimeout(60_000);
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (/patrick/i.test(r.url())) fonts.push(r.url());
  });
  for (const u of ['/', '/praticar', '/perfil', '/config']) {
    await page.goto(u);
    await page.waitForLoadState('networkidle');
  }
  expect(fonts).toEqual([]);
  await page.goto('/mapas');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.load('22px "Patrick Hand"'));
  expect(fonts.length).toBeGreaterThan(0);
});

test('offline: lista abre pelo cache, filtros funcionam, sem erro', async ({ page, context }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mapas');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // let the SW control the page and cache the lazy chunk
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
  await page.goto('/');
  await context.setOffline(true);
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Mapas' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
  await openFilters(page);
  await page.getByLabel('Tipo').selectOption('gramatica');
  expect(await count(page)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByLabel('Tipo')).toHaveValue('gramatica');
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test('clique duplo no menu Mapas nao duplica entradas nem quebra', async ({ page }) => {
  await page.goto('/');
  const l = page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Mapas' });
  await l.dblclick();
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
});

test('disclosure: fechado por padrao, abre com filtro na URL, nao com so q', async ({ page }) => {
  await page.goto('/mapas');
  expect(await isOpen(page)).toBe(false);
  await expect(summary(page)).toHaveText('Filtros');
  await page.goto('/mapas?q=verbo');
  expect(await isOpen(page)).toBe(false);
  for (const q of ['nivel=A1', 'tipo=gramatica', 'estudado=nao']) {
    await page.goto('/mapas?' + q);
    expect(await isOpen(page)).toBe(true);
    await expect(summary(page)).toHaveText('Filtros (1 ativo)');
  }
  await page.goto('/mapas?nivel=A1&tipo=gramatica&estudado=nao&q=x');
  await expect(summary(page)).toHaveText('Filtros (3 ativos)');
  // lixo na URL nao conta
  await page.goto('/mapas?nivel=Z9&tipo=foo');
  await expect(summary(page)).toHaveText('Filtros');
  expect(await isOpen(page)).toBe(false);
});

test('disclosure: Enter e Espaco abrem e fecham; Limpar fica fora; contador sobe ao escolher', async ({
  page,
}) => {
  await page.goto('/mapas');
  await summary(page).focus();
  await page.keyboard.press('Enter');
  expect(await isOpen(page)).toBe(true);
  await page.keyboard.press('Enter');
  expect(await isOpen(page)).toBe(false);
  await page.keyboard.press('Space');
  expect(await isOpen(page)).toBe(true);
  await page.keyboard.press('Space');
  expect(await isOpen(page)).toBe(false);
  await page.keyboard.press('Space');
  await page.getByLabel('Tipo').selectOption('gramatica');
  await expect(summary(page)).toHaveText('Filtros (1 ativo)');
  // fechar nao perde o filtro; Limpar continua visivel e fora do details
  await page.keyboard.press('Escape');
  await summary(page).click();
  expect(await isOpen(page)).toBe(false);
  const clear = page.getByRole('button', { name: 'Limpar filtros' });
  await expect(clear).toBeVisible();
  expect(await clear.evaluate((e) => !!e.closest('details'))).toBe(false);
  await clear.click();
  await expect(page).toHaveURL(/\/mapas$/);
  await expect(summary(page)).toHaveText('Filtros');
});

test('leitura de progresso falha: sem select Estudo e ?estudado=sim ignorado', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...a) {
      if (this.name === 'mapProgress') throw new Error('boom');
      return orig.apply(this, a as []);
    };
    const open = IDBObjectStore.prototype.openCursor;
    IDBObjectStore.prototype.openCursor = function (...a) {
      if (this.name === 'mapProgress') throw new Error('boom');
      return open.apply(this, a as []);
    };
  });
  await page.goto('/mapas');
  const total = await count(page);
  await page.goto('/mapas?estudado=sim');
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
  await expect(page.getByText('Não deu para ler seu progresso nos mapas.')).toBeVisible();
  await expect(page.getByLabel('Estudo')).toHaveCount(0);
  expect(await count(page)).toBe(total);
  expect(total).toBeGreaterThan(1);
  await expect(summary(page)).toHaveText('Filtros');
});
