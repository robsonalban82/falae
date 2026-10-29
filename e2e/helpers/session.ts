import { expect, type Page } from '@playwright/test';
import { answer, firstOf, pressOption, type Ex } from './playLesson';

type SessionState = { exercises: Ex[]; queue: number[]; status: string; turn: number };

/** Reads the session saved by the app (sessionStorage) — generated exercises are not in the JSON. */
export async function sessionState(page: Page): Promise<SessionState | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('falae-lesson-session');
    return raw ? (JSON.parse(raw) as { state: SessionState }).state : null;
  });
}

export async function current(page: Page): Promise<{ ex: Ex; turn: number }> {
  let found: { ex: Ex; turn: number } | null = null;
  await expect
    .poll(async () => {
      const s = await sessionState(page);
      const ex = s && s.status === 'answering' ? s.exercises[s.queue[0] ?? -1] : undefined;
      found = ex && s ? { ex, turn: s.turn } : null;
      return found !== null;
    })
    .toBe(true);
  return found as unknown as { ex: Ex; turn: number }; // set by the poll above
}

/** A deliberately wrong answer for each exercise type. */
export async function answerWrong(page: Page, ex: Ex) {
  switch (ex.type) {
    case 'multiple-choice':
    case 'fill-blank': {
      const opts = (ex.options ?? []).map((o) =>
        typeof o === 'string' ? o : (o as { text: string }).text,
      );
      const wrong = opts.find((o) => o.toLowerCase() !== (ex.answer ?? '').toLowerCase());
      return pressOption(page, wrong ?? '');
    }
    case 'word-bank':
      return page
        .getByRole('button', { name: `Adicionar "${ex.distractors?.[0] ?? ''}"`, exact: true })
        .first()
        .click();
    default:
      return page.getByRole('textbox').fill('zzz qqq');
  }
}

/** Plays a practice session (LessonPlayer) to the finish screen, answering everything right. */
export async function playPractice(page: Page) {
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  for (let guard = 0; guard < 40; guard++) {
    if (await page.getByRole('heading', { name: 'Prática concluída!' }).isVisible()) return;
    const { ex } = await current(page);
    await answer(page, ex);
    if (ex.type !== 'match-pairs') await page.getByRole('button', { name: 'Verificar' }).click();
    const cont = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(cont).toBeVisible();
    await page.waitForTimeout(450); // "Continuar" ignores clicks for 400 ms
    await cont.click();
  }
  await expect(page.getByRole('heading', { name: 'Prática concluída!' })).toBeVisible();
}

/** Plays the placement test, all right or all wrong, until the result screen. */
export async function playPlacement(page: Page, right: boolean) {
  await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
  for (let guard = 0; guard < 20; guard++) {
    if (await page.getByRole('button', { name: 'Ir para a trilha' }).isVisible()) break;
    const { ex, turn } = await current(page);
    if (right) await answer(page, ex);
    else await answerWrong(page, ex);
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect.poll(async () => (await sessionState(page))?.turn ?? turn + 1).not.toBe(turn);
  }
  await expect(page.getByRole('button', { name: 'Ir para a trilha' })).toBeEnabled();
}

export { firstOf };
