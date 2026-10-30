import sharp from 'sharp';
const P = process.argv[2];
const bg = '#FFF8EF';
const src = 'out/tuca-feliz-1024.png';
async function icon(size, scale, out) {
  const inner = Math.round(size * scale);
  const art = await sharp(src).resize(inner, inner).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([
      { input: art, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) },
    ])
    .png()
    .toFile(`${P}/${out}`);
}
await icon(512, 0.82, 'pwa-512.png');
await icon(512, 0.6, 'pwa-512-maskable.png'); // whole bird inside the 80% safe circle
await icon(192, 0.82, 'pwa-192.png');
await icon(180, 0.82, 'apple-touch-icon.png');
// favicon: head close-up (crop of the 1024 art), rounded square
const head = await sharp(src)
  .extract({ left: 200, top: 120, width: 560, height: 560 })
  .resize(56, 56)
  .png()
  .toBuffer();
const svgBg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#FFF8EF"/></svg>',
);
const fav = await sharp(svgBg)
  .composite([{ input: head, left: 4, top: 4 }])
  .png()
  .toBuffer();
await sharp(fav).toFile('favicon-64.png');
const b64 = fav.toString('base64');
const fs = await import('node:fs');
fs.writeFileSync(
  `${P}/favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${b64}"/></svg>`,
);
