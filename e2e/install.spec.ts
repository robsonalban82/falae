import { expect, test } from '@playwright/test';

/**
 * Installability (Lighthouse 12+ has no PWA category): manifest fields, icons that really have
 * the declared size, head tags and an active service worker. Chromium projects only.
 */

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

type Manifest = {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  lang: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

test('manifest completo, com ícones 192/512/maskable que existem no tamanho declarado', async ({
  request,
}) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const m = (await res.json()) as Manifest;
  expect(m).toMatchObject({
    name: expect.stringContaining('Falaê'),
    short_name: 'Falaê',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'pt-BR',
  });
  expect(m.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(m.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);

  const sizes = m.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(m.icons.some((i) => i.purpose?.includes('maskable'))).toBe(true);

  for (const icon of m.icons) {
    const img = await request.get(`/${icon.src.replace(/^\//, '')}`);
    expect(img.status(), icon.src).toBe(200);
    const [w, h] = icon.sizes.split('x').map(Number);
    expect(pngSize(await img.body())).toEqual({ width: w, height: h });
  }
});

test('head com manifest, theme-color e apple-touch-icon; SW controla a página', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#/);
  const touch = page.locator('link[rel="apple-touch-icon"]');
  await expect(touch).toHaveAttribute('href', /.+\.png$/);
  const href = (await touch.getAttribute('href')) ?? '';
  expect((await request.get(href)).status()).toBe(200);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // start_url works offline once installed.
  await page.context().setOffline(true);
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
});
