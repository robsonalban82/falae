import { DexieRepository } from './dexieRepository';
import { parseImportFile, exportFileName } from './exportImport';
import { defaultProfile, defaultSettings, type LessonResult } from './models';
import type { LessonOutcome } from './repository';

const NOW = '2026-10-28T12:00:00.000Z';
let repo: DexieRepository;
let n = 0;

beforeEach(() => {
  repo = new DexieRepository({ dbName: `test-${++n}`, nowIso: () => NOW });
});
afterEach(() => repo.close());

function result(overrides: Partial<LessonResult> = {}): LessonResult {
  return {
    id: crypto.randomUUID(),
    lessonId: 'u1-sk1-l1',
    kind: 'lesson',
    day: '2026-10-28',
    finishedAt: NOW,
    xp: 15,
    accuracy: 0.9,
    durationMs: 120_000,
    mistakes: 1,
    perfect: false,
    itemOutcomes: [{ itemId: 'u1-hello', q: 5 }],
    ...overrides,
  };
}

function outcome(overrides: Partial<LessonOutcome> = {}): LessonOutcome {
  return {
    result: result(),
    profile: { ...defaultProfile(NOW), totalXp: 15 },
    srsCards: [
      {
        itemId: 'u1-hello',
        ease: 2.5,
        intervalDays: 1,
        reps: 1,
        lapses: 0,
        dueDay: '2026-10-29',
        lastReviewDay: '2026-10-28',
      },
    ],
    newAchievements: [{ id: 'first-lesson', unlockedAt: NOW }],
    dailyGoalXp: 20,
    ...overrides,
  };
}

describe('DexieRepository', () => {
  it('returns defaults on first run', async () => {
    expect(await repo.getProfile()).toEqual(defaultProfile(NOW));
    expect(await repo.getSettings()).toEqual(defaultSettings());
  });

  it('saves and reads settings and profile', async () => {
    await repo.saveSettings({ ...defaultSettings(), dailyGoalXp: 50, theme: 'dark' });
    expect((await repo.getSettings()).dailyGoalXp).toBe(50);
    await repo.saveProfile({ ...defaultProfile(NOW), totalXp: 99 });
    expect((await repo.getProfile()).totalXp).toBe(99);
  });

  it('refuses to save an invalid profile', async () => {
    await expect(repo.saveProfile({ ...defaultProfile(NOW), hearts: 9 })).rejects.toThrow();
  });

  it('records a lesson outcome atomically', async () => {
    await repo.recordLessonResult(outcome());
    await repo.recordLessonResult(outcome({ result: result({ accuracy: 1, xp: 10 }) }));

    const [progress] = await repo.getLessonProgress();
    expect(progress).toMatchObject({ lessonId: 'u1-sk1-l1', completedCount: 2, bestAccuracy: 1 });
    const [day] = await repo.getDailyStats('2026-10-28', '2026-10-28');
    expect(day).toEqual({ day: '2026-10-28', xp: 25, lessons: 2, goalMet: true });
    expect((await repo.getProfile()).totalXp).toBe(15);
    expect(await repo.getSrsCards()).toHaveLength(1);
    expect(await repo.getAchievements()).toHaveLength(1);
    expect(await repo.getRecentResults(10)).toHaveLength(2);
  });

  it('does not count practice as lesson progress', async () => {
    await repo.recordLessonResult(
      outcome({ result: result({ kind: 'practice', lessonId: 'practice' }) }),
    );
    expect(await repo.getLessonProgress()).toEqual([]);
    expect(await repo.getDailyStats('2026-10-01', '2026-10-31')).toHaveLength(1);
  });

  it('rolls back everything when part of the outcome is invalid', async () => {
    const bad = outcome({ profile: { ...defaultProfile(NOW), hearts: -1 } });
    await expect(repo.recordLessonResult(bad)).rejects.toThrow();
    expect(await repo.getLessonProgress()).toEqual([]);
    expect(await repo.getRecentResults(10)).toEqual([]);
  });

  it('filters daily stats by range', async () => {
    for (const day of ['2026-10-20', '2026-10-25', '2026-10-28']) {
      await repo.recordLessonResult(outcome({ result: result({ day }) }));
    }
    const days = await repo.getDailyStats('2026-10-22', '2026-10-28');
    expect(days.map((d) => d.day)).toEqual(['2026-10-25', '2026-10-28']);
  });

  it('exports, resets and imports back the same data', async () => {
    await repo.saveSettings({ ...defaultSettings(), sound: false });
    await repo.recordLessonResult(outcome());
    const exported = await repo.exportAll();

    await repo.resetAll();
    expect((await repo.getProfile()).totalXp).toBe(0);
    expect(await repo.getLessonProgress()).toEqual([]);

    const parsed = parseImportFile(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.totalXp).toBe(15);
    await repo.importAll(parsed.file);
    expect(await repo.exportAll()).toEqual(exported);
  });
});

describe('parseImportFile', () => {
  it('rejects non-JSON, foreign and malformed files without throwing', () => {
    expect(parseImportFile('{oops')).toEqual({
      ok: false,
      reason: 'O arquivo não é um JSON válido.',
    });
    expect(parseImportFile('{"app":"other"}')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('não é um progresso'),
    });
    const r = parseImportFile(
      JSON.stringify({ app: 'falae', schemaVersion: 1, exportedAt: NOW, data: {} }),
    );
    expect(r.ok).toBe(false);
  });

  it('names export files by day', () => {
    expect(exportFileName('2026-10-28')).toBe('falae-progresso-2026-10-28.json');
  });
});
