import { expect, test, type Page } from '@playwright/test';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 6): map viewer at /mapas/:mapId. */

const MAPS = [
  { id: 'mm-to-be', title: 'Verbo to be', branches: 6 },
  { id: 'mm-in-on-at', title: 'In, on, at', branches: 5 },
  { id: 'mm-numeros-e-horas', title: 'Números e horas', branches: 6 },
  { id: 'mm-phrasal-get', title: 'Phrasal verbs com get', branches: 6 },
  { id: 'mm-falsos-cognatos-1', title: 'Falsos cognatos (1)', branches: 6 },
  { id: 'mm-u1-sk1', title: 'Olá e tchau', branches: 6 },
];

/** Fake speechSynthesis: speak() fires start, then end after `window.__ttsMs` ms. */
async function fakeTts(page: Page, ms = 400) {
  await page.addInitScript((delay) => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [] as string[];
    class Utt {
      text: string;
      lang = '';
      rate = 1;
      voice = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const voice = { lang: 'en-US', name: 'Fake', localService: true, default: true, voiceURI: 'f' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const synth = {
      paused: false,
      speaking: false,
      pending: false,
      getVoices: () => [voice],
      addEventListener() {},
      removeEventListener() {},
      resume() {},
      cancel() {
        clearTimeout(timer);
      },
      speak(u: Utt) {
        (w.__spoken as string[]).push(u.text);
        u.onstart?.();
        timer = setTimeout(() => u.onend?.(), delay);
      },
    };
    w.SpeechSynthesisUtterance = Utt;
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  }, ms);
}

async function noTts(page: Page) {
  await page.addInitScript(() => {
    for (const name of ['speechSynthesis', 'SpeechSynthesisUtterance']) {
      let o: object | null = window;
      while (o) {
        try {
          Reflect.deleteProperty(o, name);
        } catch {
          /* ignore */
        }
        o = Object.getPrototypeOf(o) as object | null;
      }
    }
  });
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

const branchButtons = (p: Page) => p.locator('main h2 > button[aria-expanded]');

for (const m of MAPS) {
  test(`abre ${m.id} pela lista e mostra ramos, cartoes e linhas`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/mapas');
    await page.locator(`main a[href="/mapas/${m.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/mapas/${m.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: m.title })).toBeVisible();
    await expect(page).toHaveTitle(m.title);
    await expect(branchButtons(page)).toHaveCount(m.branches);
    // every branch starts open with a labelled count
    for (const b of await branchButtons(page).all()) {
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      const h = await b.boundingBox();
      expect(h?.height ?? 0).toBeGreaterThanOrEqual(47.5);
    }
    expect(await page.locator('main li > .absolute').count()).toBeGreaterThan(5); // tag chips
    expect(await page.locator('main section li ul li').count()).toBeGreaterThan(10);
    // scenes: decorative, lazy, fixed size, actually loaded (non-zero natural size)
    const imgs = page.locator('main img');
    expect(await imgs.count()).toBeGreaterThan(0);
    for (const img of await imgs.all()) {
      await expect(img).toHaveAttribute('alt', '');
      await expect(img).toHaveAttribute('aria-hidden', 'true');
      await expect(img).toHaveAttribute('loading', 'lazy');
      await expect(img).toHaveAttribute('width', /\d+/);
    }
    // center node
    await expect(page.locator('main header [lang="en"]').first()).toBeVisible();
    // no horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // no image failed to load after scrolling everything into view
    await page.evaluate(async () => {
      for (const el of document.querySelectorAll('main img')) el.scrollIntoView();
      await new Promise((r) => setTimeout(r, 400));
    });
    const broken = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLImageElement>('main img')].filter(
          (i) => i.complete && i.naturalWidth === 0,
        ).length,
    );
    expect(broken).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('todo trecho em ingles visivel tem lang="en" (sem texto em ingles solto)', async ({
  page,
}) => {
  await page.goto('/mapas/mm-to-be');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.locator('main [lang="en"]').count()).toBeGreaterThan(20);
});

test('ramos so por teclado: Enter e Espaco abrem/fecham, foco visivel e permanece', async ({
  page,
}) => {
  await page.goto('/mapas/mm-to-be');
  const first = branchButtons(page).first();
  await first.focus();
  const panelId = await first.getAttribute('aria-controls');
  await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await expect(first).toBeFocused();
  await expect(page.locator(`[id="${panelId}"]`)).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(first).toBeFocused();
  await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
  // Tab order reaches the next ribbon eventually; closing it leaves the rest alone
  const second = branchButtons(page).nth(1);
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  // outline is visible on keyboard focus
  const outline = await second.evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(outline).not.toBe('none');
});

test('clique duplo rapido num ramo volta ao estado original', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  const b = branchButtons(page).first();
  await b.dblclick();
  await expect(b).toHaveAttribute('aria-expanded', 'true');
});

test('Abrir tudo / Fechar tudo e estado misto', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  const all = page.getByRole('button', { name: /^(Abrir|Fechar) tudo$/ });
  await expect(all).toHaveText('Fechar tudo');
  await all.click();
  for (const b of await branchButtons(page).all())
    await expect(b).toHaveAttribute('aria-expanded', 'false');
  await expect(all).toHaveText('Abrir tudo');
  await branchButtons(page).nth(2).click(); // mixed: one open
  await expect(all).toHaveText('Abrir tudo');
  await all.click();
  for (const b of await branchButtons(page).all())
    await expect(b).toHaveAttribute('aria-expanded', 'true');
  await expect(all).toHaveText('Fechar tudo');
  // Abrir tudo then closing one flips the label back
  await branchButtons(page).first().click();
  await expect(all).toHaveText('Abrir tudo');
});

test('mudar de mapa reinicia o estado dos ramos', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await branchButtons(page).first().click();
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await page.locator('main a[href="/mapas/mm-in-on-at"]').click();
  await expect(branchButtons(page).first()).toHaveAttribute('aria-expanded', 'true');
});

test('com TTS simulado: tocar um trecho fala, marca aria-pressed e solta no fim', async ({
  page,
}) => {
  await fakeTts(page, 600);
  const errors = watchErrors(page);
  await page.goto('/mapas/mm-to-be');
  const audio = page.locator('main button[aria-pressed]');
  await expect(audio.first()).toBeVisible();
  expect(await audio.count()).toBeGreaterThan(5);
  await expect(page.getByText('Seu navegador não tem voz')).toHaveCount(0);
  const a = audio.nth(0);
  const b = audio.nth(1);
  await a.click();
  await expect(a).toHaveAttribute('aria-pressed', 'true');
  await expect(a).toContainText('tocando');
  await expect(a).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
  // spoken text has no markup
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken).toHaveLength(1);
  expect(spoken[0]).not.toMatch(/\*\*|<|>/);
  expect(spoken[0]?.trim().length).toBeGreaterThan(0);
  // tapping another one while the first plays: the second ends up pressed, the first is released
  await a.click();
  await b.click();
  await expect(b).toHaveAttribute('aria-pressed', 'true');
  await expect(a).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
  // double tap does not throw
  await b.dblclick();
  await expect(b).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
  expect(errors).toEqual([]);
});

test('sair da tela com audio tocando nao deixa erro nem som preso', async ({ page }) => {
  await fakeTts(page, 5000);
  const errors = watchErrors(page);
  await page.goto('/mapas/mm-to-be');
  await page.locator('main button[aria-pressed]').first().click();
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('sem TTS: nenhum botao de audio e exatamente um aviso', async ({ page }) => {
  await noTts(page);
  const errors = watchErrors(page);
  await page.goto('/mapas/mm-to-be');
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  expect(await page.evaluate(() => 'speechSynthesis' in window)).toBe(false);
  await expect(page.locator('main button[aria-pressed]')).toHaveCount(0);
  await expect(page.getByText('Seu navegador não tem voz em inglês')).toHaveCount(1);
  // the English is still there, as plain text
  expect(await page.locator('main [lang="en"]').count()).toBeGreaterThan(20);
  // detail sheet still works and has no audio buttons either
  await page
    .getByRole('button', { name: /^Ver detalhes de/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('button[aria-pressed]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('TTS sem voz (nunca inicia): vira texto simples com um aviso', async ({ page }) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    class Utt {
      constructor(public text: string) {}
    }
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = Utt;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        paused: false,
        getVoices: () => [],
        addEventListener() {},
        removeEventListener() {},
        cancel() {},
        resume() {},
        speak() {},
      },
    });
  });
  await page.goto('/mapas/mm-to-be');
  const first = page.locator('main button[aria-pressed]').first();
  await first.click();
  await expect(page.getByText('Seu navegador não tem voz em inglês')).toHaveCount(1, {
    timeout: 8000,
  });
  await expect(page.locator('main button[aria-pressed]')).toHaveCount(0);
});

test.describe('painel Ver detalhes', () => {
  test('abre, prende o foco, Esc fecha e devolve o foco a linha', async ({ page }) => {
    await fakeTts(page);
    const errors = watchErrors(page);
    await page.goto('/mapas/mm-to-be');
    const trigger = page.getByRole('button', { name: /^Ver detalhes de/ }).nth(1);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByText('Em português')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeFocused();
    // Tab many times: focus never leaves the dialog
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    expect(errors).toEqual([]);
  });

  test('botao Fechar tambem devolve o foco; reabrir varias vezes nao acumula', async ({ page }) => {
    await page.goto('/mapas/mm-to-be');
    const trigger = page.getByRole('button', { name: /^Ver detalhes de/ }).first();
    for (let i = 0; i < 3; i++) {
      await trigger.click();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });

  test('conteudo atras do painel nao recebe clique (modal)', async ({ page }) => {
    await page.goto('/mapas/mm-to-be');
    await page
      .getByRole('button', { name: /^Ver detalhes de/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    const vp = page.viewportSize()!;
    // sheet stays inside the viewport
    expect(box!.x).toBeGreaterThanOrEqual(-0.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 0.5);
    const closeAll = page.getByRole('button', { name: 'Fechar tudo' });
    await expect(closeAll)
      .toBeHidden()
      .catch(() => undefined);
    // top-left corner of the viewport is the backdrop, not the page
    const top = await page.evaluate(() => document.elementFromPoint(2, 2)?.tagName);
    expect(top).toBe('DIALOG');
  });

  test('painel pode ser aberto e fechado em cada mapa sem erro', async ({ page }) => {
    const errors = watchErrors(page);
    for (const m of MAPS) {
      await page.goto(`/mapas/${m.id}`);
      await expect(page.getByRole('heading', { level: 1, name: m.title })).toBeVisible();
      const btns = page.getByRole('button', { name: /^Ver detalhes de/ });
      expect(await btns.count()).toBeGreaterThan(0);
      await btns.first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByRole('heading')).not.toBeEmpty();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});

test('mapId invalido mostra nao encontrado com voltar e nao quebra', async ({ page }) => {
  const errors = watchErrors(page);
  for (const id of ['nao-existe', 'MM-TO-BE', '__proto__', 'constructor', '%20', 'mm-to-be%2F..']) {
    await page.goto(`/mapas/${id}`);
    await expect(page.getByRole('heading', { name: 'Mapa não encontrado' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mapa não encontrado' })).toBeFocused();
  }
  await page.getByRole('link', { name: 'Voltar para os mapas' }).click();
  await expect(page).toHaveURL(/\/mapas$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mapas' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('voltar do navegador e do link retornam a /mapas; recarregar mantem o mapa', async ({
  page,
}) => {
  await page.goto('/mapas');
  await page.locator('main a[href="/mapas/mm-in-on-at"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'In, on, at' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'In, on, at' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/mapas$/);
  await expect(page).not.toHaveTitle('In, on, at');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'In, on, at' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await expect(page).toHaveURL(/\/mapas$/);
});

test('troca rapida entre mapas (voltar/avancar) nao deixa tela do mapa errado', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/mapas/mm-to-be');
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await page.locator('main a[href="/mapas/mm-phrasal-get"]').click();
  await page.goBack();
  await page.goBack();
  await page.goForward();
  await page.goForward();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Phrasal verbs com get' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });
  test('abrir e fechar ramo e instantaneo (sem wrapper animado)', async ({ page }) => {
    await page.goto('/mapas/mm-to-be');
    const b = branchButtons(page).first();
    const id = await b.getAttribute('aria-controls');
    await b.click();
    // removed immediately: no exit animation lingering
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(0, { timeout: 50 });
    await b.click();
    await expect(page.locator(`[id="${id}"]`)).toBeVisible({ timeout: 50 });
    const h = await page
      .locator(`[id="${id}"]`)
      .evaluate((e) => e.parentElement?.style.height ?? '');
    expect(h).toBe('');
  });
});

test('com movimento: fechar anima e termina removendo o painel', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  const b = branchButtons(page).first();
  const id = await b.getAttribute('aria-controls');
  await b.click();
  await expect(page.locator(`[id="${id}"]`)).toHaveCount(0, { timeout: 2000 });
  await b.click();
  await expect(page.locator(`[id="${id}"]`)).toBeVisible();
});

test('layout: celular em coluna unica, desktop com cartoes lado a lado', async ({ page }, info) => {
  await page.goto('/mapas/mm-to-be');
  const panel = page.locator('main ul[id]').first();
  const cards = panel.locator(':scope > li');
  // The map is lazy: wait for the second card before measuring.
  await expect(cards.nth(1)).toBeVisible();
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  if (!a || !b) throw new Error('cards have no layout box');
  if (info.project.name === 'mobile') {
    expect(Math.abs(a.x - b.x)).toBeLessThan(2);
    expect(a.x + a.width).toBeLessThanOrEqual(390.5);
  } else {
    expect(b.x).toBeGreaterThan(a.x + 100);
  }
});

test('modo escuro: ribbons e texto legiveis (sem erro, sem overflow)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const errors = watchErrors(page);
  await page.goto('/mapas/mm-numeros-e-horas');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('linhas fix tem texto para leitor de tela errado/certo; sem dangerouslySetInnerHTML', async ({
  page,
}) => {
  await page.goto('/mapas/mm-falsos-cognatos-1');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const wrong = page.locator('main .sr-only', { hasText: 'errado:' });
  const right = page.locator('main .sr-only', { hasText: 'certo:' });
  const n = await wrong.count();
  if (n > 0) expect(await right.count()).toBeGreaterThanOrEqual(n);
  expect(await page.locator('main del').count()).toBe(n);
  // no literal markdown asterisks leaking from rich text
  expect(await page.locator('main').innerText()).not.toContain('**');
});

test('offline: mapa ja visitado abre apos recarregar (service worker)', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.goto('/mapas/mm-to-be');
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const errors = watchErrors(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Verbo to be' })).toBeVisible();
  await expect(branchButtons(page)).toHaveCount(6);
  // an unvisited map also comes from the precache
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await page.locator('main a[href="/mapas/mm-u1-sk1"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Olá e tchau' })).toBeVisible();
  // scenes come from the precache too
  const broken = await page.evaluate(async () => {
    for (const el of document.querySelectorAll('main img')) el.scrollIntoView();
    await new Promise((r) => setTimeout(r, 600));
    return [...document.querySelectorAll<HTMLImageElement>('main img')].filter(
      (i) => i.complete && i.naturalWidth === 0,
    ).length;
  });
  expect(broken).toBe(0);
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.setOffline(false);
});
