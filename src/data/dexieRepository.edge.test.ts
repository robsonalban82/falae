import Dexie from 'dexie';
import { FalaeDb } from './db';
import { DexieRepository } from './dexieRepository';
import { parseImportFile } from './exportImport';
import {
  defaultProfile,
  defaultSettings,
  EXPORT_SCHEMA_VERSION,
  type ExportFile,
  type LessonResult,
} from './models';
import type { LessonOutcome } from './repository';

const NOW = '2026-10-28T12:00:00.000Z';
let repo: DexieRepository;
let raw: FalaeDb;
let dbName: string;
let n = 0;

beforeEach(() => {
  dbName = `qa-${++n}`;
  repo = new DexieRepository({ dbName, nowIso: () => NOW });
  raw = new FalaeDb(dbName); // second connection to plant corrupted rows
});
afterEach(async () => {
  repo.close();
  raw.close();
  await Dexie.delete(dbName);
});

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
    srsCards: [],
    newAchievements: [],
    dailyGoalXp: 20,
    ...overrides,
  };
}

async function seed() {
  await repo.saveSettings({ ...defaultSettings(), theme: 'dark', dailyGoalXp: 30 });
  await repo.recordLessonResult(outcome());
  return repo.exportAll();
}

describe('corrupted IndexedDB rows', () => {
  it('falls back to a default profile when the stored row is corrupted', async () => {
    await raw.profile.put({ id: 'me', totalXp: 'lots', hearts: 99 } as never);
    expect(await repo.getProfile()).toEqual(defaultProfile(NOW));
  });

  it('falls back to default settings when the stored row is corrupted', async () => {
    await raw.settings.put({ id: 'me', theme: 'purple' } as never);
    expect(await repo.getSettings()).toEqual(defaultSettings());
  });

  it('a corrupted profile does not break export (exported file stays importable)', async () => {
    await raw.profile.put({ id: 'me', totalXp: -5 } as never);
    const file = await repo.exportAll();
    expect(parseImportFile(JSON.stringify(file)).ok).toBe(true);
  });

  it('can overwrite a corrupted row with a valid one', async () => {
    await raw.settings.put({ id: 'me', theme: 'purple' } as never);
    await repo.saveSettings({ ...defaultSettings(), theme: 'light' });
    expect((await repo.getSettings()).theme).toBe('light');
  });

  it('strips unknown fields when saving', async () => {
    await repo.saveSettings({ ...defaultSettings(), extra: 1 } as never);
    expect(await raw.settings.get('me')).not.toHaveProperty('extra');
  });

  it('rejects invalid settings on save', async () => {
    await expect(
      repo.saveSettings({ ...defaultSettings(), theme: 'purple' } as never),
    ).rejects.toThrow();
    await expect(
      repo.saveSettings({ ...defaultSettings(), dailyGoalXp: 25 } as never),
    ).rejects.toThrow();
    await expect(
      repo.saveSettings({ ...defaultSettings(), reminder: { enabled: true, time: '24:00' } }),
    ).rejects.toThrow();
  });
});

describe('import / export edge cases', () => {
  it('rejects a file from another schema version without touching data', async () => {
    const file = await seed();
    const future = { ...file, schemaVersion: EXPORT_SCHEMA_VERSION + 1 };
    const r = parseImportFile(JSON.stringify(future));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/versão mais nova do Falaê/);
    expect(r.reason).not.toMatch(/schemaVersion|Invalid/);
    expect(await repo.exportAll()).toEqual(file);
  });

  it('rejects an older/unknown version 0 with a friendly message', () => {
    const r = parseImportFile(JSON.stringify({ app: 'falae', schemaVersion: 0 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/não é mais compatível/);
  });

  it('rejects a non-numeric schemaVersion without throwing', () => {
    for (const v of ['1', null, 1.5]) {
      expect(
        parseImportFile(JSON.stringify({ app: 'falae', schemaVersion: v })).ok,
        String(v),
      ).toBe(false);
    }
  });

  it('rejects impossible dates inside an import file', async () => {
    const file = await seed();
    const bad = structuredClone(file);
    bad.data.daily[0]!.day = '2026-02-30';
    expect(parseImportFile(JSON.stringify(bad)).ok).toBe(false);
  });

  it('rejects JSON that is valid but not an object', () => {
    for (const text of ['null', '[]', '42', '"falae"', 'true']) {
      expect(parseImportFile(text).ok, text).toBe(false);
    }
  });

  it('rejects an empty file', () => {
    expect(parseImportFile('')).toEqual({ ok: false, reason: 'O arquivo não é um JSON válido.' });
  });

  it('rejects a file with one corrupted record and names the path', async () => {
    const file = await seed();
    const bad = structuredClone(file);
    bad.data.results[0]!.accuracy = 7;
    const r = parseImportFile(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/data › results › 0 › accuracy/);
  });

  it('accepts and strips unknown extra fields in an otherwise valid file', async () => {
    const file = await seed();
    const extra = { ...file, comment: 'hi', data: { ...file.data, futureTable: [] } };
    const r = parseImportFile(JSON.stringify(extra));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file).toEqual(file);
  });

  it('import replaces everything (no leftovers from the previous data)', async () => {
    const file = await seed();
    await repo.recordLessonResult(
      outcome({ result: result({ lessonId: 'u9-sk1-l1', day: '2026-10-29' }) }),
    );
    await repo.importAll(file);
    expect(await repo.exportAll()).toEqual(file);
  });

  it('a failing import rolls back and leaves the previous data intact', async () => {
    const file = await seed();
    const broken = structuredClone(file) as ExportFile;
    // Missing primary key makes IndexedDB throw mid-transaction.
    broken.data.lessonProgress = [{ completedCount: 1 } as never];
    await expect(repo.importAll(broken)).rejects.toThrow();
    expect(await repo.exportAll()).toEqual(file);
  });

  it('accepts BOM-prefixed JSON (saved by some Windows editors) (fixed)', async () => {
    const file = await seed();
    const r = parseImportFile('﻿' + JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file).toEqual(file);
  });

  it('export → reset → import keeps settings (theme survives)', async () => {
    const file = await seed();
    await repo.resetAll();
    expect((await repo.getSettings()).theme).toBe('system');
    const r = parseImportFile(JSON.stringify(file));
    if (!r.ok) throw new Error(r.reason);
    await repo.importAll(r.file);
    expect((await repo.getSettings()).theme).toBe('dark');
  });

  it('resetAll on an empty database is a no-op', async () => {
    await repo.resetAll();
    expect(await repo.getLessonProgress()).toEqual([]);
  });
});

