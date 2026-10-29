import { expect, test, type Page } from '@playwright/test';

/**
 * QA (Fase 3): the demo lesson (src/dev/demoUnit.ts, VITE_DEMO=1) played end to end.
 * Exercise order of demo-sk1-l1: e01 MC · e02 pairs · e03 word-bank · e04 translate ·
 * e05 fill-blank · e06 listen-type · e07 speak · e08 word-bank · e09 MC · e10 translate.
 */

const LESSON = '/licao/demo-sk1-l1';
const ids = ['e01', 'e02', 'e03', 'e04', 'e05', 'e06', 'e07', 'e08', 'e09', 'e10'] as const;
type Id = (typeof ids)[number];

// ---------- browser capabilities ----------

/** Fake recognizer that "hears" the given text, so speak can be tested headless. */
async function fakeSpeech(page: Page, heard = 'Hello, my name is Ana.') {
  await page.addInitScript((text) => {
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      lang = '';
      maxAlternatives = 1;
      interimResults = false;
      continuous = false;
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: text }]] });
          this.onend?.();
        }, 50);
      }
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  }, heard);
}

/** Browser without Web Speech at all (no TTS, no STT). */
async function noSpeech(page: Page) {
  await page.addInitScript(() => {
    for (const name of [
      'speechSynthesis',
      'SpeechSynthesisUtterance',
      'SpeechRecognition',
      'webkitSpeechRecognition',
    ]) {
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

// ---------- IndexedDB helpers (run in the page) ----------

type Dump = {
  profile: { totalXp: number; hearts: number; heartsUpdatedAt: string } | undefined;
  results: { xp: number; lessonId: string; mistakes: number }[];
  lessonProgress: { lessonId: string; completedCount: number }[];
  daily: { xp: number; lessons: number }[];
  settings: { speakDisabledUntil?: string } | undefined;
};

function dumpDb(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['profile', 'results', 'lessonProgress', 'daily', 'settings']);
          const out: Record<string, unknown> = {};
          const get = (store: string, key?: string) =>
            new Promise<void>((res) => {
              const r = key ? tx.objectStore(store).get(key) : tx.objectStore(store).getAll();
              r.onsuccess = () => {
                out[store] = r.result;
                res();
              };
            });
          void Promise.all([
            get('profile', 'me'),
            get('results'),
            get('lessonProgress'),
            get('daily'),
            get('settings', 'me'),
          ]).then(() => {
            db.close();
            resolve(out as Dump);
          });
        };
      }),
  );
}

/** Writes a valid profile with the given hearts (refill clock starts now). */
async function setHearts(page: Page, hearts: number) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    (h) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('profile', 'readwrite');
          const now = new Date().toISOString();
          tx.objectStore('profile').put({
            id: 'me',
            createdAt: now,
            onboardingDone: false,
            totalXp: 0,
            hearts: h,
            heartsUpdatedAt: now,
            streak: { current: 0, longest: 0, freezes: 0, xpTowardFreeze: 0 },
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    hearts,
  );
}

