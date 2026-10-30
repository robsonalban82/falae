import { expect, test, type Page } from '@playwright/test';
import { noRecognition, playLesson } from './helpers/playLesson';
import { notificationPermission, seed, startAt } from './helpers/seed';
import { playPlacement, playPractice } from './helpers/session';

/** QA (Fase 6): practice, onboarding/placement, profile, settings, backup and reminder. */

const DAY = '2026-10-29';
const fresh = { storageState: { cookies: [], origins: [] } };

type Dump = {
  profile?: { totalXp: number; hearts: number; onboardingDone: boolean; placement?: unknown };
  settings?: { dailyGoalXp: number; reminder: { enabled: boolean; time: string } };
  srs: unknown[];
  results: { kind: string; xp: number }[];
  daily: unknown[];
};

function dump(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['profile', 'settings', 'srs', 'results', 'daily']);
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
            get('settings', 'me'),
            get('srs'),
            get('results'),
            get('daily'),
          ]).then(() => {
            db.close();
            resolve(out as Dump);
          });
        };
      }),
  );
}

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

test.beforeEach(async ({ page }) => {
  await noRecognition(page);
});

test.describe('boas-vindas e nivelamento', () => {
  test.use(fresh);

  test('usuário novo → boas-vindas → 10 XP → iniciante → trilha; recarregar não volta', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await expect(page.getByText('Passo 1 de 3')).toBeVisible();
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.getByRole('heading', { name: 'Qual é a sua meta diária?' })).toBeFocused();
    await page.locator('label').filter({ hasText: 'Casual' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Passo 3 de 3')).toBeVisible();
    await page.getByRole('button', { name: 'Sou iniciante' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('img', { name: 'Meta diária: 0 de 10 XP' })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    const db = await dump(page);
    expect(db.profile?.onboardingDone).toBe(true);
    expect(db.settings?.dailyGoalXp).toBe(10);
  });

  test('"Voltar" volta um passo e nenhuma permissão é pedida', async ({ page }) => {
    await page.goto('/boas-vindas');
    await notificationPermission(page, 'default'); // a request would turn the stub into 'granted'
    await page.reload();
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Passo 1 de 3')).toBeVisible();
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Sou iniciante' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => Notification.permission)).toBe('default');
  });

  test('nivelamento acertando tudo → aprovado → u1 testada, u2 atual; perfil com palavras, sem ofensiva', async ({
    page,
  }) => {
    await startAt(page, `${DAY}T12:00:00`);
    await page.goto('/boas-vindas');
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /fazer teste de nível/ }).click();
    await expect(page).toHaveURL(/\/nivelamento$/);
    await expect(page.getByText('1 de 15')).toBeVisible();
    await playPlacement(page, true);
    await expect(page.getByText('Você acertou 15 de 15')).toBeVisible();
    await expect(page.getByText(/unidade 2 já está liberada/)).toBeVisible();
    await page.getByRole('button', { name: 'Ir para a trilha' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /atual$/ })).toHaveAttribute(
      'href',
      '/licao/u2-sk1-l1',
    );
    const db = await dump(page);
    expect(db.profile?.placement).toEqual({ score: 1, skippedUnit1: true });
    expect(db.srs.length).toBeGreaterThan(0);
    expect(db.daily).toEqual([]);
    await page.getByRole('link', { name: 'Perfil' }).click();
    const words = page.locator('dt', { hasText: 'Palavras aprendidas' }).locator('+ dd');
    await expect(words).not.toHaveText('0');
    await expect(page.locator('dt', { hasText: 'Ofensiva atual' }).locator('+ dd')).toHaveText(
      '0 dias',
    );
    await expect(page.getByText('Sem XP nesta semana ainda')).toBeVisible();
    // Taken once: opening it again goes back to the path.
    await page.goto('/nivelamento');
    await expect(page).toHaveURL(/\/$/);
  });

  test('nivelamento errando tudo → reprovado → trilha no início, nenhum card', async ({ page }) => {
    await page.goto('/nivelamento');
    await playPlacement(page, false);
    await expect(page.getByText(/Vamos começar do início/)).toBeVisible();
    await page.getByRole('button', { name: 'Ir para a trilha' }).click();
    await expect(page.getByRole('link', { name: /atual$/ })).toHaveAttribute(
      'href',
      '/licao/u1-sk1-l1',
    );
    expect((await dump(page)).srs).toEqual([]);
  });

  test('sair do teste só marca o onboarding', async ({ page }) => {
    await page.goto('/nivelamento');
    await page.getByRole('button', { name: 'Sair do teste' }).click();
    await page.getByRole('button', { name: 'Sair do teste' }).last().click();
    await expect(page).toHaveURL(/\/$/);
    const db = await dump(page);
    expect(db.profile?.onboardingDone).toBe(true);
    expect(db.profile?.placement).toBeUndefined();
    expect(db.results).toEqual([]);
  });
});

