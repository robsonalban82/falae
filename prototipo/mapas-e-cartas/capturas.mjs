#!/usr/bin/env node
// Screenshots of the prototype (390x844 and 1280x800, light and dark) into capturas/.
// Usage: node prototipo/mapas-e-cartas/capturas.mjs
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'capturas');
mkdirSync(OUT, { recursive: true });
const base = pathToFileURL(join(ROOT, 'index.html')).href;

const VIEWPORTS = [
  { name: 'celular', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1280, height: 800, mobile: false },
];

const browser = await chromium.launch();
const problems = [];
for (const vp of VIEWPORTS) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      colorScheme: scheme,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${vp.name}/${scheme}: ${e.message}`));
    const shot = async (name, full = false) => {
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0)
        problems.push(`${vp.name}/${scheme}/${name}: rolagem horizontal de ${overflow}px`);
      await page.screenshot({
        path: join(OUT, `${vp.name}-${scheme}-${name}.png`),
        fullPage: full,
      });
    };
    const firstMap = await page
      .goto(base)
      .then(() => page.evaluate(() => window.FALAE_PROTO.maps[0]?.id));
    const decks = await page.evaluate(() => window.FALAE_PROTO.decks.map((d) => d.id));
    await page.evaluate(() => document.fonts.ready);
    await shot('capa', true);
    await page.goto(`${base}#/colecao/mapas`);
    await shot('colecao');
    if (firstMap) {
      await page.goto(`${base}#/mapa/${firstMap}`);
      await shot('mapa', true);
      await page.click('#toggle-hide');
      await page.locator('.peek').nth(1).click();
      await page.locator('.peek').nth(2).click();
      await page.locator('.chunk').nth(0).scrollIntoViewIfNeeded();
      await shot('mapa-esconder');
      await page.click('#toggle-hide');
      await page.click('#toggle-all');
      await page.locator('.ribbon').nth(1).click();
      await shot('mapa-recolhido');
    }
    // Card backs: the first card with "dontUse" and the first with "falseFriend".
    const find = (key) =>
      page.evaluate((k) => {
        for (const d of window.FALAE_PROTO.decks) {
          const i = d.cards.findIndex((c) => c[k]);
          if (i >= 0) return { id: d.id, i, n: d.cards.length };
        }
        return null;
      }, key);
    // ratings only exist on the back: turn, then rate
    const rateCard = async (r) => {
      await page.click('[data-act="flip"]');
      await page.click(`[data-rate="${r}"]`);
    };
    const openCard = async (t) => {
      await page.goto(`${base}#/cartas/${t.id}`);
      await page.reload();
      for (let i = 0; i < t.i; i++) await rateCard('bom');
    };
    const dont = (await find('dontUse')) || (await find('example'));
    if (dont) {
      await openCard(dont);
      await shot('carta-frente');
      await page.click('[data-act="flip"]');
      await page.waitForTimeout(700);
      await shot('carta-verso');
      await page.click('[data-mode="pt-en"]');
      await shot('carta-pt-en');
      await page.click('[data-mode="en-pt"]');
      for (let i = dont.i; i < dont.n; i++) await rateCard(i % 3 ? 'bom' : 'errei');
      await shot('carta-fim');
    }
    const ff = await find('falseFriend');
    if (ff) {
      await openCard(ff);
      await page.click('[data-act="flip"]');
      await page.waitForTimeout(700);
      await shot('carta-verso-falso-cognato');
    }
    await ctx.close();
  }
}
await browser.close();
if (problems.length) {
  console.log('Problemas:\n' + problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Capturas salvas em ${OUT}`);
