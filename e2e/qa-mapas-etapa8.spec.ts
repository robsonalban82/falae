import { expect, test, type Page } from '@playwright/test';
import { startAt } from './helpers/seed';

/** QA (MAPAS-E-CARTAS Fase 3, etapa 8): "Teste rapido" of the mind map viewer. */

const DAY = '2026-10-29';

// First accepted answer of each blank, per map (src/content/mindmaps/*.json).
const MAPS: Record<string, { title: RegExp; answers: string[] }> = {
  'mm-to-be': { title: /to be/i, answers: ['am', 'is', 'are', "isn't", 'Is'] },
  'mm-in-on-at': { title: /in.*on.*at/i, answers: ['in', 'on', 'at', 'at', 'on'] },
  'mm-phrasal-get': { title: /get/i, answers: ['up', 'off', 'on', 'with', 'over'] },
  'mm-numeros-e-horas': {
    title: /n[uú]meros|horas/i,
    answers: ['time', "o'clock", 'thirty', 'to', 'p.m.'],
  },
  'mm-falsos-cognatos-1': {
    title: /cognatos/i,
    answers: ['parents', 'library', 'Push', 'pretending', 'Actually'],
  },
  'mm-u1-sk1': { title: /./, answers: ['evening', 'morning', 'afternoon', 'night', 'tomorrow'] },
};

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
          const names = Array.from(db.objectStoreNames).sort();
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, unknown> = {};
          let left = names.length;
          for (const n of names) {
            const r = tx.objectStore(n).getAll();
            r.onsuccess = () => {
              out[n] = r.result;
              if (--left === 0) {
                db.close();
                resolve(JSON.stringify(out, Object.keys(out).sort()));
              }
            };
          }
        };
      }),
  );
}

const section = (p: Page) => p.getByRole('region', { name: 'Teste rápido' });
const heading = (p: Page) => p.getByRole('heading', { level: 2, name: 'Teste rápido' });
const field = (p: Page, n: number) =>
  section(p).getByRole('textbox', { name: new RegExp(`^Lacuna ${n}`) });
const docY = (p: Page) =>
  showBtn(p).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
const status = (p: Page) => section(p).locator('p[role="status"]');
const checkAll = (p: Page) => section(p).getByRole('button', { name: 'Conferir tudo' });
const showBtn = (p: Page) => section(p).getByRole('button', { name: /^(Ver|Esconder) respostas$/ });

test.beforeEach(async ({ page }) => {
  await startAt(page, `${DAY}T12:00:00`);
});

