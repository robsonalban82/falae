import { expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Ex = {
  type: string;
  id?: string;
  distractors?: string[];
  answer?: string;
  options?: unknown[];
  pairs?: { en: string; pt: string }[];
  accepted?: string[];
  textEn?: string;
};

const unitsDir = join(process.cwd(), 'src/content/units');

/** Exercises of a real content lesson (read from the JSON files). */
export function lessonExercises(lessonId: string): Ex[] {
  for (const file of readdirSync(unitsDir).filter((f) => f.endsWith('.json'))) {
    const unit = JSON.parse(readFileSync(join(unitsDir, file), 'utf8')) as {
      skills: { lessons: { id: string; exercises: Ex[] }[] }[];
      reviewLesson: { id: string; exercises: Ex[] };
    };
    const all = [...unit.skills.flatMap((s) => s.lessons), unit.reviewLesson];
    const found = all.find((l) => l.id === lessonId);
    if (found) return found.exercises;
  }
  throw new Error(`lesson ${lessonId} not found`);
}

/** First concrete answer of a content pattern: "(x)" keeps x, "[a|b]" picks a. */
export function firstOf(pattern: string): string {
  let s = pattern;
  for (;;) {
    const next = s
      .replace(/\[([^[\]()]*)\]/, (_, g: string) => g.split('|')[0] ?? '')
      .replace(/\(([^[\]()]*)\)/, '$1');
    if (next === s) return s.replace(/\s+/g, ' ').trim();
    s = next;
  }
}

/** Mirrors tokenizeForBank in src/content/schema.ts. */
export function tiles(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ''))
    .filter(Boolean);
}

/** Browser without speech recognition: speak exercises are dropped by the fallbacks. */
export async function noRecognition(page: Page) {
  await page.addInitScript(() => {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
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

export async function pressOption(page: Page, text: string) {
  const values = await page
    .locator('main input[type="radio"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  const i = values.findIndex((v) => v.toLowerCase() === text.toLowerCase());
  expect(i, `option "${text}" among ${values.join(', ')}`).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(i + 1));
}

export async function answer(page: Page, ex: Ex) {
  switch (ex.type) {
    case 'multiple-choice':
    case 'fill-blank':
      return pressOption(page, ex.answer ?? '');
    case 'match-pairs':
      for (const p of ex.pairs ?? []) {
        await page.getByRole('button', { name: p.en, exact: true }).click();
        await page.getByRole('button', { name: p.pt, exact: true }).click();
      }
      return;
    case 'word-bank':
      for (const w of tiles(ex.answer ?? '')) {
        await page
          .getByRole('button', { name: `Adicionar "${w}"`, exact: true })
          .first()
          .click();
      }
      return;
    case 'translate-typing':
      return page.getByRole('textbox').fill(firstOf(ex.accepted?.[0] ?? ''));
    case 'listen-type':
      return page.getByRole('textbox').fill(ex.textEn ?? '');
  }
}

/** Plays a real content lesson without mistakes, up to the finish screen (saved). */
export async function playLesson(page: Page, lessonId: string) {
  await page.goto(`/licao/${lessonId}`);
  await expect(page.getByRole('button', { name: 'Verificar' })).toBeVisible();
  for (const ex of lessonExercises(lessonId)) {
    if (ex.type === 'speak') continue;
    await answer(page, ex);
    if (ex.type !== 'match-pairs') await page.getByRole('button', { name: 'Verificar' }).click();
    const cont = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(cont).toBeVisible();
    await page.waitForTimeout(450); // "Continuar" ignores clicks for 400 ms
    await cont.click();
  }
  await expect(page.getByRole('heading', { name: 'Lição concluída!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
}
