import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeTts, noTts } from './helpers/tts';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 10): read-only collection screen /mapas/colecoes/:collectionId. */

type Entry = {
  itemId: string;
  topic?: string;
  situation?: string;
  formality?: 'informal' | 'neutro' | 'giria';
  avoidWhen?: string;
  baseVerb?: string;
};
type Collection = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  description?: string;
  topics?: { id: string; title: string }[];
  entries: Entry[];
  mapIds?: string[];
};
type Item = { id: string; en: string; pt: string; notes?: string; isVocab: boolean };

const root = process.cwd();
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8')) as unknown;
const collections = readJson('src/content/collections.json') as Collection[];

// Every vocab/sentence in units and banks, by id.
const items = new Map<string, Item>();
function walk(node: unknown, parentKey = '') {
  if (Array.isArray(node)) node.forEach((n) => walk(n, parentKey));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.id === 'string' && typeof o.en === 'string' && o.pt !== undefined) {
      items.set(o.id, {
        id: o.id,
        en: o.en,
        pt: Array.isArray(o.pt) ? (o.pt as string[]).join(' / ') : (o.pt as string),
        notes: typeof o.notes === 'string' ? o.notes : undefined,
        isVocab: parentKey === 'vocab',
      });
    }
    for (const [k, v] of Object.entries(o)) walk(v, k);
  }
}
for (const dir of ['src/content/units', 'src/content/banks']) {
  for (const f of readdirSync(join(root, dir)).filter((n) => n.endsWith('.json')))
    walk(readJson(`${dir}/${f}`));
}
const mapTitles = new Map<string, string>();
for (const f of readdirSync(join(root, 'src/content/mindmaps')).filter((n) =>
  n.endsWith('.json'),
)) {
  const m = readJson(`src/content/mindmaps/${f}`) as { id?: string; title?: string };
  if (m.id && m.title) mapTitles.set(m.id, m.title);
}
const FORMALITY = { informal: 'Informal', neutro: 'Neutro', giria: 'Gíria' } as const;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function dumpDb(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = [...db.objectStoreNames].sort();
          if (names.length === 0) {
            db.close();
            resolve('{}');
            return;
          }
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, unknown[]> = {};
          let left = names.length;
          for (const n of names) {
            const r = tx.objectStore(n).getAll();
            r.onsuccess = () => {
              out[n] = r.result;
              if (--left === 0) {
                db.close();
                resolve(JSON.stringify(out));
              }
            };
          }
        };
      }),
  );
}

const main = (p: Page) => p.locator('main');
const entryLis = (p: Page) => main(p).locator('li:has([lang="en"])');
const noHScroll = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const nav = (p: Page) => p.getByRole('navigation', { name: 'Navegação principal' });

test('dados de apoio: 4 coleções e itens resolvem', () => {
  expect(collections.map((c) => c.id)).toEqual([
    'phrasal',
    'frases',
    'expressoes',
    'falsos-cognatos',
  ]);
  for (const c of collections) {
    for (const e of c.entries) expect(items.has(e.itemId), `${c.id}/${e.itemId}`).toBe(true);
  }
});