for (const [id, data] of Object.entries(MAPS)) {
  test(`${id}: botao da barra rola e foca o titulo; tudo certo da 5 de 5; nada gravado`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`/mapas/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const before = await dumpDb(page);

    const bar = page.getByRole('button', { name: 'Teste rápido' }).first();
    await bar.click();
    await expect(heading(page)).toBeFocused();
    await expect(heading(page)).toBeInViewport();

    for (let i = 0; i < 5; i++) await field(page, i + 1).fill(data.answers[i]!);
    await checkAll(page).click();
    await expect(status(page)).toHaveText('5 de 5 certas');
    await expect(section(page).getByText('Certo!')).toHaveCount(5);
    for (let i = 1; i <= 5; i++)
      await expect(field(page, i)).not.toHaveAttribute('aria-invalid', 'true');

    await page.waitForTimeout(300);
    expect(await dumpDb(page)).toBe(before);
    expect(errors).toEqual([]);
  });
}

test('estrutura: section rotulada, h2 focavel, lang=en, dica pt visivel', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await expect(section(page)).toBeVisible();
  await expect(heading(page)).toHaveAttribute('tabindex', '-1');
  for (let i = 1; i <= 5; i++) await expect(field(page, i)).toHaveAttribute('lang', 'en');
  expect(await section(page).locator('li').count()).toBe(5);
  // accessible name carries the sentence
  await expect(field(page, 1)).toHaveAccessibleName(/Lacuna 1.*30 years old/);
});

test('vazias: Conferir tudo anuncia 0 de 5 e nao foca nenhuma errada', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('   '); // whitespace only counts as empty
  await checkAll(page).click();
  await expect(status(page)).toHaveText('0 de 5 certas');
  await expect(section(page).getByText('Ainda não. Tente de novo.')).toHaveCount(0);
  await expect(field(page, 1)).not.toBeFocused();
});

test('erradas: foco na 1a errada, contagem anunciada, marca com texto e aria-invalid', async ({
  page,
}) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('am');
  await field(page, 2).fill('banana');
  await field(page, 3).fill('xyz');
  await field(page, 4).fill("isn't");
  await checkAll(page).click();
  await expect(status(page)).toHaveText('2 de 5 certas');
  await expect(field(page, 2)).toBeFocused();
  await expect(field(page, 2)).toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 3)).toHaveAttribute('aria-invalid', 'true');
  await expect(section(page).getByText('Ainda não. Tente de novo.')).toHaveCount(2);
  await expect(field(page, 5)).not.toHaveAttribute('aria-invalid', 'true'); // blank is not wrong
});

test('Conferir por item: so confere aquele, anuncia, e nao mexe nos outros', async ({ page }) => {
  await page.goto('/mapas/mm-in-on-at');
  await field(page, 1).fill('in');
  await field(page, 2).fill('at');
  await section(page).getByRole('button', { name: 'Conferir: Lacuna 1' }).click();
  await expect(status(page)).toHaveText('Lacuna 1: Certo!');
  await expect(section(page).getByText('Ainda não. Tente de novo.')).toHaveCount(0);
  await section(page).getByRole('button', { name: 'Conferir: Lacuna 2' }).click();
  await expect(status(page)).toHaveText('Lacuna 2: Ainda não. Tente de novo.');
  // empty item check
  await section(page).getByRole('button', { name: 'Conferir: Lacuna 3' }).click();
  await expect(status(page)).toHaveText('Lacuna 3: em branco');
});

test('maiusculas, espacos e pontuacao final sao aceitos', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('  AM ');
  await field(page, 2).fill('Is.');
  await field(page, 4).fill('is not');
  await field(page, 5).fill('is');
  await checkAll(page).click();
  await expect(field(page, 1)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 4)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 5)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 2)).not.toHaveAttribute('aria-invalid', 'true');
});

test('quase: erro de digitacao conta como certa e mostra a forma certa', async ({ page }) => {
  await page.goto('/mapas/mm-u1-sk1');
  await field(page, 3).fill('afternon');
  await field(page, 1).fill('evning');
  await checkAll(page).click();
  const almost = section(page).getByText('Quase! A forma certa é:');
  await expect(almost).toHaveCount(2);
  await expect(
    section(page).locator('li').nth(2).locator('span[lang="en"]', { hasText: 'afternoon' }),
  ).toBeVisible();
  await expect(status(page)).toHaveText('2 de 5 certas');
});

test('Enter confere e avanca para a proxima lacuna; apos a ultima vai a Conferir tudo', async ({
  page,
}) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('am');
  await field(page, 1).press('Enter');
  await expect(field(page, 2)).toBeFocused();
  await expect(status(page)).toHaveText('Lacuna 1: Certo!');
  await field(page, 2).press('Enter'); // blank
  await expect(field(page, 3)).toBeFocused();
  await expect(status(page)).toHaveText('Lacuna 2: em branco');
  await field(page, 5).fill('Is');
  await field(page, 5).press('Enter');
  await expect(checkAll(page)).toBeFocused();
  await expect(status(page)).toHaveText('Lacuna 5: Certo!');
  // Enter did not submit/navigate
  await expect(page).toHaveURL(/\/mapas\/mm-to-be$/);
});

test('Ver respostas: aria-pressed, mostra 1a aceita, nao marca como certa', async ({ page }) => {
  await page.goto('/mapas/mm-numeros-e-horas');
  const btn = showBtn(page);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveText('Esconder respostas');
  await expect(section(page).getByText('Resposta:')).toHaveCount(5);
  await expect(section(page).locator('b[lang="en"]').nth(1)).toHaveText("o'clock");
  await expect(section(page).locator('b[lang="en"]').nth(4)).toHaveText('p.m.');
  await expect(section(page).getByText('Certo!')).toHaveCount(0);
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(section(page).getByText('Resposta:')).toHaveCount(0);
});

test('editar campo conferido zera a marca; voltar a vazio tambem', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('wrong');
  await section(page).getByRole('button', { name: 'Conferir: Lacuna 1' }).click();
  await expect(field(page, 1)).toHaveAttribute('aria-invalid', 'true');
  await field(page, 1).press('x');
  await expect(field(page, 1)).not.toHaveAttribute('aria-invalid', 'true');
  // the per-item mark is gone (the live region may still hold the last announcement)
  await expect(
    section(page).locator('li').first().getByText('Ainda não. Tente de novo.'),
  ).toHaveCount(0);
  // right -> edit
  await field(page, 1).fill('am');
  await field(page, 1).press('Enter');
  await expect(section(page).locator('li').first().getByText('Certo!')).toHaveCount(1);
  await field(page, 1).fill('');
  await expect(section(page).locator('li').first().getByText('Certo!')).toHaveCount(0);
});

test('clique duplo em Conferir tudo e em Ver respostas e estavel', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('am');
  await checkAll(page).dblclick();
  await expect(status(page)).toHaveText('1 de 5 certas');
  // Two quick taps in the same spot: the answers appear above the button and push it down.
  const y0 = await docY(page);
  await showBtn(page).click();
  await expect(showBtn(page)).toHaveAttribute('aria-pressed', 'true');
  const y1 = await docY(page);
  test
    .info()
    .annotations.push({ type: 'layout-shift', description: `Ver respostas moves ${y1 - y0}px` });
  await showBtn(page).click();
  await expect(showBtn(page)).toHaveAttribute('aria-pressed', 'false');
  expect(Math.abs((await docY(page)) - y0)).toBeLessThan(1);
});

test('dica "Tente com o ingles escondido": so apos comecar, liga o modo e some', async ({
  page,
}) => {
  await page.goto('/mapas/mm-to-be');
  const tip = section(page).getByRole('button', { name: 'Tente com o inglês escondido' });
  await expect(tip).toHaveCount(0);
  await field(page, 1).focus();
  await expect(tip).toBeVisible();
  await tip.click();
  await expect(page.getByRole('button', { name: 'Esconder o inglês' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(tip).toHaveCount(0);
  // the quiz itself must stay usable/visible with hide mode on
  await field(page, 1).fill('am');
  await field(page, 1).press('Enter');
  await expect(status(page)).toHaveText('Lacuna 1: Certo!');
});

test('dica nao aparece se o modo ja esta ligado', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await page.getByRole('button', { name: 'Esconder o inglês' }).click();
  await field(page, 1).focus();
  await expect(
    section(page).getByRole('button', { name: 'Tente com o inglês escondido' }),
  ).toHaveCount(0);
});

test('atalho Teste rapido no painel de fim de estudo foca o titulo', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await page.getByRole('button', { name: 'Esconder o inglês' }).click();
  const peek = page.getByRole('button', { name: 'Mostrar o trecho em inglês' });
  for (let i = 0; i < 200 && (await peek.count()) > 0; i++) await peek.first().click();
  const finish = page.getByRole('button', { name: 'Concluir' });
  if (await finish.isVisible().catch(() => false)) await finish.click();
  const panel = page.locator('[data-testid="map-study-complete"]');
  await expect(panel).toContainText('Mapa estudado!');
  await panel.getByRole('button', { name: 'Teste rápido' }).click();
  await expect(heading(page)).toBeFocused();
});

test('estudar + teste: so o estudo grava; o teste nao altera o banco', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('am');
  await checkAll(page).click();
  await page.getByRole('button', { name: 'Ver respostas' }).click();
  const a = await dumpDb(page);
  await page.reload();
  await page.waitForTimeout(300);
  expect(await dumpDb(page)).toBe(a);
});

test('recarregar zera o teste sem quebrar; voltar do navegador sai do mapa', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/mapas');
  await page.locator('main a[href="/mapas/mm-to-be"]').click();
  await field(page, 1).fill('am');
  await page.reload();
  await expect(field(page, 1)).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(/\/mapas$/);
  expect(errors).toEqual([]);
});

test('offline: o teste funciona (corretor local)', async ({ page, context }) => {
  await page.goto('/mapas/mm-u1-sk1');
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload(); // let the SW settle
  await expect(field(page, 3)).toBeVisible();
  await page.waitForTimeout(500); // lazy known-words chunk finishes loading
  await context.setOffline(true);
  await field(page, 3).fill('afternon');
  await field(page, 2).fill('morning');
  await checkAll(page).click();
  await expect(status(page)).toHaveText('2 de 5 certas');
  await context.setOffline(false);
});

test('campo focado nao fica coberto por barra fixa; sem rolagem horizontal', async ({ page }) => {
  await page.goto('/mapas/mm-to-be');
  for (let i = 1; i <= 5; i++) {
    await field(page, i).focus();
    await field(page, i).scrollIntoViewIfNeeded();
    const covered = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: top === el, inView: r.top >= 0 && r.bottom <= innerHeight };
    });
    expect(covered.onTop).toBe(true);
    expect(covered.inView).toBe(true);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('sem navigator.speechSynthesis o teste continua funcionando', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error simulate a browser without Web Speech
    delete window.speechSynthesis;
  });
  await page.goto('/mapas/mm-to-be');
  await field(page, 1).fill('am');
  await checkAll(page).click();
  await expect(status(page)).toHaveText('1 de 5 certas');
});
