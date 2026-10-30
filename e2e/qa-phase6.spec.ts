import { expect, test, type Page } from '@playwright/test';
import { answer, noRecognition, pressOption, type Ex } from './helpers/playLesson';
import { seed, startAt } from './helpers/seed';
import { playPractice } from './helpers/session';

/** QA edge cases (Fase 6): trying to break import/reset, placement, practice, onboarding, focus, offline. */

const DAY = '2026-10-29';
const fresh = { storageState: { cookies: [], origins: [] } };
const STORES = ['profile', 'settings', 'lessonProgress', 'results', 'srs', 'daily', 'achievements'];

type Db = Record<string, unknown[]>;
function dumpAll(page: Page): Promise<Db> {
  return page.evaluate(
    (stores) =>
      new Promise<Db>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = stores.filter((s) => db.objectStoreNames.contains(s));
          const tx = db.transaction(names);
          const out: Db = {};
          void Promise.all(
            names.map(
              (s) =>
                new Promise<void>((res) => {
                  const r = tx.objectStore(s).getAll();
                  r.onsuccess = () => {
                    out[s] = r.result as unknown[];
                    res();
                  };
                }),
            ),
          ).then(() => {
            db.close();
            resolve(out);
          });
        };
      }),
    STORES,
  );
}
type Profile = {
  totalXp: number;
  hearts: number;
  onboardingDone: boolean;
  streak: { current: number };
  placement?: unknown;
};
const profileOf = async (page: Page) => (await dumpAll(page)).profile?.[0] as Profile | undefined;

const card = (itemId: string, dueDay = DAY) => ({
  itemId,
  ease: 2.5,
  intervalDays: 1,
  reps: 1,
  lapses: 0,
  dueDay,
  lastReviewDay: '2026-10-28',
});
const unit1Cards = [
  'u1-hi',
  'u1-bye',
  'u1-good-morning',
  'u1-good-afternoon',
  'u1-s-good-morning-ana',
];

type SessionState = { exercises: Ex[]; queue: number[]; status: string; turn: number };
const session = (page: Page) =>
  page.evaluate(() => {
    const raw = sessionStorage.getItem('falae-lesson-session');
    return raw ? (JSON.parse(raw) as { state: SessionState }).state : null;
  });
async function currentEx(page: Page) {
  let found: { ex: Ex; turn: number } | null = null;
  await expect
    .poll(async () => {
      const s = await session(page);
      const ex = s && s.status === 'answering' ? s.exercises[s.queue[0] ?? -1] : undefined;
      found = ex && s ? { ex, turn: s.turn } : null;
      return found !== null;
    })
    .toBe(true);
  return found as unknown as { ex: Ex; turn: number }; // assigned in the poll
}
async function answerWrong(page: Page, ex: Ex) {
  if (ex.type === 'multiple-choice' || ex.type === 'fill-blank') {
    const opts = (ex.options ?? []).map((o) =>
      typeof o === 'string' ? o : (o as { text: string }).text,
    );
    return pressOption(
      page,
      opts.find((o) => o.toLowerCase() !== (ex.answer ?? '').toLowerCase()) ?? '',
    );
  }
  if (ex.type === 'word-bank')
    return page
      .getByRole('button', { name: `Adicionar "${ex.distractors?.[0] ?? ''}"`, exact: true })
      .first()
      .click();
  return page.getByRole('textbox').fill('zzz qqq');
}
/** Answers the first `rightCount` placement questions right and the rest wrong. */
async function placementWith(page: Page, rightCount: number, reloadAt?: number) {
  await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
  for (let i = 0; i < 20; i++) {
    if (await page.getByRole('button', { name: 'Ir para a trilha' }).isVisible()) break;
    if (reloadAt === i) {
      const before = await session(page);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
      const after = await session(page);
      expect(after?.turn).toBe(before?.turn);
      expect(after?.exercises.map((e) => e.id)).toEqual(before?.exercises.map((e) => e.id));
    }
    const { ex, turn } = await currentEx(page);
    if (i < rightCount) await answer(page, ex);
    else await answerWrong(page, ex);
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect.poll(async () => (await session(page))?.turn ?? turn + 1).not.toBe(turn);
  }
  await expect(page.getByRole('button', { name: 'Ir para a trilha' })).toBeEnabled();
}

