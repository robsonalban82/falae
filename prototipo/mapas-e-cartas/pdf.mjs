#!/usr/bin/env node
// Generates pdf/mapas.pdf (A4 landscape) and pdf/cartas.pdf (A4 portrait, duplex) from print.html.
// Uses the Playwright Chromium already installed for the project. Run build.mjs first.
// Usage: node prototipo/mapas-e-cartas/pdf.mjs [mapas|cartas]
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'pdf');
mkdirSync(OUT, { recursive: true });
if (!existsSync(join(ROOT, 'data.js'))) {
  console.error('data.js não existe: rode antes node prototipo/mapas-e-cartas/build.mjs');
  process.exit(1);
}

const only = process.argv[2];
const jobs = [
  { mode: 'mapas', file: 'mapas.pdf', width: 1123, height: 794 },
  { mode: 'cartas', file: 'cartas.pdf', width: 794, height: 1123 },
].filter((j) => !only || j.mode === only);

const browser = await chromium.launch();
let failed = false;
for (const job of jobs) {
  const ctx = await browser.newContext({
    viewport: { width: job.width, height: job.height },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Measure with print styles so the layout matches the PDF exactly.
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  const url = `${pathToFileURL(join(ROOT, 'print.html')).href}?${job.mode}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__PRINT_DONE__ === true, null, { timeout: 60000 });
  const report = await page.evaluate(() => window.__PRINT_REPORT__);
  await page.pdf({
    path: join(OUT, job.file),
    preferCSSPageSize: true,
    printBackground: true,
  });
  await ctx.close();

  console.log(`pdf/${job.file}: ${report.pages} páginas`);
  if (report.maps.length) {
    console.log(
      '  fonte dos mapas: ' +
        report.maps.map((m) => `${m.id} p.${m.page} ${m.fontPt}pt`).join(' · '),
    );
  }
  if (report.alignment) {
    console.log(
      `  frente/verso: ${report.alignment.cardsChecked} cartas conferidas, erro máximo ${report.alignment.maxErrorMm} mm`,
    );
    if (report.alignment.maxErrorMm > 0.1) failed = true;
  }
  for (const w of report.warnings) console.warn(`  aviso: ${w}`);
  for (const e of report.errors) {
    console.error(`  erro: ${e}`);
    failed = true;
  }
  if (report.overflow.length) {
    console.warn(
      `  aviso: ${report.overflow.length} carta(s) não cabem a 10,5 pt (encurte o texto; ficam com contorno vermelho no PDF):`,
    );
    for (const o of report.overflow) console.warn(`    ${o.id} (${o.side}): passa ${o.mm} mm`);
  }
  for (const e of errors) {
    console.error(`  erro: ${e}`);
    failed = true;
  }
}
await browser.close();
if (failed) process.exitCode = 1;
