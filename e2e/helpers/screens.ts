import { expect, type Page } from '@playwright/test';
import { answer, lessonExercises, playLesson, tiles } from './playLesson';
import { notificationPermission, seed } from './seed';
import { playPlacement, playPractice } from './session';
import { coherentBackup } from '../fixtures/backup';

/**
 * Key screens of the app, shared by the UX screenshots (screenshots.spec.ts) and the axe audit
 * (a11y.spec.ts). Each `run` starts on the path with the simulated clock at DAY noon.
 */

export const DAY = '2026-10-29';
export const unit1 = [1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => `u1-sk${s}-l${l}`));
export const progress = (ids: string[]) => ids.map((lessonId) => ({ lessonId }));
export const veteran = {
  totalXp: 340,
  hearts: 3,
  streak: { current: 6, longest: 9, lastActiveDay: DAY, freezes: 1, xpTowardFreeze: 40 },
};

/** Demo lesson: answers e01 (choice) and e02 (pairs), stopping at the word bank (e03). */
export async function demoUpToBank(page: Page) {
  await page.goto('/licao/demo-sk1-l1');
  await page.getByText('hello', { exact: true }).click();
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
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
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

/** Plays a real lesson right up to (not including) exercise `index`. */
export async function playUntil(page: Page, lessonId: string, index: number) {
  await page.goto(`/licao/${lessonId}`);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  for (const ex of lessonExercises(lessonId).slice(0, index)) {
    if (ex.type === 'speak') continue;
    await answer(page, ex);
    if (ex.type !== 'match-pairs') await page.getByRole('button', { name: 'Verificar' }).click();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
}

/** Screens of the first-run flow need a profile that has not been onboarded. */
export async function asNewUser(page: Page) {
  await page.evaluate(() => localStorage.removeItem('falae-e2e-onboarded'));
}

export const card = (itemId: string, dueDay = DAY) => ({
  itemId,
  ease: 2.5,
  intervalDays: 1,
  reps: 1,
  lapses: 0,
  dueDay,
  lastReviewDay: '2026-10-28',
});
export const dueCards = [
  'u1-hi',
  'u1-bye',
  'u1-good-morning',
  'u1-good-afternoon',
  'u1-s-good-morning-ana',
];
const week = [
  { day: '2026-10-23', xp: 25, lessons: 2, goalMet: true },
  { day: '2026-10-24', xp: 10, lessons: 1, goalMet: false },
  { day: '2026-10-26', xp: 40, lessons: 3, goalMet: true },
  { day: '2026-10-27', xp: 20, lessons: 1, goalMet: true },
  { day: '2026-10-28', xp: 15, lessons: 1, goalMet: false },
  { day: DAY, xp: 30, lessons: 2, goalMet: true },
];

async function welcomeStep(page: Page, step: number) {
  await asNewUser(page);
  await page.goto('/boas-vindas');
  if (step >= 2) await page.getByRole('button', { name: 'Começar' }).click();
  if (step >= 3) await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText(`Passo ${step} de 3`)).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

export type Screen = { name: string; full?: boolean; run: (page: Page) => Promise<void> };

export const screens: Screen[] = [
  {
    name: 'trilha-inicio',
    run: async (page) => {
      await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
    },
  },
  {
    name: 'trilha-meio-coroas',
    full: true,
    run: async (page) => {
      await seed(page, {
        profile: veteran,
        lessonProgress: progress([...unit1.slice(0, 7)]),
        daily: [{ day: DAY, xp: 12, lessons: 1, goalMet: false }],
      });
      await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
    },
  },
  {
    name: 'trilha-unidade-2',
    run: async (page) => {
      await seed(page, {
        profile: veteran,
        lessonProgress: progress([...unit1, 'u1-review', 'u2-sk1-l1']),
        daily: [{ day: DAY, xp: 25, lessons: 2, goalMet: true }],
      });
      await expect(page.getByRole('link', { name: /atual$/ })).toBeVisible();
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'dica',
    full: true,
    run: async (page) => {
      await page.goto('/dica/u1-sk1');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.locator(':focus').evaluate((el) => (el as HTMLElement).blur());
    },
  },
  {
    name: 'fim-de-licao',
    full: true,
    run: async (page) => {
      await seed(page, {
        settings: { dailyGoalXp: 10 },
        profile: {
          totalXp: 90,
          streak: {
            current: 2,
            longest: 2,
            lastActiveDay: '2026-10-28',
            freezes: 0,
            xpTowardFreeze: 90,
          },
        },
      });
      await playLesson(page, 'u1-sk1-l1');
      await expect(page.getByText(/^Meta batida!/)).toBeVisible();
    },
  },
  {
    name: 'feedback-escolha-errada',
    run: async (page) => {
      await page.goto('/licao/demo-sk1-l1');
      await page.getByText('thanks', { exact: true }).click();
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
      await page.waitForTimeout(500); // let the heart-loss animation finish
    },
  },
  {
    name: 'feedback-certo',
    run: async (page) => {
      await page.goto('/licao/demo-sk1-l1');
      await page.getByText('hello', { exact: true }).click();
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
    },
  },
  {
    name: 'feedback-quase',
    run: async (page) => {
      await demoUpToBank(page);
      for (const w of ['Nice', 'to', 'meet', 'you']) {
        await page.getByRole('button', { name: `Adicionar "${w}"` }).click();
      }
      await page.getByRole('button', { name: 'Verificar' }).click();
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByRole('textbox').fill('muito obrigdo');
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.locator('footer mark')).toBeVisible();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'sem-coracoes',
    run: async (page) => {
      await seed(page, { profile: { hearts: 0, heartsUpdatedAt: `${DAY}T11:00:00.000Z` } });
      await page.goto('/licao/u1-sk1-l1');
      await expect(page.getByRole('heading', { name: 'Seus corações acabaram' })).toBeVisible();
    },
  },
  {
    name: 'erro-de-conteudo-offline',
    run: async (page) => {
      // Simulates an unreachable unit chunk (offline before it was ever cached).
      await page
        .context()
        .route(/\/assets\/u01-[^/]+\.js$/, (route) => route.abort('internetdisconnected'));
      await page.goto('/licao/u1-sk1-l1');
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    },
  },
  {
    name: 'banco-de-palavras',
    run: async (page) => {
      await demoUpToBank(page);
      await page.getByRole('button', { name: 'Adicionar "Nice"' }).click();
      await page.getByRole('button', { name: 'Adicionar "to"' }).click();
    },
  },
  { name: 'boas-vindas-1', run: (page) => welcomeStep(page, 1) },
  { name: 'boas-vindas-2', run: (page) => welcomeStep(page, 2) },
  { name: 'boas-vindas-3', run: (page) => welcomeStep(page, 3) },
  {
    name: 'nivelamento-pergunta',
    run: async (page) => {
      await asNewUser(page);
      await page.goto('/nivelamento');
      await expect(page.getByText('1 de 15')).toBeVisible();
    },
  },
  {
    name: 'nivelamento-aprovado',
    full: true,
    run: async (page) => {
      await asNewUser(page);
      await page.goto('/nivelamento');
      await playPlacement(page, true);
    },
  },
  {
    // The "what you missed" list starts closed.
    name: 'nivelamento-reprovado',
    full: true,
    run: async (page) => {
      await asNewUser(page);
      await page.goto('/nivelamento');
      await playPlacement(page, false);
      await expect(page.locator('details')).not.toHaveAttribute('open', /.*/);
    },
  },
  {
    name: 'nivelamento-reprovado-lista-aberta',
    full: true,
    run: async (page) => {
      await asNewUser(page);
      await page.goto('/nivelamento');
      await playPlacement(page, false);
      await page.locator('details summary').click();
    },
  },
  {
    name: 'praticar-com-vencidos',
    run: async (page) => {
      await seed(page, { profile: veteran, srs: dueCards.map((id) => card(id)) });
      await page.goto('/praticar');
      await expect(page.getByText(/palavras e frases para revisar hoje/)).toBeVisible();
    },
  },
  {
    name: 'praticar-vazio',
    run: async (page) => {
      await page.goto('/praticar');
      await expect(page.getByText('Tudo em dia! Quer reforçar mesmo assim?')).toBeVisible();
    },
  },
  {
    name: 'fim-de-pratica-coracao',
    full: true,
    run: async (page) => {
      await seed(page, {
        profile: { ...veteran, hearts: 0, heartsUpdatedAt: `${DAY}T11:00:00` },
        srs: dueCards.map((id) => card(id)),
      });
      await page.goto('/praticar/sessao?from=outOfHearts');
      await playPractice(page);
      await expect(page.getByText('+1 coração')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    },
  },
  {
    name: 'perfil-semana-cheia',
    full: true,
    run: async (page) => {
      await seed(page, {
        profile: veteran,
        daily: week,
        srs: dueCards.map((id) => ({ ...card(id, '2026-11-02'), intervalDays: 4 })),
        achievements: [
          { id: 'first-lesson', unlockedAt: '2026-10-12T15:00:00.000Z' },
          { id: 'streak-3', unlockedAt: '2026-10-20T15:00:00.000Z' },
          { id: 'perfect-lesson', unlockedAt: '2026-10-21T15:00:00.000Z' },
        ],
      });
      await page.goto('/perfil');
      await expect(page.getByText('Últimos 7 dias', { exact: true })).toBeVisible();
    },
  },
  {
    name: 'perfil-vazio',
    full: true,
    run: async (page) => {
      await page.goto('/perfil');
      await expect(page.getByText('Sem XP nesta semana ainda')).toBeVisible();
    },
  },
  {
    name: 'ajustes-lembrete-sem-suporte',
    full: true,
    run: async (page) => {
      await notificationPermission(page, 'unsupported');
      await page.goto('/config');
      await expect(page.getByText('Seu navegador não permite lembretes.')).toBeVisible();
    },
  },
  {
    name: 'ajustes-lembrete-negado',
    run: async (page) => {
      await notificationPermission(page, 'denied');
      await page.goto('/config');
      await page.getByRole('heading', { name: 'Lembrete diário' }).scrollIntoViewIfNeeded();
      await expect(page.getByText(/Permissão negada/)).toBeVisible();
    },
  },
  {
    name: 'ajustes-lembrete-ligado',
    run: async (page) => {
      await notificationPermission(page, 'granted');
      await seed(page, { settings: { reminder: { enabled: true, time: '19:30' } } });
      await page.goto('/config');
      await page.getByRole('heading', { name: 'Lembrete diário' }).scrollIntoViewIfNeeded();
      await expect(page.getByText('Lembrete ligado para as 19:30.')).toBeVisible();
    },
  },
  {
    name: 'dialogo-importar',
    run: async (page) => {
      await seed(page, { profile: { totalXp: 45 } });
      await page.goto('/config');
      // Coherent fixture: XP = sum of results, streak matches daily, cards of real items.
      const file = coherentBackup({
        id: 'me',
        dailyGoalXp: 20,
        sound: false,
        haptics: false,
        theme: 'system',
        reminder: { enabled: false, time: '19:00' },
      });
      await page.getByLabel('Importar progresso').setInputFiles({
        name: 'falae-progresso-2026-10-20.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(file)),
      });
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'dialogo-redefinir',
    run: async (page) => {
      await page.goto('/config');
      await page.getByRole('button', { name: 'Apagar todo o progresso' }).click();
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByLabel('Digite APAGAR para confirmar').fill('APAGAR');
    },
  },
  {
    name: 'banco-de-palavras-frase-longa',
    run: async (page) => {
      await seed(page, {
        lessonProgress: progress([...unit1, 'u1-review', 'u2-sk1-l1', 'u2-sk1-l2']),
      });
      await playUntil(page, 'u2-sk1-l3', 11);
      for (const w of tiles('This is my wife and this is my son.')) {
        await page
          .getByRole('button', { name: `Adicionar "${w}"`, exact: true })
          .first()
          .click();
      }
    },
  },
  {
    name: 'vitrine',
    full: true,
    run: async (page) => {
      await page.goto('/dev/showcase');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    },
  },
];