const importFile = (page: Page, name: string, body: string) =>
  page
    .getByLabel('Importar progresso')
    .setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });

test.beforeEach(async ({ page }) => {
  await noRecognition(page);
});

test.describe('importar — arquivos ruins não mudam nada', () => {
  test('corrompido, outro app, versão nova, versão velha, campos inválidos, vazio', async ({
    page,
  }) => {
    await seed(page, {
      profile: { totalXp: 77, streak: { current: 2, longest: 4, freezes: 1, xpTowardFreeze: 0 } },
      lessonProgress: [{ lessonId: 'u1-sk1-l1' }],
      srs: [card('u1-hi')],
      daily: [{ day: DAY, xp: 10, lessons: 1, goalMet: false }],
    });
    await page.goto('/config');
    const before = await dumpAll(page);
    const exported = JSON.stringify({ app: 'falae', schemaVersion: 1, exportedAt: 'x', data: {} });
    const cases: [string, string, RegExp][] = [
      ['a.json', '{"app":"falae", "data":', /não é um JSON válido/],
      ['b.json', '', /não é um JSON válido/],
      ['c.json', JSON.stringify({ app: 'other', schemaVersion: 1 }), /não é um progresso do Falaê/],
      ['d.json', JSON.stringify([1, 2]), /não é um progresso do Falaê/],
      ['e.json', JSON.stringify({ app: 'falae', schemaVersion: 2, data: {} }), /versão mais nova/],
      ['f.json', JSON.stringify({ app: 'falae', schemaVersion: 0, data: {} }), /inválido/],
      ['g.json', exported, /inválido/],
    ];
    for (const [name, body, msg] of cases) {
      await importFile(page, name, body);
      await expect(page.getByText(msg).first()).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(await dumpAll(page)).toEqual(before);
  });

  test('arquivo > 5 MB é recusado sem ler', async ({ page }) => {
    await page.goto('/config');
    const before = await dumpAll(page);
    await importFile(page, 'big.json', ' '.repeat(5 * 1024 * 1024 + 10));
    await expect(page.getByText(/grande demais/)).toBeVisible();
    expect(await dumpAll(page)).toEqual(before);
  });

  test('cancelar o diálogo (Esc) não muda nada e devolve o foco', async ({ page }) => {
    await seed(page, { profile: { totalXp: 30 } });
    await page.goto('/config');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar progresso' }).click(),
    ]);
    const text = JSON.parse(
      await (await import('node:fs/promises')).readFile((await download.path()) ?? '', 'utf8'),
    ) as {
      data: { profile: { totalXp: number } };
    };
    text.data.profile.totalXp = 999;
    const before = await dumpAll(page);
    await importFile(page, 'x.json', JSON.stringify(text));
    const dialog = page.getByRole('dialog', { name: 'Substituir seu progresso?' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"], dialog[open]'),
        ),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await dumpAll(page)).toEqual(before);
  });
});

test.describe('importar com tema diferente', () => {
  test('backup com tema escuro aplica o tema na hora', async ({ page }) => {
    await seed(page, { settings: { theme: 'light' }, profile: { totalXp: 10 } });
    await page.goto('/config');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    const file = {
      app: 'falae',
      schemaVersion: 1,
      exportedAt: '2026-10-20T12:00:00.000Z',
      data: {
        profile: {
          id: 'me',
          createdAt: '2026-01-01T12:00:00.000Z',
          onboardingDone: true,
          totalXp: 200,
          hearts: 5,
          heartsUpdatedAt: '2026-10-20T12:00:00.000Z',
          streak: { current: 0, longest: 3, freezes: 0, xpTowardFreeze: 0 },
        },
        settings: {
          id: 'me',
          dailyGoalXp: 50,
          sound: false,
          haptics: false,
          theme: 'dark',
          reminder: { enabled: false, time: '19:00' },
        },
        lessonProgress: [],
        results: [],
        srs: [],
        daily: [],
        achievements: [],
      },
    };
    await importFile(page, 'dark.json', JSON.stringify(file));
    await page.getByRole('button', { name: 'Substituir meu progresso' }).click();
    await expect(page.getByText('Progresso restaurado.')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('label', { hasText: 'Escuro' }).locator('input')).toBeChecked();
    await expect(page.locator('label', { hasText: '50 XP' }).locator('input')).toBeChecked();
  });
});