describe('queries', () => {
  it('returns nothing when the daily range is inverted', async () => {
    await repo.recordLessonResult(outcome());
    await expect(repo.getDailyStats('2026-10-30', '2026-10-01')).resolves.toEqual([]);
  });

  it('orders recent results by finishedAt descending and respects the limit', async () => {
    for (const t of [
      '2026-10-26T10:00:00.000Z',
      '2026-10-28T10:00:00.000Z',
      '2026-10-27T10:00:00.000Z',
    ]) {
      await repo.recordLessonResult(outcome({ result: result({ finishedAt: t }) }));
    }
    const recent = await repo.getRecentResults(2);
    expect(recent.map((r) => r.finishedAt)).toEqual([
      '2026-10-28T10:00:00.000Z',
      '2026-10-27T10:00:00.000Z',
    ]);
  });

  it('daily goal is evaluated against the goal passed in, cumulatively', async () => {
    await repo.recordLessonResult(outcome({ result: result({ xp: 10 }), dailyGoalXp: 20 }));
    expect((await repo.getDailyStats('2026-10-28', '2026-10-28'))[0]?.goalMet).toBe(false);
    await repo.recordLessonResult(outcome({ result: result({ xp: 10 }), dailyGoalXp: 20 }));
    expect((await repo.getDailyStats('2026-10-28', '2026-10-28'))[0]?.goalMet).toBe(true);
  });

  it('review results count as lesson progress, placement does not', async () => {
    await repo.recordLessonResult(
      outcome({ result: result({ kind: 'review', lessonId: 'u1-review' }) }),
    );
    await repo.recordLessonResult(
      outcome({ result: result({ kind: 'placement', lessonId: 'placement' }) }),
    );
    expect((await repo.getLessonProgress()).map((p) => p.lessonId)).toEqual(['u1-review']);
  });

  it('recording the same result id twice does not duplicate the result row', async () => {
    const r = result();
    await repo.recordLessonResult(outcome({ result: r }));
    await repo.recordLessonResult(outcome({ result: r }));
    expect(await repo.getRecentResults(10)).toHaveLength(1);
  });
});

describe('write validation (fixed after QA report)', () => {
  it('refuses to persist an invalid lesson result and writes nothing', async () => {
    await expect(
      repo.recordLessonResult(outcome({ result: result({ accuracy: 1.5 }) })),
    ).rejects.toThrow();
    expect(await repo.getRecentResults(10)).toEqual([]);
    expect(await repo.getDailyStats('2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('refuses invalid SRS cards and achievements', async () => {
    const badCard = {
      itemId: 'u1-hello',
      ease: 0.5,
      intervalDays: 1,
      reps: 1,
      lapses: 0,
      dueDay: 'amanhã',
      lastReviewDay: '2026-10-28',
    };
    await expect(repo.upsertSrsCards([badCard])).rejects.toThrow();
    await expect(repo.recordLessonResult(outcome({ srsCards: [badCard] }))).rejects.toThrow();
    await expect(
      repo.recordLessonResult(outcome({ newAchievements: [{ id: '', unlockedAt: 'ontem' }] })),
    ).rejects.toThrow();
    expect(await repo.getSrsCards()).toEqual([]);
    expect(await repo.getAchievements()).toEqual([]);
  });

  it('the user export stays importable after attempted bad writes', async () => {
    await repo.recordLessonResult(outcome());
    await repo.recordLessonResult(outcome({ result: result({ accuracy: 1.5 }) })).catch(() => {});
    const file = await repo.exportAll();
    expect(parseImportFile(JSON.stringify(file)).ok).toBe(true);
  });

  it('importAll re-validates the file and leaves data intact when it is invalid', async () => {
    const file = await seed();
    const bad = structuredClone(file);
    (bad.data.settings as { theme: string }).theme = 'roxo';
    await expect(repo.importAll(bad)).rejects.toThrow();
    expect(await repo.exportAll()).toEqual(file);
  });
});
