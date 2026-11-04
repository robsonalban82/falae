import { expect, test, type Page } from '@playwright/test';

/** QA: "Ouvir minha voz" in the speak exercise (demo lesson, e07), with fake mic/recorder. */

async function fakes(page: Page, opts: { recorder: boolean }) {
  await page.addInitScript((withRecorder) => {
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      lang = '';
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'Hello, my name is Ana.' }]] });
          this.onend?.();
        }, 50);
      }
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    const stats = { opened: 0, stopped: 0, played: 0 };
    w.__mic = stats;
    if (!withRecorder) return;
    class FakeMR {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['v']) });
        this.onstop?.();
      }
    }
    w.MediaRecorder = FakeMR;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => {
          stats.opened++;
          return Promise.resolve({ getTracks: () => [{ stop: () => stats.stopped++ }] });
        },
      },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'granted' }) },
    });
    HTMLMediaElement.prototype.play = function () {
      stats.played++;
      return Promise.resolve();
    };
  }, opts.recorder);
}

async function reachSpeak(page: Page) {
  const next = async () => {
    await page.getByRole('button', { name: 'Verificar' }).click();
    const cont = page.getByRole('button', { name: /^Continuar/ });
    await expect(cont).toBeVisible();
    await page.waitForTimeout(450);
    await cont.click();
  };
  await page.goto('/licao/demo-sk1-l1');
  await page.getByText('hello', { exact: true }).click();
  await next();
  for (const [en, pt] of [
    ['hello', 'olá'],
    ['thanks', 'obrigado'],
    ['bye', 'tchau'],
    ['please', 'por favor'],
  ]) {
    await page.getByRole('button', { name: en, exact: true }).click();
    await page.getByRole('button', { name: pt, exact: true }).click();
  }
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: /^Continuar/ }).click();
  for (const w of ['Nice', 'to', 'meet', 'you'])
    await page.getByRole('button', { name: `Adicionar "${w}"` }).click();
  await next();
  await page.getByRole('textbox').fill('Muito obrigado!');
  await next();
  await page.getByText('am', { exact: true }).click();
  await next();
  await page.getByRole('textbox').fill('nice to meet you');
  await next();
}

const stats = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mic: Record<string, number> }).__mic);

test('fala: "Ouvir minha voz" aparece, toca depois de Verificar e libera o microfone', async ({
  page,
}) => {
  await fakes(page, { recorder: true });
  await reachSpeak(page);
  const mic = page.getByRole('button', { name: 'Toque para falar' });
  await expect(mic).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvir minha voz' })).toHaveCount(0);
  await mic.click();
  await expect(page.getByText('Entendi:')).toBeVisible();
  const mine = page.getByRole('button', { name: 'Ouvir minha voz' });
  await expect(mine).toBeVisible();
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(mine).toBeEnabled();
  await mine.click();
  await expect.poll(async () => (await stats(page)).played).toBe(1);
  const s = await stats(page);
  expect(s.opened).toBeGreaterThan(0);
  expect(s.stopped).toBe(s.opened);
});

test('fala: sem gravador, o exercício funciona igual e não há botão', async ({ page }) => {
  await fakes(page, { recorder: false });
  await reachSpeak(page);
  await page.getByRole('button', { name: 'Toque para falar' }).click();
  await expect(page.getByText('Entendi:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvir minha voz' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.locator('footer [id]').first()).not.toContainText('Não foi dessa vez');
});