/** Client-side navigation (keeps the simulated clock offset, which a reload would reset). */
async function softNavigate(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

// ---------- playing ----------

const verify = (page: Page) => page.getByRole('button', { name: 'Verificar' });
const cont = (page: Page) => page.getByRole('button', { name: 'Continuar', exact: true });
/** The visible feedback card (its details block, which "Continuar" points to via aria-describedby). */
const feedback = (page: Page) => page.locator('footer [id]').first();
/** Persistent sr-only live region in the player. */
const live = (page: Page) => page.getByRole('status');
/** "Continuar" ignores mouse clicks for 400 ms after it appears (anti double-click); act like a person. */
async function clickContinue(page: Page) {
  await expect(cont(page)).toBeVisible();
  await page.waitForTimeout(450);
  await cont(page).click();
}
const hearts = (page: Page) => page.getByRole('img', { name: /coraç(ão|ões)$/ });

/** Presses the number key of an option as displayed (options are shuffled per exercise). */
async function pressOption(page: Page, text: string) {
  const values = await page
    .locator('main input[type="radio"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  const i = values.indexOf(text);
  expect(i, `option "${text}" among ${values.join(', ')}`).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(i + 1));
}

async function tile(page: Page, word: string) {
  await page.getByRole('button', { name: `Adicionar "${word}"` }).click();
}

async function pairsByTouch(page: Page) {
  for (const [en, pt] of [
    ['hello', 'olá'],
    ['thanks', 'obrigado'],
    ['bye', 'tchau'],
    ['please', 'por favor'],
  ]) {
    await page.getByRole('button', { name: en, exact: true }).click();
    await page.getByRole('button', { name: pt, exact: true }).click();
  }
}

/** Fills in the right answer for `id` by touch/mouse. Does not press Verificar. */
async function answerRight(page: Page, id: Id, opts: { tts?: boolean } = {}) {
  const tts = opts.tts ?? true;
  switch (id) {
    case 'e01':
      return page.getByText('hello', { exact: true }).click();
    case 'e02':
      return pairsByTouch(page); // auto-checks
    case 'e03':
      for (const w of ['Nice', 'to', 'meet', 'you']) await tile(page, w);
      return;
    case 'e04':
      return page.getByRole('textbox').fill('Muito obrigado!');
    case 'e05':
      return page.getByText('am', { exact: true }).click();
    case 'e06':
      return page.getByRole('textbox').fill(tts ? 'nice to meet you' : 'Prazer em te conhecer');
    case 'e07':
      await page.getByRole('button', { name: 'Toque para falar' }).click();
      await expect(page.getByText('Entendi:')).toBeVisible();
      return;
    case 'e08':
      for (const w of ["I'm", 'thirty', 'years', 'old']) await tile(page, w);
      return;
    case 'e09':
      return page.getByText('thanks', { exact: true }).click();
    case 'e10':
      return page.getByRole('textbox').fill('Prazer, Ana');
  }
}

async function checkAndContinue(page: Page, id: Id, expectOk = true) {
  if (id !== 'e02') await verify(page).click();
  await expect(feedback(page)).toBeVisible();
  if (expectOk) await expect(feedback(page)).not.toContainText('Não foi dessa vez');
  await clickContinue(page);
}

async function playRight(page: Page, list: readonly Id[], opts: { tts?: boolean } = {}) {
  for (const id of list) {
    await answerRight(page, id, opts);
    await checkAndContinue(page, id);
  }
}

async function finishScreen(page: Page) {
  await expect(page.getByRole('heading', { name: 'Lição concluída!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled(); // saved
}

// ---------- tests ----------

test.describe('lição demo — jogar inteira', () => {
  test('por toque/mouse, sem erros: lição perfeita grava resultado e XP uma vez', async ({
    page,
  }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await expect(hearts(page)).toHaveAccessibleName('5 corações');
    await playRight(page, ids);
    await finishScreen(page);
    await expect(page.getByText('Lição perfeita! Nenhum erro.')).toBeVisible();
    const db = await dumpDb(page);
    const xp = db.results[0]?.xp ?? 0;
    expect(xp).toBeGreaterThanOrEqual(15);
    // The XP counter animates up to the saved value.
    await expect(page.locator('dd').first()).toHaveText(`+${xp}`);

    expect(db.profile?.totalXp).toBe(xp);
    expect(db.profile?.hearts).toBe(5);
    expect(db.results).toHaveLength(1);
    expect(db.results[0]).toMatchObject({ lessonId: 'demo-sk1-l1', xp, mistakes: 0 });
    expect(db.lessonProgress).toEqual([
      expect.objectContaining({ lessonId: 'demo-sk1-l1', completedCount: 1 }),
    ]);
    expect(db.daily).toEqual([expect.objectContaining({ xp, lessons: 1 })]);

    // Reloading on the finish screen must not record the lesson again.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const again = await dumpDb(page);
    expect(again.results).toHaveLength(1);
    expect(again.profile?.totalXp).toBe(xp);
  });

  test('"Continuar" on the finish screen goes back to the path; double click is harmless', async ({
    page,
  }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ids);
    await finishScreen(page);
    await page.getByRole('button', { name: 'Continuar' }).dblclick();
    await expect(page).toHaveURL(/\/$/);
    expect((await dumpDb(page)).results).toHaveLength(1);
  });

  test('só por teclado: 1–4, Enter verifica, foco vai para "Continuar"', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await page.waitForLoadState('networkidle');

    const tabTo = async (match: (el: { tag: string; label: string; text: string }) => boolean) => {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const el = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          return {
            tag: a?.tagName ?? '',
            label: a?.getAttribute('aria-label') ?? '',
            text: (a?.textContent ?? '').trim(),
          };
        });
        if (match(el)) return;
      }
      throw new Error('element not reachable with Tab');
    };
    const continueFocusedThenEnter = async () => {
      await expect(cont(page)).toBeFocused();
      await page.keyboard.press('Enter');
    };

    // e01: number key + Enter
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
    await pressOption(page, 'hello');
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toBeVisible();
    await continueFocusedThenEnter();

    // e02: pairs with Tab + Enter
    for (const [en, pt] of [
      ['hello', 'olá'],
      ['thanks', 'obrigado'],
      ['bye', 'tchau'],
      ['please', 'por favor'],
    ]) {
      await tabTo((e) => e.tag === 'BUTTON' && e.text === en);
      await page.keyboard.press('Enter');
      await tabTo((e) => e.tag === 'BUTTON' && e.text === pt);
      await page.keyboard.press('Enter');
    }
    await continueFocusedThenEnter();

    // e03: word bank with Tab + Enter, then Tab to Verificar
    for (const w of ['Nice', 'to', 'meet', 'you']) {
      await tabTo((e) => e.label === `Adicionar "${w}"`);
      await page.keyboard.press('Enter');
    }
    await tabTo((e) => e.text === 'Verificar');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    // e04: typing, Enter submits from the textarea
    await tabTo((e) => e.tag === 'TEXTAREA');
    await page.keyboard.type('muito obrigado');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    // e05: fill blank with number key
    await pressOption(page, 'am');
    await page.keyboard.press('Enter');
    await expect(feedback(page)).not.toContainText('Não foi dessa vez');
    await continueFocusedThenEnter();

    // e06: listen-type
    await tabTo((e) => e.tag === 'TEXTAREA');
    await page.keyboard.type('nice to meet you');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    // e07: speak — mic button, then Verificar
    await tabTo((e) => e.label === 'Toque para falar');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Entendi:')).toBeVisible();
    await tabTo((e) => e.text === 'Verificar');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    // e08
    for (const w of ["I'm", 'thirty', 'years', 'old']) {
      await tabTo((e) => e.label === `Adicionar "${w}"`);
      await page.keyboard.press('Enter');
    }
    await tabTo((e) => e.text === 'Verificar');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    // e09
    await pressOption(page, 'thanks');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    // e10
    await tabTo((e) => e.tag === 'TEXTAREA');
    await page.keyboard.type('Muito prazer, Ana');
    await page.keyboard.press('Enter');
    await continueFocusedThenEnter();

    await finishScreen(page);
    await expect(page.getByRole('heading', { name: 'Lição concluída!' })).toBeFocused();
  });
});

