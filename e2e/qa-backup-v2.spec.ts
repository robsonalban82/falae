import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seed, startAt } from './helpers/seed';

/** QA (Fase 2 etapa 6): backup export/import v2 and the real v1 file through the UI. */

const NOW = '2026-10-29T14:00:00';
const xpLabel = (page: Page) => page.getByRole('img', { name: /XP no total$/ });
const streakLabel = (page: Page) => page.getByRole('img', { name: /^Ofensiva: / });
const input = (page: Page) => page.getByLabel('Importar progresso');

async function dumpDb(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const req = indexedDB.open('falae');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = Array.from(db.objectStoreNames).filter((n) => n !== 'quarantine');
          const tx = db.transaction(names);
          const out: Record<string, unknown[]> = {};
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
  );
}

test('exportar e importar o mesmo arquivo não muda nada', async ({ page }) => {
  await startAt(page, NOW);
  await seed(page, {
    profile: { totalXp: 55, streak: { current: 3, longest: 5, freezes: 1, xpTowardFreeze: 5 } },
    lessonProgress: [{ lessonId: 'u1-sk1-l1' }],
  });
  await page.goto('/config');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar progresso' }).click(),
  ]);
  const body = await readFile((await download.path()) ?? '', 'utf8');
  expect((JSON.parse(body) as { schemaVersion: number }).schemaVersion).toBe(2);
  const before = await dumpDb(page);
  await input(page).setInputFiles({
    name: 'same.json',
    mimeType: 'application/json',
    buffer: Buffer.from(body),
  });
  const dialog = page.getByRole('dialog', { name: 'Substituir seu progresso?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/serão apagadas/)).toHaveCount(0);
  await dialog.getByRole('button', { name: /Substituir/ }).click();
  await expect(page.getByText('Progresso restaurado.').first()).toBeVisible();
  expect(await dumpDb(page)).toEqual(before);
});

test('backup v1 real importado pela UI mostra XP, ofensiva e trilha', async ({ page }) => {
  const body = await readFile('src/test/fixtures/backup-v1.json', 'utf8');
  await startAt(page, NOW);
  await seed(page, { profile: { totalXp: 500 } });
  await page.goto('/config');
  await input(page).setInputFiles({
    name: 'v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(body),
  });
  const dialog = page.getByRole('dialog', { name: 'Substituir seu progresso?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Substituir/ }).click();
  await expect(dialog).toBeHidden();
  await page.goto('/');
  await expect(xpLabel(page)).toHaveAccessibleName('68 XP no total');
  await expect(streakLabel(page)).toHaveAccessibleName(/^Ofensiva: 2 dias/);
  const db = await dumpDb(page);
  expect(db.lessonProgress).toHaveLength(4);
  expect(db.userCards ?? []).toEqual([]);
  await page.reload();
  await expect(xpLabel(page)).toHaveAccessibleName('68 XP no total');
});
