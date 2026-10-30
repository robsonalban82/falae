import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { noRecognition } from './helpers/playLesson';
import { card, DAY, dueCards, screens, type Screen } from './helpers/screens';
import { seed, startAt } from './helpers/seed';

/**
 * axe audit (Phase 7): every screen in light and dark, mobile and desktop, WCAG 2.1 A/AA.
 * Criterion: 0 serious/critical violations. Moderate/minor ones are printed for the revisor-ux.
 * Exclusions: none.
 */

const DEMO = '/licao/demo-sk1-l1';

/** Fake recognizer so the speak exercise is rendered (not replaced by the fallbacks). */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      lang = '';
      maxAlternatives = 1;
      interimResults = false;
      continuous = false;
      start() {}
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
}

/** Opens the demo lesson straight at exercise `index` by editing the saved session queue. */
async function demoAt(page: Page, index: number) {
  await page.goto(DEMO);
  await expect(page.getByRole('button', { name: 'Sair da lição' })).toBeVisible();
  await page.evaluate((i) => {
    const raw = sessionStorage.getItem('falae-lesson-session');
    if (!raw) throw new Error('no session');
    const env = JSON.parse(raw) as { state: { queue: number[] } };
    env.state.queue = [i, ...env.state.queue.filter((q) => q !== i)];
    sessionStorage.setItem('falae-lesson-session', JSON.stringify(env));
  }, index);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sair da lição' })).toBeVisible();
}

const exerciseTypes = [
  'multiple-choice',
  'match-pairs',
  'word-bank',
  'translate-typing',
  'fill-blank',
  'listen-type',
  'speak',
];

const extraScreens: (Screen & { speech?: boolean })[] = [
  // Demo lesson e01..e07 covers each exercise type once.
  ...exerciseTypes.map((type, i) => ({
    name: `licao-${type}`,
    speech: true,
    run: (page: Page) => demoAt(page, i),
  })),
  // 'sem-coracoes' now lives in the shared screens list.
  {
    name: 'sessao-de-pratica',
    run: async (page) => {
      await seed(page, { srs: dueCards.map((id) => card(id)) });
      await page.goto('/praticar/sessao');
      await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
    },
  },
  {
    name: '404',
    run: async (page) => {
      await page.goto('/nao-existe');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    },
  },
];

const all = [...screens.filter((s) => s.name !== 'vitrine'), ...extraScreens];

for (const theme of ['light', 'dark'] as const) {
  for (const screen of all) {
    test(`axe: ${screen.name} (${theme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      if ('speech' in screen && screen.speech) await fakeSpeech(page);
      else await noRecognition(page);
      await startAt(page, `${DAY}T12:00:00`);
      await screen.run(page);
      await page.waitForLoadState('networkidle');
      // Theme must really be applied (the app follows the system setting by default).
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      const others = results.violations.filter((v) => !blocking.includes(v));
      if (others.length > 0) {
        console.log(
          `[axe ${info.project.name} ${theme} ${screen.name}] não bloqueantes: ` +
            others.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`).join(', '),
        );
      }
      expect(
        blocking.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
        })),
      ).toEqual([]);
    });
  }
}