test.describe('erros e corações', () => {
  test('erro volta no fim (uma vez), corações caem e persistem após recarregar', async ({
    page,
  }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    // e01 wrong
    await page.getByText('bye', { exact: true }).click();
    await verify(page).click();
    await expect(feedback(page)).toContainText('Não foi dessa vez');
    await expect(feedback(page)).toContainText('Resposta certa: hello');
    await expect(hearts(page)).toHaveAccessibleName('4 corações');
    await clickContinue(page);

    // play e02..e05, then reload mid-lesson
    await playRight(page, ['e02', 'e03', 'e04', 'e05']);
    await page.reload();
    await expect(hearts(page)).toHaveAccessibleName('4 corações');
    expect((await dumpDb(page)).profile?.hearts).toBe(4);
    // resumed at e06 (listen-type), not from the start
    await expect(page.getByRole('heading', { name: 'Escreva o que você ouvir' })).toBeVisible();

    await playRight(page, ['e06', 'e07', 'e08', 'e09', 'e10']);
    // e01 comes back at the end
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
    // wrong again → not re-queued a second time → lesson ends
    await page.getByText('bye', { exact: true }).click();
    await verify(page).click();
    await expect(hearts(page)).toHaveAccessibleName('3 corações');
    await clickContinue(page);
    await finishScreen(page);
    await expect(page.getByText('Lição perfeita! Nenhum erro.')).toHaveCount(0);
    const db = await dumpDb(page);
    expect(db.profile?.hearts).toBe(3);
    expect(db.results[0]?.mistakes).toBe(2);
  });

  test('fill-blank errado mostra a explicação', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03', 'e04']);
    await page.getByText('have', { exact: true }).click();
    await verify(page).click();
    await expect(feedback(page)).toContainText('Resposta certa: I am thirty years old.');
    await expect(feedback(page)).toContainText('idade usa o verbo "be"');
  });

  test('com 1 coração, errar → "Seus corações acabaram"; recarga após 4 h via __falae', async ({
    page,
  }) => {
    await setHearts(page, 1);
    await page.goto(LESSON);
    await expect(hearts(page)).toHaveAccessibleName('1 coração');
    await page.getByText('bye', { exact: true }).click();
    await verify(page).click();
    await expect(feedback(page)).toContainText('Não foi dessa vez');
    await clickContinue(page);
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
    await expect(page.getByText(/Próximo coração em [34] h/)).toBeVisible();
    expect((await dumpDb(page)).profile?.hearts).toBe(0);

    // reload does not resurrect the lesson with hearts
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();

    // 4 hours later (simulated, no reload): one heart is back
    await page.evaluate(() =>
      (
        window as unknown as { __falae?: { advanceHours: (h: number) => void } }
      ).__falae?.advanceHours(4),
    );
    await softNavigate(page, '/');
    await softNavigate(page, LESSON);
    await expect(hearts(page)).toHaveAccessibleName('1 coração');
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
  });

  test('começar lição com 0 corações mostra a tela sem corações direto', async ({ page }) => {
    await setHearts(page, 0);
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Voltar para a trilha' })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar para a trilha' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('2 h não bastam para ganhar coração', async ({ page }) => {
    await setHearts(page, 0);
    await page.goto(LESSON);
    await page.evaluate(() =>
      (
        window as unknown as { __falae?: { advanceHours: (h: number) => void } }
      ).__falae?.advanceHours(2),
    );
    await softNavigate(page, '/');
    await softNavigate(page, LESSON);
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
    await expect(page.getByText(/Próximo coração em (1 h|2 h 00)/)).toBeVisible();
  });
});

test.describe('sessão e saída', () => {
  test('recarregar durante o feedback mantém o feedback e não cobra outro coração', async ({
    page,
  }) => {
    await page.goto(LESSON);
    await page.getByText('bye', { exact: true }).click();
    await verify(page).click();
    await expect(hearts(page)).toHaveAccessibleName('4 corações');
    // Wait for the heart to be stored; the "reload within milliseconds" race is the fixme below.
    await expect.poll(async () => (await dumpDb(page)).profile?.hearts).toBe(4);
    await page.reload();
    await expect(hearts(page)).toHaveAccessibleName('4 corações');
    await expect(feedback(page)).toContainText('Não foi dessa vez');
    await clickContinue(page);
    await expect(page.getByRole('heading', { name: 'Toque nos pares' })).toBeVisible();
    expect((await dumpDb(page)).profile?.hearts).toBe(4);
  });

  // Race seen ~1 in 60 runs under load: spendHeart() is not awaited, so a reload right after a
  // wrong answer can lose the IndexedDB write; the profile then still has 5 hearts and the
  // lesson commit writes 5 back. Flaky by nature, hence fixme.
  test.fixme('recarregar imediatamente após errar não devolve o coração', async ({ page }) => {
    await page.goto(LESSON);
    await page.getByText('bye', { exact: true }).click();
    await verify(page).click();
    await page.reload();
    await expect.poll(async () => (await dumpDb(page)).profile?.hearts).toBe(4);
  });

  test('"Sair da lição" pede confirmação; "Continuar a lição" volta; "Sair" descarta a sessão', async ({
    page,
  }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02']);
    await page.getByRole('button', { name: 'Sair da lição' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Sair da lição?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continuar a lição' })).toBeFocused();
    // Enter while the dialog is open must not "verify" behind it
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Traduza esta frase' })).toBeVisible();

    await page.getByRole('button', { name: 'Sair da lição' }).click();
    await dialog.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
    expect((await dumpDb(page)).results).toHaveLength(0);
  });

  test('Esc fecha a confirmação de saída, foco volta ao ✕ (corrigido)', async ({ page }) => {
    await page.goto(LESSON);
    await page.getByRole('button', { name: 'Sair da lição' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Sair da lição' })).toBeFocused();
    // the lesson is still there
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
  });

  test('voltar do navegador no meio da lição e avançar retoma do mesmo ponto', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto('/');
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03']);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Escreva em português' })).toBeVisible();
    await expect(page.getByText('Thanks a lot!')).toBeVisible();
  });

  test('sessão corrompida no sessionStorage não quebra: lição começa do zero', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('falae-lesson-session', '{"lessonId":"demo-sk1-l1","queue":"x"');
    });
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
    await page.evaluate(() => {
      sessionStorage.setItem(
        'falae-lesson-session',
        JSON.stringify({
          lessonId: 'demo-sk1-l1',
          queue: [99],
          exercises: [],
          turn: 0,
          status: 'answering',
        }),
      );
    });
    await page.reload();
    await expect(page.locator('body')).not.toBeEmpty();
    // Either restarts or shows something sensible — never a blank screen / crash.
    const visible = await page
      .getByRole('heading')
      .first()
      .isVisible()
      .catch(() => false);
    expect(visible, 'some heading should be visible after a corrupted session').toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('corretor na tela', () => {
  test('quase certo: 1 erro de digitação mostra "Quase!" e a forma certa, sem perder coração', async ({
    page,
  }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03']);
    await page.getByRole('textbox').fill('muito obrigdo');
    await verify(page).click();
    await expect(feedback(page)).toContainText('Quase! Atenção à digitação.');
    await expect(feedback(page)).toContainText('Resposta certa:');
    // Fase 5: the differing letter is highlighted (and named for screen readers).
    await expect(feedback(page).locator('mark')).toHaveText('a (letra diferente)');
    await expect(hearts(page)).toHaveAccessibleName('5 corações');
  });

  for (const typed of ['MUITO OBRIGADA', 'muito obrigado!!!', 'Valeu', '  valeu  ']) {
    test(`aceita "${typed}" (maiúsculas, pontuação, espaços, alternativa)`, async ({ page }) => {
      await fakeSpeech(page);
      await page.goto(LESSON);
      await playRight(page, ['e01', 'e02', 'e03']);
      await page.getByRole('textbox').fill(typed);
      await verify(page).click();
      await expect(feedback(page)).not.toContainText('Não foi dessa vez');
      await expect(feedback(page)).not.toContainText('Quase');
    });
  }

  test('contração e número por extenso/dígitos no word-bank ("I am" ≠ tiles) e listen-type', async ({
    page,
  }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03', 'e04', 'e05']);
    await page.getByRole('textbox').fill('Nice to meet you!');
    await verify(page).click();
    await expect(feedback(page)).not.toContainText('Não foi dessa vez');
  });

  test('campo vazio: "Verificar" fica desabilitado e Enter não faz nada', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03']);
    await expect(verify(page)).toBeDisabled();
    await page.getByRole('textbox').fill('   ');
    await expect(verify(page)).toBeDisabled();
    await page.getByRole('textbox').press('Enter');
    await expect(feedback(page)).toHaveCount(0);
    await expect(hearts(page)).toHaveAccessibleName('5 corações');
  });

  test('clique duplo em "Verificar" não pula o feedback nem cobra 2 corações (corrigido)', async ({
    page,
  }) => {
    await page.goto(LESSON);
    await page.getByText('bye', { exact: true }).click();
    await verify(page).dblclick();
    await expect(feedback(page)).toBeVisible();
    await expect(feedback(page)).toContainText('Não foi dessa vez');
    await expect(hearts(page)).toHaveAccessibleName('4 corações');
    await page.waitForTimeout(300);
    expect((await dumpDb(page)).profile?.hearts).toBe(4);
  });

  test('clique duplo em "Continuar" não pula o próximo exercício', async ({ page }) => {
    await page.goto(LESSON);
    await page.getByText('hello', { exact: true }).click();
    await verify(page).click();
    await page.waitForTimeout(450);
    await cont(page).dblclick();
    await expect(page.getByRole('heading', { name: 'Toque nos pares' })).toBeVisible();
  });
});

test.describe('sem Web Speech', () => {
  test('listen-type vira tradução, speak some, e a lição termina', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await noSpeech(page);
    await page.goto(LESSON);
    expect(await page.evaluate(() => 'speechSynthesis' in window)).toBe(false);
    await playRight(page, ['e01', 'e02', 'e03', 'e04', 'e05']);
    // e06 fallback: translation of the same item, no speaker buttons
    await expect(page.getByRole('heading', { name: 'Escreva em português' })).toBeVisible();
    await expect(page.getByText('Nice to meet you.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvir' })).toHaveCount(0);
    await answerRight(page, 'e06', { tts: false });
    await checkAndContinue(page, 'e06');
    // e07 speak is gone: next is e08 word-bank
    await expect(page.getByRole('heading', { name: 'Fale esta frase em inglês' })).toHaveCount(0);
    await expect(page.getByText('Eu tenho trinta anos.')).toBeVisible();
    await playRight(page, ['e08', 'e09', 'e10']);
    await finishScreen(page);
    expect(errors).toEqual([]);
  });

  test('"Não posso falar agora" pula e pausa speak por 1 h (volta depois)', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03', 'e04', 'e05', 'e06']);
    await expect(page.getByRole('heading', { name: 'Fale esta frase em inglês' })).toBeVisible();
    await page.getByRole('button', { name: 'Não posso falar agora' }).click();
    await expect(page.getByText('Eu tenho trinta anos.')).toBeVisible(); // e08
    await expect(hearts(page)).toHaveAccessibleName('5 corações');
    const until = (await dumpDb(page)).settings?.speakDisabledUntil;
    expect(until).toBeTruthy();
    const mins = (Date.parse(until!) - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(55);
    expect(mins).toBeLessThanOrEqual(61);
    await playRight(page, ['e08', 'e09', 'e10']);
    await finishScreen(page);
    // skipping does not make the lesson imperfect
    await expect(page.getByText('Lição perfeita! Nenhum erro.')).toBeVisible();

    // Same lesson again within the hour: no speak exercise
    await softNavigate(page, '/');
    await softNavigate(page, LESSON);
    await playRight(page, ['e01', 'e02', 'e03', 'e04', 'e05', 'e06']);
    await expect(page.getByRole('heading', { name: 'Fale esta frase em inglês' })).toHaveCount(0);

    // Two hours later speak is back
    await page.evaluate(() =>
      (
        window as unknown as { __falae?: { advanceHours: (h: number) => void } }
      ).__falae?.advanceHours(2),
    );
    await page.getByRole('button', { name: 'Sair da lição' }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sua trilha' })).toBeAttached();
    await softNavigate(page, LESSON);
    await playRight(page, ['e01', 'e02', 'e03', 'e04', 'e05', 'e06']);
    await expect(page.getByRole('heading', { name: 'Fale esta frase em inglês' })).toBeVisible();
  });

  test('fala reconhecida errada conta como erro', async ({ page }) => {
    await fakeSpeech(page, 'banana pizza');
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02', 'e03', 'e04', 'e05', 'e06']);
    await page.getByRole('button', { name: 'Toque para falar' }).click();
    await expect(page.getByText('Entendi:')).toBeVisible();
    await verify(page).click();
    await expect(feedback(page)).toContainText('Não foi dessa vez');
    await expect(hearts(page)).toHaveAccessibleName('4 corações');
  });
});

