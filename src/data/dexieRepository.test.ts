import { DexieRepository } from './dexieRepository';
import { parseExportFile, exportFileName } from './exportImport';
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

    const parsed = parseExportFile(JSON.stringify(exported), '2026-10-28');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.totalXp).toBe(15);
    await repo.importAll(parsed.file);
    expect(await repo.exportAll()).toEqual(exported);
  });
});

describe('parseExportFile', () => {
  it('rejects non-JSON, foreign and malformed files without throwing', () => {
    expect(parseExportFile('{oops', '2026-10-28')).toEqual({ ok: false, reason: 'json' });
    expect(parseExportFile('{"app":"other"}', '2026-10-28')).toMatchObject({
      ok: false,
      reason: 'notFalae',
    });
    const r = parseExportFile(
      JSON.stringify({ app: 'falae', schemaVersion: 1, exportedAt: NOW, data: {} }),
      '2026-10-28',
    );
    expect(r.ok).toBe(false);
  });

  it('names export files by day', () => {
    expect(exportFileName('2026-10-28')).toBe('falae-progresso-2026-10-28.json');
  });
});

describe('idempotent lesson results', () => {
  it('ignores a second commit of the same result id', async () => {
    const repo2 = new DexieRepository({ dbName: `test-idem-${Date.now()}`, nowIso: () => NOW });
    const o = outcome({ result: result({ id: 'same-run' }) });
    await expect(repo2.recordLessonResult(o)).resolves.toMatchObject({ applied: true });
    await expect(
      repo2.recordLessonResult({
        ...o,
        profile: { ...o.profile, totalXp: 999 },
        newAchievements: [{ id: 'xp-500', unlockedAt: NOW }],
      }),
    ).resolves.toEqual({ applied: false });
    expect(await repo2.getRecentResults(10)).toHaveLength(1);
    expect((await repo2.getAchievements()).map((a) => a.id)).not.toContain('xp-500');
    expect((await repo2.getProfile()).totalXp).toBe(15);
    expect((await repo2.getDailyStats('2026-10-28', '2026-10-28'))[0]?.xp).toBe(15);
    repo2.close();
  });
});

describe('achievements are never rewritten', () => {
  it('keeps the original unlockedAt of an achievement already unlocked', async () => {
    await repo.recordLessonResult(
      outcome({
        newAchievements: [{ id: 'first-lesson', unlockedAt: '2026-01-01T00:00:00.000Z' }],
      }),
    );
    const second = await repo.recordLessonResult(
      outcome({ newAchievements: [{ id: 'first-lesson', unlockedAt: NOW }] }),
    );
    expect(second).toMatchObject({ applied: true, newAchievements: [] });
    expect(await repo.getAchievements()).toEqual([
      { id: 'first-lesson', unlockedAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });
});

describe('parseExportFile summary and safety (Fase 6)', () => {
  it('summarizes XP, streak (as shown today), lessons, achievements and date', async () => {
    await repo.recordLessonResult(outcome());
    const file = await repo.exportAll();
    const withStreak = {
      ...file,
      data: {
        ...file.data,
        profile: {
          ...file.data.profile,
          streak: {
            current: 4,
            longest: 9,
            lastActiveDay: '2026-10-20',
            freezes: 0,
            xpTowardFreeze: 0,
          },
        },
      },
    };
    const r = parseExportFile(JSON.stringify(withStreak), '2026-10-28');
    if (!r.ok) throw new Error(r.reason);
    expect(r.summary).toEqual({
      totalXp: 15,
      streak: 0, // broken since 2026-10-20
      longest: 9,
      lessons: 1,
      achievements: 1,
      exportedAt: NOW,
    });
  });

  it('an invalid file leaves the database identical', async () => {
    await repo.recordLessonResult(outcome());
    const before = await repo.exportAll();
    const r = parseExportFile(
      JSON.stringify({ ...before, data: { ...before.data, srs: [{}] } }),
      '2026-10-28',
    );
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
    if (!r.ok) expect(r.issues?.length).toBeLessThanOrEqual(3);
    await expect(
      repo.importAll({ ...before, data: { ...before.data, srs: [{}] } } as never),
    ).rejects.toThrow();
    expect(await repo.exportAll()).toEqual(before);
  });
});
