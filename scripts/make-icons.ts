/** Renders public/favicon.svg into the PNG icons the PWA manifest needs. Run: npx tsx scripts/make-icons.ts */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
const targets: [string, number, number][] = [
  ['pwa-192.png', 192, 0],
  ['pwa-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  // Full-bleed square (no rounded corners) so maskable/apple icons crop cleanly.
  const square = svg.replace('rx="14"', 'rx="0"');
  await page.setContent(
    `<html><body style="margin:0">${square.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: join(root, 'public', file), omitBackground: false });
  console.log('✓', file);
}
await browser.close();
