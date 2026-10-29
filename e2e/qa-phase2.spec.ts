import { expect, test, type Page } from '@playwright/test';

/** QA (Fase 2): theme, persistence, offline/PWA, routing and robustness of the showcase. */

const html = (page: Page) => page.locator('html');
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
/** Clicks the visible pill (label) like a real user; the native radio inside is visually hidden. */
const choose = (page: Page, name: string) =>
  page
    .locator('label')
    .filter({ has: radio(page, name) })
    .click();

test.describe('tema', () => {
  test('"Sistema" is the default and follows the OS, live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/showcase');
    await expect(radio(page, 'Sistema')).toBeChecked();
    await expect(html(page)).toHaveClass(/dark/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#14152b/i);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).not.toHaveClass(/dark/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#fff8ef/i);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html(page)).toHaveClass(/dark/);
  });

  test('explicit "Claro" ignores a dark OS, also after reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/showcase');
    await choose(page, 'Claro');
    await expect(html(page)).not.toHaveClass(/dark/);
    await page.reload();
    await expect(radio(page, 'Claro')).toBeChecked();
    await expect(html(page)).not.toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html(page)).not.toHaveClass(/dark/);
  });

  test('going back to "Sistema" after "Escuro" follows the OS again, and survives reload', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/showcase');
    await choose(page, 'Escuro');
    await expect(html(page)).toHaveClass(/dark/);
    await choose(page, 'Sistema');
    await expect(html(page)).not.toHaveClass(/dark/);
    await page.reload();
    await expect(radio(page, 'Sistema')).toBeChecked();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html(page)).toHaveClass(/dark/);
  });

  test('exactly one theme radio is checked at any time', async ({ page }) => {
    await page.goto('/dev/showcase');
    for (const name of ['Escuro', 'Claro', 'Sistema']) {
      await choose(page, name);
      await expect(page.locator('input[name="theme"]:checked')).toHaveCount(1);
      await expect(radio(page, name)).toBeChecked();
    }
  });

  test('rapid repeated clicks end on the last choice, after reload too', async ({ page }) => {
    await page.goto('/dev/showcase');
    for (let i = 0; i < 5; i++) {
      await choose(page, 'Escuro');
      await choose(page, 'Claro');
    }
    await choose(page, 'Escuro');
    await page.reload();
    await expect(radio(page, 'Escuro')).toBeChecked();
    await expect(html(page)).toHaveClass(/dark/);
  });

  test('theme can be chosen with the keyboard (arrow keys in the radio group)', async ({
    page,
  }) => {
    await page.goto('/dev/showcase');
    await radio(page, 'Sistema').focus();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Claro')).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Escuro')).toBeChecked();
    await expect(html(page)).toHaveClass(/dark/);
    await page.reload();
    await expect(html(page)).toHaveClass(/dark/);
  });

  test('focused theme pill shows a visible focus ring', async ({ page }) => {
    await page.goto('/dev/showcase');
    // Tab from the skip area into the radio group: the checked radio receives focus.
    await radio(page, 'Sistema').focus();
    await page.keyboard.press('ArrowRight');
    const pill = page.locator('label').filter({ has: radio(page, 'Claro') });
    const outline = await pill.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('saved theme survives in a second tab of the same profile', async ({ page, context }) => {
    await page.goto('/dev/showcase');
    await choose(page, 'Escuro');
    await expect(html(page)).toHaveClass(/dark/);
    const other = await context.newPage();
    await other.goto('/praticar');
    await expect(other.locator('html')).toHaveClass(/dark/);
  });

  test('saved dark theme is applied before first paint (no light flash)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/showcase');
    await choose(page, 'Escuro');
    await expect(html(page)).toHaveClass(/dark/);
    await page.addInitScript(() => {
      const w = window as unknown as { __darkAt?: number };
      new MutationObserver(() => {
        if (w.__darkAt === undefined && document.documentElement.classList.contains('dark'))
          w.__darkAt = performance.now();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    await page.reload();
    await expect(html(page)).toHaveClass(/dark/);
    const { darkAt, fcp } = await page.evaluate(() => ({
      darkAt: (window as unknown as { __darkAt?: number }).__darkAt ?? 0,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Infinity,
    }));
    expect(darkAt).toBeLessThanOrEqual(fcp);
  });
});

test.describe('vitrine', () => {
  test('loads without console errors or failed requests', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
    await page.goto('/dev/showcase');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('shows the 5 mascot moods with accessible names', async ({ page }) => {
    await page.goto('/dev/showcase');
    for (const mood of ['feliz', 'comemorando', 'triste', 'incentivando você', 'pensando']) {
      await expect(page.getByRole('img', { name: `Tuca, o tucano, ${mood}` })).toBeVisible();
    }
  });

  test('progress bar buttons clamp between 0 and 12', async ({ page }) => {
    await page.goto('/dev/showcase');
    const bar = page.getByRole('progressbar');
    const minus = page.getByRole('button', { name: /Diminuir/ });
    const plus = page.getByRole('button', { name: /Aumentar/ });
    for (let i = 0; i < 20; i++) await minus.click();
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    for (let i = 0; i < 20; i++) await plus.click();
    await expect(bar).toHaveAttribute('aria-valuenow', '12');
  });

  test('no horizontal scroll at this viewport', async ({ page }) => {
    await page.goto('/dev/showcase');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('bottom nav does not cover the last content on mobile', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile layout only');
    await page.goto('/dev/showcase');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastCard = page.locator('main li').last();
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const [cardBox, navBox] = await Promise.all([lastCard.boundingBox(), nav.boundingBox()]);
    expect(cardBox && navBox && cardBox.y + cardBox.height).toBeLessThanOrEqual(navBox!.y);
  });

  test('cards use the --radius-card token (rounded corners render)', async ({ page }) => {
    await page.goto('/dev/showcase');
    const radius = await page
      .getByRole('heading', { name: 'Cores' })
      .locator('xpath=..')
      .locator('li')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe('20px');
  });

  test('respects reduced motion (mascot not animating)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/showcase');
    const tuca = page.getByRole('img', { name: 'Tuca, o tucano, comemorando' });
    const a = await tuca.screenshot();
    await page.waitForTimeout(400);
    const b = await tuca.screenshot();
    expect(Buffer.compare(a, b)).toBe(0);
  });
});

test.describe('acessibilidade', () => {
  test('first Tab reaches "Pular para o conteúdo", which moves focus to main', async ({ page }) => {
    await page.goto('/dev/showcase');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    // Lazy route: wait until it rendered before the first Tab.
    await expect(page.locator('main#conteudo')).not.toBeEmpty();
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#conteudo$/);
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(() => !!document.activeElement?.closest('main#conteudo'));
    expect(inMain).toBe(true);
  });

  test('skip link exists on placeholder screens too', async ({ page }) => {
    await page.goto('/praticar');
    await expect(page.getByRole('heading', { level: 1, name: 'Praticar' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  });
});

test.describe('rotas', () => {
  for (const path of [
    '/praticar',
    '/perfil',
    '/config',
    '/boas-vindas',
    '/nivelamento',
    '/nao-existe/abc',
  ]) {
    test(`deep link ${path} renders without crashing`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(path);
      // Phase 6 screens are real now; each route renders a heading and throws nothing.
      await expect(page.locator('h1, h2').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('unknown lesson id goes back to the path with a notice (Fase 5)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/licao/nao-existe');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('status').first()).toHaveText(/Não encontramos essa lição/);
    expect(errors).toEqual([]);
  });

  test('deep link to a tip renders the tip (Fase 5)', async ({ page }) => {
    await page.goto('/dica/u1-sk1');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Cumprimentos ao longo do dia' }),
    ).toBeVisible();
  });

  test('"Voltar para o início" and browser back work', async ({ page }) => {
    await page.goto('/dev/showcase');
    await page.getByRole('link', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Falaê' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
    await page.goto('/nao-existe/abc');
    await page.getByRole('link', { name: 'Voltar para o início' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('active nav item is exposed with aria-current', async ({ page }) => {
    await page.goto('/config');
    await expect(page.getByRole('link', { name: 'Ajustes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Trilha' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

test.describe('PWA / offline', () => {
  test('manifest is valid PT-BR with installable icons', async ({ page, request }) => {
    await page.goto('/dev/showcase');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({
      lang: 'pt-BR',
      short_name: 'Falaê',
      display: 'standalone',
      start_url: '/',
    });
    const sizes = (manifest.icons as { sizes: string; src: string }[]).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons as { src: string }[]) {
      const res = await request.get(`/${icon.src.replace(/^\//, '')}`);
      expect(res.ok(), icon.src).toBe(true);
    }
  });

  async function goOffline(page: Page) {
    await page.goto('/dev/showcase');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.context().setOffline(true);
  }

  test('offline: reload of the showcase keeps the saved theme', async ({ page }) => {
    await page.goto('/dev/showcase');
    await choose(page, 'Escuro');
    await goOffline(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Falaê' })).toBeVisible();
    await expect(html(page)).toHaveClass(/dark/);
    // fonts were precached too
    const fontsOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('600 16px Fredoka');
    });
    expect(fontsOk).toBe(true);
    await page.context().setOffline(false);
  });

  test('offline: deep links and unknown routes fall back to the app shell', async ({ page }) => {
    await goOffline(page);
    await page.goto('/qualquer/coisa');
    await expect(page.getByRole('heading', { name: 'Em construção' })).toBeVisible();
    // Lazy routes (tip, lesson) are precached and work offline too.
    await page.goto('/dica/x');
    await expect(page.getByRole('status').first()).toHaveText(/Não encontramos essa dica/);
    await page.goto('/licao/nao-existe');
    await expect(page.getByRole('status').first()).toHaveText(/Não encontramos essa lição/);
    await page.goto('/dica/u1-sk1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.context().setOffline(false);
  });

  test('offline: theme can still be changed and persists', async ({ page }) => {
    await goOffline(page);
    await choose(page, 'Escuro');
    await expect(html(page)).toHaveClass(/dark/);
    await page.reload();
    await expect(html(page)).toHaveClass(/dark/);
    await page.context().setOffline(false);
  });
});

test.describe('persistência robusta', () => {
  test('corrupted settings in IndexedDB fall back to defaults instead of crashing', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/dev/showcase');
    await choose(page, 'Escuro');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('falae');
          req.onsuccess = () => {
            const tx = req.result.transaction('settings', 'readwrite');
            tx.objectStore('settings').put({ id: 'me', theme: 'roxo', dailyGoalXp: 'muito' });
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        }),
    );
    // The localStorage mirror still says "dark": the theme survives, the rest falls back to defaults.
    await page.reload();
    await expect(radio(page, 'Escuro')).toBeChecked();
    await expect(page.getByRole('heading', { level: 1, name: 'Falaê' })).toBeVisible();
    // Without the mirror too, everything falls back to defaults ("Sistema").
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.open('falae');
          req.onsuccess = () => {
            const tx = req.result.transaction('settings', 'readwrite');
            tx.objectStore('settings').put({ id: 'me', theme: 'roxo' });
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
          };
        }),
    );
    await page.reload();
    await expect(radio(page, 'Sistema')).toBeChecked();
    expect(errors).toEqual([]);
  });

  const disableIndexedDb = (page: Page) =>
    page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        get() {
          throw new Error('IndexedDB disabled');
        },
      });
    });

  test('app still renders when IndexedDB is unavailable (private mode-like)', async ({ page }) => {
    await disableIndexedDb(page);
    await page.goto('/dev/showcase');
    await expect(page.getByRole('heading', { level: 1, name: 'Falaê' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  });

  // Decision (kept on purpose, per code review): when saving fails the choice is rolled back.
  test('without IndexedDB a theme choice is rolled back cleanly (decided behaviour)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await disableIndexedDb(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/showcase');
    await choose(page, 'Escuro');
    await expect(radio(page, 'Sistema')).toBeChecked();
    await expect(html(page)).not.toHaveClass(/dark/);
    expect(errors).toEqual([]);
  });

  test('without IndexedDB the initial load leaves no unhandled promise rejection (fixed)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on(
      'console',
      (m) => m.type() === 'error' && /Uncaught/.test(m.text()) && errors.push(m.text()),
    );
    await disableIndexedDb(page);
    await page.goto('/dev/showcase');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('choosing a theme and reloading right away keeps the choice (race fixed)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/showcase');
    await expect(radio(page, 'Sistema')).toBeChecked();
    await choose(page, 'Escuro');
    await page.reload(); // no wait: the IndexedDB write may still be in flight
    await expect(radio(page, 'Escuro')).toBeChecked();
    await expect(html(page)).toHaveClass(/dark/);
    // and it is written back to IndexedDB: a second reload with the mirror cleared still shows it
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(radio(page, 'Escuro')).toBeChecked();
  });
});