test.describe('redefinir', () => {
  test.use(fresh);

  test('APAGAR com variações; reset volta ao onboarding e limpa sessão/tema', async ({ page }) => {
    await seed(page, {
      profile: { totalXp: 40 },
      settings: { theme: 'dark' },
      srs: unit1Cards.map((i) => card(i)),
    });
    await page.goto('/praticar/sessao');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    await page.goto('/config');
    await page.getByRole('button', { name: 'Apagar todo o progresso' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    const input = page.getByLabel('Digite APAGAR para confirmar');
    const final = page.getByRole('button', { name: 'Apagar tudo' });
    for (const wrong of ['', 'APAGA', 'apagar tudo', 'DELETE']) {
      await input.fill(wrong);
      await expect(final).toBeDisabled();
    }
    for (const ok of ['APAGAR', 'Apagar', ' apagar ']) {
      await input.fill(ok);
      await expect(final, `"${ok}"`).toBeEnabled();
    }
    await input.fill('apagar');
    await final.click();
    await expect(page).toHaveURL(/\/boas-vindas$/);
    expect(await page.evaluate(() => sessionStorage.getItem('falae-lesson-session'))).toBeNull();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    // Any app route now sends to onboarding.
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await page.goto('/praticar/sessao');
    await expect(page).toHaveURL(/\/boas-vindas$/);
  });
});

test.describe('onboarding — usuário vindo da Fase 5', () => {
  test.use(fresh);

  test('onboardingDone=false com XP não vê boas-vindas e nada é gravado', async ({ page }) => {
    await seed(page, { profile: { onboardingDone: false, totalXp: 35 } });
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/boas-vindas');
    await expect(page).toHaveURL(/\/$/);
    expect((await profileOf(page))?.onboardingDone).toBe(false);
  });

  test('onboardingDone=false com lição concluída e 0 XP não vê boas-vindas', async ({ page }) => {
    await seed(page, {
      profile: { onboardingDone: false, totalXp: 0 },
      lessonProgress: [{ lessonId: 'u1-sk1-l1' }],
    });
    await page.goto('/praticar');
    await expect(page).toHaveURL(/\/praticar$/);
  });

  test('recarregar no meio do onboarding e voltar do navegador', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.reload();
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Sou iniciante' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/boas-vindas$/);
  });
});

test.describe('nivelamento', () => {
  test.use(fresh);

  test('80% exato (12/15) aprova; não muda ofensiva, meta, daily nem XP; recarregar no meio mantém', async ({
    page,
  }) => {
    await startAt(page, `${DAY}T12:00:00`);
    await seed(page, {
      profile: {
        onboardingDone: false,
        totalXp: 0,
        streak: { current: 0, longest: 5, freezes: 1, xpTowardFreeze: 3 },
      },
      settings: { dailyGoalXp: 30 },
    });
    await page.goto('/nivelamento');
    const before = await profileOf(page);
    await placementWith(page, 12, 5);
    await expect(page.getByText('Você acertou 12 de 15')).toBeVisible();
    await expect(page.getByText(/unidade 2 já está liberada/)).toBeVisible();
    const db = await dumpAll(page);
    const p = db.profile?.[0] as Profile & { streak: unknown };
    expect(p.placement).toEqual({ score: 0.8, skippedUnit1: true });
    expect(p.totalXp).toBe(0);
    expect(p.streak).toEqual(before?.streak);
    expect(db.daily).toEqual([]);
    expect((db.settings?.[0] as { dailyGoalXp: number }).dailyGoalXp).toBe(30);
    expect(db.srs?.length ?? 0).toBeGreaterThan(0);
  });

  test('79% (11/15) reprova e não cria cards', async ({ page }) => {
    await page.goto('/nivelamento');
    await placementWith(page, 11);
    await expect(page.getByText('Você acertou 11 de 15')).toBeVisible();
    await expect(page.getByText(/Vamos começar do início/)).toBeVisible();
    const db = await dumpAll(page);
    expect((db.profile?.[0] as Profile).placement).toEqual({ score: 11 / 15, skippedUnit1: false });
    expect(db.srs).toEqual([]);
  });

  test('sem feedback visível durante o teste e clique duplo em Confirmar não pula questão', async ({
    page,
  }) => {
    await page.goto('/nivelamento');
    const { ex, turn } = await currentEx(page);
    await answer(page, ex);
    await page.getByRole('button', { name: 'Confirmar' }).dblclick();
    await expect.poll(async () => (await session(page))?.turn).toBe(turn + 1);
    await expect(page.getByText(/Correto|Incorreto|Resposta certa/)).toHaveCount(0);
  });
});

test.describe('praticar — bordas', () => {
  test('cards futuros: nada vencido; depois de 3 dias simulados vencem', async ({ page }) => {
    await startAt(page, `${DAY}T12:00:00`);
    await seed(page, { srs: unit1Cards.map((i) => card(i, '2026-11-01')) });
    await page.goto('/praticar');
    await expect(page.getByText('Tudo em dia! Quer reforçar mesmo assim?')).toBeVisible();
    await page.evaluate(() =>
      (window as unknown as { __falae: { advanceDays: (d: number) => void } }).__falae.advanceDays(
        3,
      ),
    );
    await page.goto('/praticar');
    await expect(page.getByText('Você tem 5 palavras e frases para revisar hoje')).toBeVisible();
  });

  test('praticar sem cards (com 5 corações) funciona com reserva e não passa de 5', async ({
    page,
  }) => {
    await seed(page, {});
    await page.goto('/praticar');
    await expect(page.getByRole('link', { name: 'Começar a praticar' })).toBeVisible();
    await page.getByRole('link', { name: 'Começar a praticar' }).click();
    await playPractice(page);
    await expect(page.getByText('+1 coração')).toHaveCount(0);
    expect((await profileOf(page))?.hearts).toBe(5);
  });

  test('voltar do navegador no meio da prática não grava nada', async ({ page }) => {
    await seed(page, {
      profile: { hearts: 2, heartsUpdatedAt: new Date().toISOString() },
      srs: unit1Cards.map((i) => card(i)),
    });
    await page.goto('/praticar');
    await page.getByRole('link', { name: 'Começar a praticar' }).click();
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    await page.goBack();
    await page.waitForTimeout(300);
    const db = await dumpAll(page);
    expect(db.results).toEqual([]);
    expect((db.profile?.[0] as Profile).hearts).toBe(2);
  });

  test('offline: perfil, ajustes e prática continuam funcionando', async ({ page, context }) => {
    await seed(page, { srs: unit1Cards.map((i) => card(i)) });
    await page.goto('/perfil');
    await page.goto('/config');
    await page.goto('/praticar');
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
      timeout: 15_000,
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Praticar' })).toBeVisible();
    await page.getByRole('link', { name: 'Começar a praticar' }).click();
    await playPractice(page);
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('teclado — diálogo de redefinir passo 2', () => {
  test('foco preso no passo 2 e Esc cancela sem apagar', async ({ page }) => {
    await seed(page, { profile: { totalXp: 12 } });
    await page.goto('/config');
    await page.getByRole('button', { name: 'Apagar todo o progresso' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Digite APAGAR para confirmar')).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"], dialog[open]'),
        ),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Apagar todo o progresso' })).toBeFocused();
    expect((await profileOf(page))?.totalXp).toBe(12);
  });
});
