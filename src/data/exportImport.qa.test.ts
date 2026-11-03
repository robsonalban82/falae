import backupV1 from '../test/fixtures/backup-v1.json';
import { DexieRepository } from './dexieRepository';
import { parseExportFile, upgradeExportV1 } from './exportImport';
import { exportFileV1Schema, type ExportFile } from './models';

const NOW = '2026-10-29T12:00:00.000Z';
const TODAY = '2026-10-29';
let repo: DexieRepository;
let n = 0;
beforeEach(() => {
  repo = new DexieRepository({ dbName: `qa-export-${++n}`, nowIso: () => NOW });
});
afterEach(() => repo.close());

const v2 = upgradeExportV1(exportFileV1Schema.parse(backupV1));
const card = (i: number) => ({
  id: `uc-${String(i).padStart(8, '0')}`,
  en: `word ${i}`,
  pt: `palavra ${i}`,
  createdAt: NOW,
  updatedAt: NOW,
});
const withData = (patch: Partial<ExportFile['data']>): ExportFile => ({
  ...v2,
  data: { ...v2.data, ...patch },
});

describe('QA import', () => {
  it('real v1 over a v2 database replaces everything, including cards and maps', async () => {
    await repo.importAll(
      withData({
        userCards: [card(1)],
        mapProgress: [{ mapId: 'm', firstStudiedAt: NOW, lastStudiedDay: TODAY, timesStudied: 3 }],
        planProgress: [{ planId: 'p', startedDay: TODAY, manualDone: [1] }],
      }),
    );
    const r = parseExportFile(JSON.stringify(backupV1), TODAY);
    if (!r.ok) throw new Error(r.reason);
    await repo.importAll(r.file);
    const out = await repo.exportAll();
    expect(out.data.userCards).toEqual([]);
    expect(out.data.mapProgress).toEqual([]);
    expect(out.data.planProgress).toEqual([]);
    expect(out.data.profile.totalXp).toBe(68);
  });

  it('500 cards ok, 501 rejected without touching the db', async () => {
    const ok = withData({ userCards: Array.from({ length: 500 }, (_, i) => card(i)) });
    expect(parseExportFile(JSON.stringify(ok), TODAY).ok).toBe(true);
    await repo.importAll(ok);
    const before = await repo.exportAll();
    const big = withData({ userCards: Array.from({ length: 501 }, (_, i) => card(i)) });
    expect(parseExportFile(JSON.stringify(big), TODAY)).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    await expect(repo.importAll(big)).rejects.toThrow();
    expect(await repo.exportAll()).toEqual(before);
  });

  it('duplicate card ids: parse result and no partial db if the write fails', async () => {
    await repo.importAll(withData({ userCards: [card(1)] }));
    const before = await repo.exportAll();
    const dup = withData({ userCards: [card(2), card(2)] });
    const r = parseExportFile(JSON.stringify(dup), TODAY);
    if (r.ok) {
      // bulkPut overwrites duplicates silently: record behaviour, db must stay consistent.
      await repo.importAll(r.file);
      expect((await repo.exportAll()).data.userCards).toHaveLength(1);
    } else {
      expect(await repo.exportAll()).toEqual(before);
    }
  });

  it('write failure mid-import rolls everything back', async () => {
    await repo.importAll(withData({ userCards: [card(1)] }));
    const before = await repo.exportAll();
    const incoming = withData({ userCards: [card(9)] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- QA: reach the private db to force a failure
    const db = (repo as any).db;
    const orig = db.mapProgress.bulkPut.bind(db.mapProgress);
    db.mapProgress.bulkPut = () => Promise.reject(new Error('boom'));
    await expect(repo.importAll(incoming)).rejects.toThrow('boom');
    db.mapProgress.bulkPut = orig;
    expect(await repo.exportAll()).toEqual(before);
  });

  const text = JSON.stringify(v2);
  it.each([
    ['truncated', text.slice(0, text.length / 2)],
    ['empty', ''],
    ['BOM + valid', '﻿' + text],
    ['null', 'null'],
    ['array', '[]'],
    ['v2 missing userCards', JSON.stringify({ ...v2, data: { ...v2.data, userCards: undefined } })],
    [
      'v2 missing planProgress',
      JSON.stringify({ ...v2, data: { ...v2.data, planProgress: undefined } }),
    ],
    ['schemaVersion string', JSON.stringify({ ...v2, schemaVersion: '2' })],
    ['schemaVersion missing', JSON.stringify({ ...v2, schemaVersion: undefined })],
    ['extra top-level field', JSON.stringify({ ...v2, hack: 1 })],
    ['extra field in data', JSON.stringify({ ...v2, data: { ...v2.data, foo: [] } })],
    [
      'v1 carrying userCards',
      JSON.stringify({
        ...JSON.parse(JSON.stringify(backupV1)),
        data: { ...backupV1.data, userCards: [card(1)] },
      }),
    ],
  ])('%s: never throws', (_, body) => {
    const r = parseExportFile(body, TODAY);
    // Record outcome; only assert it does not throw and is well-formed.
    expect(typeof r.ok).toBe('boolean');
    if (_ === 'BOM + valid') expect(r.ok).toBe(true);
    if (['truncated', 'empty'].includes(_)) expect(r).toMatchObject({ ok: false, reason: 'json' });
    if (_.startsWith('v2 missing')) expect(r.ok).toBe(false);
    if (_ === 'schemaVersion string' || _ === 'schemaVersion missing') expect(r.ok).toBe(false);
  });

  it('extra fields: does the import keep them (strip is fine, persisting is not)', async () => {
    const r = parseExportFile(JSON.stringify({ ...v2, data: { ...v2.data, foo: [1] } }), TODAY);
    if (r.ok) expect(Object.keys(r.file.data)).not.toContain('foo');
  });
});
