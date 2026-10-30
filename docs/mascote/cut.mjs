import sharp from 'sharp';
const [, , src, out, ...seeds] = process.argv;
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const bg = (i) => {
  const r = data[i],
    g = data[i + 1],
    b = data[i + 2];
  return Math.min(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
};
const seen = new Uint8Array(w * h);
const q = [];
for (let x = 0; x < w; x++) {
  q.push(x, (h - 1) * w + x);
}
for (let y = 0; y < h; y++) {
  q.push(y * w, y * w + w - 1);
}
for (const sd of seeds) {
  const [x, y] = sd.split(',').map(Number);
  q.push(y * w + x);
}
while (q.length) {
  const p = q.pop();
  if (seen[p]) continue;
  if (!bg(p * 4)) continue;
  seen[p] = 1;
  data[p * 4 + 3] = 0;
  const x = p % w,
    y = (p / w) | 0;
  if (x > 0) q.push(p - 1);
  if (x < w - 1) q.push(p + 1);
  if (y > 0) q.push(p - w);
  if (y < h - 1) q.push(p + w);
}
// soften: opaque light pixels touching removed ones get partial alpha
for (let p = 0; p < w * h; p++) {
  if (seen[p]) continue;
  const x = p % w,
    y = (p / w) | 0;
  const n = [p - 1, p + 1, p - w, p + w].some((k) => k >= 0 && k < w * h && seen[k]);
  if (!n) continue;
  const i = p * 4;
  const l = Math.min(data[i], data[i + 1], data[i + 2]);
  if (l > 120) data[i + 3] = Math.round(255 * (1 - (l - 120) / 135));
}
const img = sharp(data, { raw: { width: w, height: h, channels: 4 } });
const trimmed = await img
  .png()
  .toBuffer()
  .then((b) => sharp(b).trim().toBuffer({ resolveWithObject: true }));
const { width: tw, height: th } = trimmed.info;
const side = Math.round(Math.max(tw, th) * 1.06);
const sq = await sharp({
  create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: trimmed.data, left: Math.round((side - tw) / 2), top: Math.round((side - th) / 2) },
  ])
  .png()
  .toBuffer();
await sharp(sq)
  .resize(512, 512)
  .webp({ quality: 82, alphaQuality: 90 })
  .toFile(out + '.webp');
await sharp(sq)
  .resize(1024, 1024)
  .png()
  .toFile(out + '-1024.png');