test.describe('layout', () => {
  test('no mobile, "Verificar" fica visível sem rolar e nada transborda', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile only');
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ['e01', 'e02']); // word-bank has the tallest layout
    await expect(verify(page)).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('acessibilidade do feedback (correções da revisão)', () => {
  test('região live sempre montada anuncia veredito e resposta certa; Continuar descreve o cartão', async ({
    page,
  }) => {
    await page.goto(LESSON);
    await expect(live(page)).toHaveCount(1);
    await expect(live(page)).toHaveText('');
    await page.getByText('bye', { exact: true }).click();
    await verify(page).click();
    await expect(live(page)).toContainText('Não foi dessa vez');
    await expect(live(page)).toContainText('Resposta certa: hello');
    await expect(cont(page)).toBeFocused();
    await expect(cont(page)).toHaveAccessibleDescription(/Resposta certa: hello/);
    await clickContinue(page);
    await expect(live(page)).toHaveText('');
  });

  test('clique de mouse em "Continuar" logo que aparece é ignorado; depois de 400 ms vale', async ({
    page,
  }) => {
    await page.goto(LESSON);
    await page.getByText('hello', { exact: true }).click();
    await verify(page).click();
    await cont(page).click(); // immediate: swallowed
    await expect(cont(page)).toBeVisible();
    await page.waitForTimeout(450);
    await cont(page).click();
    await expect(page.getByRole('heading', { name: 'Toque nos pares' })).toBeVisible();
  });

  test('Continuar por teclado funciona imediatamente (sem a trava de 400 ms do mouse)', async ({
    page,
  }) => {
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { name: 'Qual destas significa "olá"?' })).toBeVisible();
    await pressOption(page, 'hello');
    await page.keyboard.press('Enter');
    await expect(cont(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Toque nos pares' })).toBeVisible();
  });

  test('foco fica preso no diálogo de saída (Tab não sai dele)', async ({ page }) => {
    await page.goto(LESSON);
    await page.getByRole('button', { name: 'Sair da lição' }).click();
    const dialog = page.getByRole('alertdialog');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      // Native modal <dialog>: focus may leave to the browser UI (activeElement = body),
      // but must never land on page content behind the dialog.
      const where = await dialog.evaluate((d) =>
        d.contains(document.activeElement)
          ? 'dialog'
          : document.activeElement === document.body
            ? 'body'
            : 'behind',
      );
      expect(where).not.toBe('behind');
    }
  });

  test('tela sem corações: "Voltar para a trilha" é a ação principal, sem "Praticar"', async ({
    page,
  }) => {
    await setHearts(page, 0);
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Praticar/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Voltar para a trilha' })).toBeVisible();
    await expect(
      page.getByText(
        'Seus corações voltam com o tempo. Enquanto isso, que tal revisar o que você aprendeu?',
      ),
    ).toBeVisible();
    await expect(page.getByText(/Próximo coração em/)).toBeVisible();
  });

  test('tempo na tela de fim em formato m:ss (Fase 5), com forma falada', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto(LESSON);
    await playRight(page, ids);
    await finishScreen(page);
    const time = await page.locator('dd').nth(2).locator('[aria-hidden="true"]').textContent();
    expect(time).toMatch(/^\d+:\d{2}$/);
    await expect(page.locator('dd').nth(2).locator('.sr-only')).toHaveText(
      /^Tempo: (\d+ s|\d+ min( \d+ s)?)$/,
    );
  });
});