test('estante: cada capa e um link para a coleção e abre a tela certa', async ({ page }) => {
  await page.goto('/mapas');
  for (const c of collections) {
    await page.goto('/mapas');
    const cover = page.locator(`a[href="/mapas/colecoes/${c.id}"]`);
    await expect(cover).toHaveCount(1);
    await expect(cover).toContainText(c.title);
    await cover.click();
    await expect(page).toHaveURL(new RegExp(`/mapas/colecoes/${c.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.title);
    await expect(main(page)).toContainText(c.subtitle);
    await expect(page.getByRole('link', { name: 'Voltar para os mapas' })).toBeVisible();
  }
});

for (const c of collections) {
  test(`conteudo completo: ${c.id}`, async ({ page }) => {
    await noTts(page);
    const errors = watchErrors(page);
    await page.goto(`/mapas/colecoes/${c.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.title);
    await expect(entryLis(page)).toHaveCount(c.entries.length);

    // every EN text is in a lang="en" element, none duplicated or missing
    const ens = await main(page).locator('li [lang="en"]').allInnerTexts();
    expect(ens.map(norm).sort()).toEqual(c.entries.map((e) => items.get(e.itemId)!.en).sort());

    const texts = (await entryLis(page).allInnerTexts()).map(norm);
    for (const e of c.entries) {
      const it = items.get(e.itemId)!;
      const parts = [it.en, it.pt];
      if (e.situation) parts.push('Quando usar:', e.situation);
      if (e.formality) parts.push(FORMALITY[e.formality]);
      if (e.avoidWhen) parts.push('Evite quando:', e.avoidWhen);
      if (it.isVocab && it.notes) parts.push('Cuidado', it.notes);
      const hit = texts.some((tx) => parts.every((p) => tx.includes(norm(p))));
      expect(hit, `${c.id}/${e.itemId} faltando em: ${parts.join(' | ')}`).toBe(true);
      if (!e.avoidWhen) {
        // entries without avoidWhen must not show the label
        const own = texts.filter((tx) => tx.includes(it.en) && tx.includes(norm(it.pt)));
        expect(own.some((tx) => !tx.includes('Evite quando:'))).toBe(true);
      }
    }
    expect(await noHScroll(page)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('expressoes: todo selo tem texto e estilo de borda distinto por formalidade', async ({
  page,
}) => {
  await page.goto('/mapas/colecoes/expressoes');
  await expect(entryLis(page)).toHaveCount(12);
  const seals = await entryLis(page).evaluateAll((lis) =>
    lis.map((li) => {
      const el = [...li.querySelectorAll('span')].find((s) =>
        ['Informal', 'Neutro', 'Gíria'].includes((s.textContent ?? '').trim()),
      );
      return el
        ? { text: el.textContent!.trim(), style: getComputedStyle(el).borderTopStyle }
        : null;
    }),
  );
  expect(seals.every(Boolean)).toBe(true);
  const styleOf = new Map<string, Set<string>>();
  for (const s of seals) {
    if (!s) continue;
    if (!styleOf.has(s.text)) styleOf.set(s.text, new Set());
    styleOf.get(s.text)!.add(s.style);
  }
  const all = [...styleOf.values()].flatMap((v) => [...v]);
  // each formality has one style and styles differ across formalities
  for (const v of styleOf.values()) expect(v.size).toBe(1);
  expect(new Set(all).size).toBe(styleOf.size);
});

test('agrupamento: frases por topico, phrasal por verbo base, resto em lista', async ({ page }) => {
  const groupsOf = (p: Page) =>
    main(p)
      .locator('section:has(> h2):has(li [lang="en"])')
      .evaluateAll((secs) =>
        secs.map((s) => ({
          title: (s.querySelector('h2')?.textContent ?? '').trim(),
          lang: s.querySelector('h2 [lang="en"]') ? 'en' : '',
          count: s.querySelectorAll('li').length,
        })),
      );

  const frases = collections.find((c) => c.id === 'frases')!;
  await page.goto('/mapas/colecoes/frases');
  await expect(entryLis(page)).toHaveCount(frases.entries.length);
  const g1 = await groupsOf(page);
  expect(g1.map((g) => g.title)).toEqual(
    frases
      .topics!.filter((tp) => frases.entries.some((e) => e.topic === tp.id))
      .map((tp) => tp.title),
  );
  for (const tp of frases.topics!) {
    const n = frases.entries.filter((e) => e.topic === tp.id).length;
    expect(g1.find((g) => g.title === tp.title)?.count).toBe(n);
  }

  const phrasal = collections.find((c) => c.id === 'phrasal')!;
  await page.goto('/mapas/colecoes/phrasal');
  await expect(entryLis(page)).toHaveCount(phrasal.entries.length);
  const verbs = [...new Set(phrasal.entries.map((e) => e.baseVerb!))];
  const g2 = await groupsOf(page);
  expect(g2.map((g) => g.title)).toEqual(verbs);
  expect(g2.every((g) => g.lang === 'en')).toBe(true);
  for (const v of verbs) {
    expect(g2.find((g) => g.title === v)?.count).toBe(
      phrasal.entries.filter((e) => e.baseVerb === v).length,
    );
  }

  for (const id of ['expressoes', 'falsos-cognatos']) {
    await page.goto(`/mapas/colecoes/${id}`);
    await expect(main(page).locator('section[aria-label="Itens da coleção"]')).toHaveCount(1);
    await expect(main(page).locator('section[aria-label="Itens da coleção"] > h2')).toHaveCount(0);
  }
});

test('mapas da coleção no topo levam ao visualizador certo', async ({ page }) => {
  for (const c of collections) {
    await page.goto(`/mapas/colecoes/${c.id}`);
    const mapLinks = main(page).locator('section[aria-labelledby="coll-maps"] a');
    const ids = c.mapIds ?? [];
    await expect(mapLinks).toHaveCount(ids.length);
    if (ids.length === 0) {
      await expect(main(page).getByRole('heading', { name: 'Mapas desta coleção' })).toHaveCount(0);
      continue;
    }
    // map section comes before the first entry
    const before = await page.evaluate(() => {
      const s = document.querySelector('#coll-maps');
      const li = document.querySelector('main li [lang="en"]');
      return !!s && !!li && !!(s.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(before).toBe(true);
    for (const id of ids) {
      await page.goto(`/mapas/colecoes/${c.id}`);
      await main(page).locator(`a[href="/mapas/${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/mapas/${id}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(mapTitles.get(id)!);
    }
  }
});

test('com TTS simulado: botoes com aria-pressed falam o EN certo; sem aviso', async ({ page }) => {
  await fakeTts(page, 400);
  await page.goto('/mapas/colecoes/phrasal');
  const btns = main(page).locator('button[aria-pressed]');
  await expect(btns).toHaveCount(12);
  await expect(page.getByText('Seu navegador não tem voz em inglês')).toHaveCount(0);
  const a = btns.first();
  await expect(a).toHaveAttribute('aria-pressed', 'false');
  await a.click();
  await expect(a).toHaveAttribute('aria-pressed', 'true');
  // speak() starts after a short delay (SPEAK_DELAY_MS): wait for it instead of reading at once.
  const readSpoken = () =>
    page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  await expect.poll(async () => (await readSpoken()).length).toBe(1);
  const spoken = await readSpoken();
  expect(items.get('u4-get-up')!.en).toBe(spoken[0]);
  await expect(a).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
  // double click and two entries in a row never leave a button stuck
  await a.dblclick();
  await btns.nth(1).click();
  await expect(btns.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(a).toHaveAttribute('aria-pressed', 'false');
  await expect(btns.nth(1)).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
  // leaving the screen while speaking cancels speech without errors
  const errors = watchErrors(page);
  await btns.nth(2).click();
  await page.getByRole('link', { name: 'Voltar para os mapas' }).first().click();
  await expect(page).toHaveURL(/\/mapas$/);
  expect(errors).toEqual([]);
});

test('sem TTS: nenhum botao de audio, texto em lang=en e um unico aviso', async ({ page }) => {
  await noTts(page);
  for (const c of collections) {
    await page.goto(`/mapas/colecoes/${c.id}`);
    await expect(entryLis(page)).toHaveCount(c.entries.length);
    await expect(main(page).locator('button')).toHaveCount(0);
    await expect(main(page).getByText('Seu navegador não tem voz em inglês')).toHaveCount(1);
    await expect(main(page).locator('li [lang="en"]')).toHaveCount(c.entries.length);
  }
});

const BAD_IDS = [
  'nao-existe',
  '__proto__',
  'constructor',
  'toString',
  'PHRASAL',
  'Frases',
  'phrasal%2Ffrases',
  '..%2Fphrasal',
  'phrasal%20',
  'phrasal.',
  '%3Cscript%3Ealert(1)%3C%2Fscript%3E',
];

for (const bad of BAD_IDS) {
  test(`id invalido "${bad}" -> nao encontrada com voltar`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/mapas/colecoes/${bad}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrad/i);
    await expect(entryLis(page)).toHaveCount(0);
    const back = page.getByRole('link', { name: 'Voltar para os mapas' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/mapas$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });
}

test('/mapas/colecoes (sem id) nao quebra', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/mapas/colecoes');
  await expect(page.getByRole('link', { name: 'Voltar para os mapas' })).toBeVisible();
  await expect(entryLis(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('voltar do navegador e recarregar mantem a coleção', async ({ page }) => {
  await page.goto('/mapas');
  await page.locator('a[href="/mapas/colecoes/expressoes"]').click();
  await expect(entryLis(page)).toHaveCount(12);
  await page.reload();
  await expect(entryLis(page)).toHaveCount(12);
  await page.goBack();
  await expect(page).toHaveURL(/\/mapas$/);
  await page.goForward();
  await expect(entryLis(page)).toHaveCount(12);
  await page.getByRole('link', { name: 'Voltar para os mapas' }).click();
  await expect(page).toHaveURL(/\/mapas$/);
});

test('navegar rapido entre colecoes nao mistura conteudo', async ({ page }) => {
  await page.goto('/mapas/colecoes/phrasal');
  await page.evaluate(() => {
    history.pushState({}, '', '/mapas/colecoes/frases');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Frases do dia a dia');
  await expect(entryLis(page)).toHaveCount(24);
  await expect(main(page).getByText('get up', { exact: true })).toHaveCount(0);
});

test('barra inferior: escondida no celular, visivel no desktop', async ({ page }, info) => {
  await page.goto('/mapas/colecoes/frases');
  await expect(entryLis(page)).toHaveCount(24);
  if (info.project.name === 'mobile') {
    await expect(nav(page)).toBeHidden();
    // the last entry is not covered by anything fixed
    await entryLis(page).last().scrollIntoViewIfNeeded();
  } else {
    await expect(nav(page)).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Mapas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
  expect(await noHScroll(page)).toBe(true);
});

test('sem rolagem horizontal em todas as coleções e na estante', async ({ page }) => {
  for (const url of ['/mapas', ...collections.map((c) => `/mapas/colecoes/${c.id}`)]) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await noHScroll(page), url).toBe(true);
    const wide = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter(
          (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
        ).length,
    );
    expect(wide, url).toBe(0);
  }
});

test('somente leitura: nada gravado no IndexedDB', async ({ page }) => {
  await fakeTts(page, 100);
  await page.goto('/mapas');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // let the app finish its own first-run writes
  await page.waitForTimeout(800);
  const before = await dumpDb(page);
  for (const c of collections) {
    await page.goto(`/mapas/colecoes/${c.id}`);
    await expect(entryLis(page)).toHaveCount(c.entries.length);
    await main(page).locator('button[aria-pressed]').first().click();
    await main(page).locator(`a[href^="/mapas/mm-"]`).first().isVisible();
  }
  await page.goto('/mapas');
  await page.waitForTimeout(500);
  expect(await dumpDb(page)).toBe(before);
  // no collection-related localStorage keys either
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => /colec|collection/i.test(k))).toEqual([]);
});

test('teclado: Tab percorre link voltar, mapas e botoes com foco visivel', async ({ page }) => {
  await fakeTts(page, 400);
  await page.goto('/mapas/colecoes/falsos-cognatos');
  await expect(entryLis(page)).toHaveCount(12);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: string[] = [];
  const outlines: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.closest('main')) return null;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        label: (el.textContent ?? '').trim().slice(0, 40),
        outline: `${cs.outlineStyle}/${cs.outlineWidth}`,
      };
    });
    if (info) {
      seen.push(`${info.tag}:${info.label}`);
      outlines.push(info.outline);
    }
  }
  expect(seen.some((s) => s.startsWith('A:Voltar para os mapas'))).toBe(true);
  expect(seen.some((s) => s.startsWith('A:Falsos cognatos'))).toBe(true);
  expect(seen.filter((s) => s.startsWith('BUTTON')).length).toBeGreaterThanOrEqual(12);
  for (const o of outlines) expect(o).not.toMatch(/^none|\/0px/);
  // Enter on a focused audio button speaks
  const btn = main(page).locator('button[aria-pressed]').first();
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
});

test('teclado: estante tem capas focaveis com Enter abrindo a coleção', async ({ page }) => {
  await page.goto('/mapas');
  const cover = page.locator('a[href="/mapas/colecoes/expressoes"]');
  await cover.focus();
  await expect(cover).toBeFocused();
  const outline = await cover.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/colecoes\/expressoes$/);
});

test('offline: coleção visitada abre apos recarregar (service worker)', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.goto('/mapas/colecoes/expressoes');
  await expect(entryLis(page)).toHaveCount(12);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Expressões e gírias');
    await expect(entryLis(page)).toHaveCount(12);
    // collections never visited also come from the precache
    await page.getByRole('link', { name: 'Voltar para os mapas' }).click();
    await page.locator('a[href="/mapas/colecoes/frases"]').click();
    await expect(entryLis(page)).toHaveCount(24);
    await page.goto('/mapas/colecoes/phrasal');
    await expect(entryLis(page)).toHaveCount(12);
  } finally {
    await context.setOffline(false);
  }
});

// Known bug (router-wide, not only collections): a malformed percent sequence renders a blank page.
test.fail(
  'URL com escape malformado (%E0%A4%A) mostra nao encontrada, nao tela em branco',
  async ({ page }) => {
    await page.goto('/mapas/colecoes/%E0%A4%A');
    await expect(page.getByRole('link', { name: 'Voltar para os mapas' })).toBeVisible({
      timeout: 3000,
    });
  },
);
