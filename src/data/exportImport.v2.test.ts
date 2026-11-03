import backupV1 from '../test/fixtures/backup-v1.json';
import { DexieRepository } from './dexieRepository';
import { importDropsUserCards, parseExportFile, upgradeExportV1 } from './exportImport';
import { exportFileV1Schema, planProgressSchema, type ExportFile } from './models';

// The real v1 backup was exported on 2026-10-29: keep the clock near it.
const NOW = '2026-10-29T12:00:00.000Z';
const TODAY = '2026-10-29';
let repo: DexieRepository;
let n = 0;

beforeEach(() => {
  repo = new DexieRepository({ dbName: `export-v2-${++n}`, nowIso: () => NOW });
});
afterEach(() => repo.close());

const card = (id: string) => ({
  id,
  en: 'good morning',
  pt: 'bom dia',
  createdAt: NOW,
  updatedAt: NOW,
});
const v2With = (patch: Partial<ExportFile['data']>, file?: ExportFile): ExportFile => {
  const base = file ?? upgradeExportV1(exportFileV1Schema.parse(backupV1));
  return { ...base, data: { ...base.data, ...patch } };
};

describe('real v1 backup', () => {
  it('parses, is promoted with empty new tables and keeps every old table', () => {
    const r = parseExportFile(JSON.stringify(backupV1), TODAY);
    if (!r.ok) throw new Error(r.reason);
    expect(r.file.schemaVersion).toBe(2);
    expect(r.file.data.userCards).toEqual([]);
    expect(r.file.data.mapProgress).toEqual([]);
    expect(r.file.data.planProgress).toEqual([]);
    for (const key of Object.keys(backupV1.data) as (keyof typeof backupV1.data)[]) {
      expect(r.file.data[key]).toEqual(backupV1.data[key]);
    }
    expect(r.summary).toMatchObject({ userCards: 0, mapsStudied: 0, totalXp: 68 });
  });

  it('imports and exports back table by table, then round-trips as v2', async () => {
    const r = parseExportFile(JSON.stringify(backupV1), TODAY);
    if (!r.ok) throw new Error(r.reason);
    await repo.importAll(r.file);
    const out = await repo.exportAll();
    for (const key of Object.keys(backupV1.data) as (keyof typeof backupV1.data)[]) {
      const sorted = (rows: unknown) =>
        [...[rows].flat()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      expect(sorted(out.data[key])).toEqual(sorted(backupV1.data[key]));
    }
    expect(out.data.userCards).toEqual([]);

    const again = parseExportFile(JSON.stringify(out), TODAY);
    if (!again.ok) throw new Error(again.reason);
    await repo.importAll(again.file);
    expect(await repo.exportAll()).toEqual(out);
  });
});

describe('v2 export', () => {
  it('includes cards and map/plan progress and round-trips', async () => {
    const file = v2With({
      userCards: [card('uc-abcdefgh')],
      mapProgress: [
        { mapId: 'mm-to-be', firstStudiedAt: NOW, lastStudiedDay: TODAY, timesStudied: 2 },
      ],
      planProgress: [{ planId: 'plan-30', startedDay: TODAY, manualDone: [1, 2] }],
    });
    await repo.importAll(file);
    const out = await repo.exportAll();
    expect(out.schemaVersion).toBe(2);
    expect(out.data.userCards).toEqual(file.data.userCards);
    expect(out.data.mapProgress).toEqual(file.data.mapProgress);
    expect(out.data.planProgress).toEqual(file.data.planProgress);
    const parsed = parseExportFile(JSON.stringify(out), TODAY);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.summary).toMatchObject({ userCards: 1, mapsStudied: 1 });
  });
});

describe('rejections leave the database untouched', () => {
  const bad: [string, (f: ExportFile) => unknown][] = [
    [
      'invalid userCard',
      (f) => ({ ...f, data: { ...f.data, userCards: [{ ...card('uc-abcdefgh'), en: 'a|b' }] } }),
    ],
    [
      'unknown result kind',
      (f) => ({
        ...f,
        data: { ...f.data, results: [{ ...f.data.results[0], kind: 'quiz' }] },
      }),
    ],
    [
      'mapProgress without mapId',
      (f) => ({
        ...f,
        data: {
          ...f.data,
          mapProgress: [{ firstStudiedAt: NOW, lastStudiedDay: TODAY, timesStudied: 1 }],
        },
      }),
    ],
    [
      'repeated manualDone days',
      (f) => ({
        ...f,
        data: {
          ...f.data,
          planProgress: [{ planId: 'p', startedDay: TODAY, manualDone: [3, 3] }],
        },
      }),
    ],
  ];

  it.each(bad)('%s: parse fails and importAll throws without writing', async (_, mutate) => {
    await repo.importAll(v2With({ userCards: [card('uc-abcdefgh')] }));
    const before = await repo.exportAll();
    const broken = mutate(before);
    const r = parseExportFile(JSON.stringify(broken), TODAY);
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
    await expect(repo.importAll(broken as ExportFile)).rejects.toThrow();
    expect(await repo.exportAll()).toEqual(before);
  });

  it('schemaVersion 3 is newerVersion', () => {
    const file = { ...v2With({}), schemaVersion: 3 };
    expect(parseExportFile(JSON.stringify(file), TODAY)).toMatchObject({
      ok: false,
      reason: 'newerVersion',
    });
  });
});

describe('planProgressSchema', () => {
  it('rejects repeated days', () => {
    const ok = { planId: 'p', startedDay: TODAY, manualDone: [1, 2] };
    expect(planProgressSchema.safeParse(ok).success).toBe(true);
    expect(planProgressSchema.safeParse({ ...ok, manualDone: [2, 2] }).success).toBe(false);
  });
});

describe('importDropsUserCards', () => {
  const summary = (userCards: number) => {
    const r = parseExportFile(
      JSON.stringify(
        v2With({ userCards: Array.from({ length: userCards }, (_, i) => card(`uc-abcdefg${i}`)) }),
      ),
      TODAY,
    );
    if (!r.ok) throw new Error(r.reason);
    return r.summary;
  };
  it('warns only when the database has cards and the file has none', () => {
    expect(importDropsUserCards(3, summary(0))).toBe(true);
    expect(importDropsUserCards(3, summary(2))).toBe(false);
    expect(importDropsUserCards(0, summary(0))).toBe(false);
    expect(importDropsUserCards(0, summary(2))).toBe(false);
  });
});