test.describe('praticar', () => {
  test('lição → +1 dia → itens vencidos → praticar sem corações na tela', async ({ page }) => {
    await startAt(page, `${DAY}T12:00:00`);
    await playLesson(page, 'u1-sk1-l1');
    await page.evaluate(() =>
      (window as unknown as { __falae: { advanceDays: (d: number) => void } }).__falae.advanceDays(
        1,
      ),
    );
    await page.goto('/praticar');
    await expect(
      page.getByText(/Você tem \d+ (palavras e frases|palavra ou frase) para revisar hoje/),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Começar a praticar' }).click();
    await expect(page).toHaveURL(/\/praticar\/sessao$/);
    await expect(page.getByRole('img', { name: /coraç/ })).toHaveCount(0);
    await playPractice(page);
    await expect.poll(async () => (await dump(page)).results.length).toBe(2);
    const saved = (await dump(page)).results.find((r) => r.kind === 'practice');
    expect(saved?.xp).toBeGreaterThanOrEqual(8);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/praticar$/);
  });

  test('recarregar no meio mantém os mesmos exercícios', async ({ page }) => {
    await seed(page, { srs: unit1Cards.map((id) => card(id)) });
    await page.goto('/praticar/sessao');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    const before = await page.evaluate(() => sessionStorage.getItem('falae-lesson-session'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    const after = await page.evaluate(() => sessionStorage.getItem('falae-lesson-session'));
    expect(JSON.parse(after ?? '{}').state.exercises).toEqual(
      JSON.parse(before ?? '{}').state.exercises,
    );
  });

  test('sem corações → "Praticar e ganhar coração" → +1 coração e "Persistente"', async ({
    page,
  }) => {
    await seed(page, {
      profile: { hearts: 0, heartsUpdatedAt: new Date().toISOString() },
      srs: unit1Cards.map((id) => card(id)),
    });
    await page.goto('/licao/u1-sk1-l1');
    await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
    await page.getByRole('link', { name: 'Praticar e ganhar coração' }).click();
    await expect(page).toHaveURL(/\/praticar\/sessao\?from=outOfHearts$/);
    await playPractice(page);
    await expect(page.getByText('+1 coração')).toBeVisible();
    await expect(page.locator('li', { hasText: 'Persistente' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('img', { name: '1 coração' })).toBeVisible();
  });

  test('sem corações na primeira lição (sem cards) → prática com itens de reserva', async ({
    page,
  }) => {
    await seed(page, { profile: { hearts: 0, heartsUpdatedAt: new Date().toISOString() } });
    await page.goto('/praticar');
    await expect(page.getByText('Tudo em dia! Quer reforçar mesmo assim?')).toBeVisible();
    await page.goto('/licao/u1-sk1-l1');
    await page.getByRole('link', { name: 'Praticar e ganhar coração' }).click();
    await playPractice(page);
    await expect(page.getByText('+1 coração')).toBeVisible();
    expect((await dump(page)).profile?.hearts).toBe(1);
  });

  test('abandonar a prática não dá coração nem XP', async ({ page }) => {
    await seed(page, {
      profile: { hearts: 2, heartsUpdatedAt: new Date().toISOString() },
      srs: unit1Cards.map((id) => card(id)),
    });
    await page.goto('/praticar/sessao');
    await page.getByRole('button', { name: 'Sair da prática' }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/praticar$/);
    const db = await dump(page);
    expect(db.profile?.hearts).toBe(2);
    expect(db.results).toEqual([]);
  });
});

test.describe('backup e redefinição', () => {
  test.use(fresh);

  test('exportar → redefinir (dupla confirmação) → boas-vindas → importar → progresso igual', async ({
    page,
  }) => {
    await seed(page, { profile: { totalXp: 120 }, lessonProgress: [{ lessonId: 'u1-sk1-l1' }] });
    await page.goto('/config');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar progresso' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^falae-progresso-\d{4}-\d{2}-\d{2}\.json$/);
    const file = await download.path();
    await expect(page.getByRole('status').filter({ hasText: /salvo/ })).toBeVisible();

    await page.getByRole('button', { name: 'Apagar todo o progresso' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    const finalButton = page.getByRole('button', { name: 'Apagar tudo' });
    await expect(finalButton).toBeDisabled();
    await page.getByLabel('Digite APAGAR para confirmar').fill('apagar');
    await expect(finalButton).toBeEnabled();
    await finalButton.click();
    await expect(page).toHaveURL(/\/boas-vindas$/);
    expect((await dump(page)).profile).toBeUndefined();

    // Back through onboarding, then restore.
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Sou iniciante' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/config');
    await page.getByLabel('Importar progresso').setInputFiles(file);
    await expect(page.getByRole('dialog', { name: 'Substituir seu progresso?' })).toBeVisible();
    await expect(page.getByText('120 XP', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.getByRole('button', { name: 'Substituir meu progresso' }).click();
    await expect(page.getByText('Progresso restaurado.')).toBeVisible();
    expect((await dump(page)).profile?.totalXp).toBe(120);
  });
});

test.describe('ajustes', () => {
  test('arquivo inválido → mensagem e nada muda', async ({ page }) => {
    await seed(page, { profile: { totalXp: 50 } });
    await page.goto('/config');
    await page.getByLabel('Importar progresso').setInputFiles({
      name: 'ruim.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{oops'),
    });
    await expect(page.getByText('O arquivo não é um JSON válido.')).toBeVisible();
    await page.getByLabel('Importar progresso').setInputFiles({
      name: 'outro.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ app: 'falae', schemaVersion: 9 })),
    });
    await expect(page.getByText(/versão mais nova do Falaê/)).toBeVisible();
    expect((await dump(page)).profile?.totalXp).toBe(50);
  });

  test('lembrete: permissão negada → desligado e aviso', async ({ page }) => {
    await page.goto('/');
    await notificationPermission(page, 'denied');
    await page.goto('/config');
    const sw = page.getByRole('switch', { name: 'Lembrar de estudar' });
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(sw).toBeDisabled();
    await expect(page.getByText(/Permissão negada/)).toBeVisible();
    await expect(page.getByText(/No iPhone, só funciona com o app instalado/)).toBeVisible();
  });

  test('lembrete: permissão concedida → ligado e horário salvo', async ({ page }) => {
    await page.goto('/');
    await notificationPermission(page, 'default');
    await page.goto('/config');
    const sw = page.getByRole('switch', { name: 'Lembrar de estudar' });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await page.getByLabel('Horário do lembrete').fill('07:30');
    await expect
      .poll(async () => (await dump(page)).settings?.reminder)
      .toEqual({
        enabled: true,
        time: '07:30',
      });
    await page.reload();
    await expect(page.getByLabel('Horário do lembrete')).toHaveValue('07:30');
  });

  test('sem suporte a notificações → só o aviso', async ({ page }) => {
    await page.goto('/');
    await notificationPermission(page, 'unsupported');
    await page.goto('/config');
    await expect(page.getByText('Seu navegador não permite lembretes.')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Lembrar de estudar' })).toHaveCount(0);
  });

  test('meta e tema mudam na hora; som/vibração são switches', async ({ page }) => {
    await page.goto('/config');
    await page.locator('label').filter({ hasText: '50 XP' }).click();
    await page.locator('label').filter({ hasText: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect.poll(async () => (await dump(page)).settings?.dailyGoalXp).toBe(50);
    const sound = page.getByRole('switch', { name: 'Som' });
    const before = await sound.getAttribute('aria-checked');
    await sound.click();
    await expect(sound).not.toHaveAttribute('aria-checked', before ?? '');
  });
});

test.describe('teclado e foco', () => {
  test('diálogo de redefinir prende o foco, Esc cancela e o foco volta ao botão', async ({
    page,
  }) => {
    await page.goto('/config');
    const origin = page.getByRole('button', { name: 'Apagar todo o progresso' });
    await origin.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Apagar todo o progresso?' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('dialog[open]'));
      expect(inside).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(origin).toBeFocused();
  });

  test('perfil e ajustes navegáveis só por teclado', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('table')).toBeAttached(); // chart data for screen readers
    await expect(page.getByRole('listitem', { name: /Primeira lição, bloqueada/ })).toBeVisible();
    await page.goto('/config');
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
    const reached = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(
        () =>
          (document.activeElement?.getAttribute('aria-label') ??
            document.activeElement?.textContent ??
            '') +
          `|${document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName}`,
      );
      reached.add(name);
    }
    const all = [...reached].join('\n');
    expect(all).toMatch(/Som\|switch|\|switch/);
    expect(all).toMatch(/Exportar progresso/);
    expect(all).toMatch(/Apagar todo o progresso/);
  });
});
