import Dexie from 'dexie';
import backup from '../test/fixtures/backup-v1.json';
import { FalaeDb } from './db';
import { DexieRepository } from './dexieRepository';
import { isDbOutdated, resetDbOutdated } from './events';

let n = 0;
const nextName = () => `qa-mig-${++n}`;
const V1 = {
  profile: 'id',
  settings: 'id',
  lessonProgress: 'lessonId',
  results: 'id, day, lessonId, finishedAt',
  srs: 'itemId, dueDay',
  daily: 'day',
  achievements: 'id',
  quarantine: '++id',
};

describe('QA migration', () => {
  beforeEach(() => resetDbOutdated());

  it('real v1 fixture: load rows in a v1 db, open as v2, nothing lost', async () => {
    const name = nextName();
    const v1 = new Dexie(name);
    v1.version(1).stores(V1);
    const data = (backup as unknown as { data: Record<string, unknown> }).data;
    const tables = Object.keys(V1);
    for (const t of tables) {
      const v = data[t];
      if (v === undefined) continue;
      await v1.table(t).bulkPut(Array.isArray(v) ? v : [v]);
    }
    const counts: Record<string, number> = {};
    for (const t of tables) counts[t] = await v1.table(t).count();
    v1.close();

    const db = new FalaeDb(name);
    for (const t of tables) expect(await db.table(t).count()).toBe(counts[t]);
    db.close();
  });

  it('extreme v1 data: 3000 srs, 400-day streak, daily without goalMet', async () => {
    const name = nextName();
    const v1 = new Dexie(name);
    v1.version(1).stores(V1);
    await v1.table('srs').bulkPut(
      Array.from({ length: 3000 }, (_, i) => ({
        itemId: `i${i}`,
        ease: 2.5,
        intervalDays: 1,
        reps: 1,
        lapses: 0,
        dueDay: '2026-10-29',
        lastReviewDay: '2026-10-28',
      })),
    );
    await v1
      .table('daily')
      .bulkPut(Array.from({ length: 400 }, (_, i) => ({ day: `d${i}`, xp: 1, lessons: 1 })));
    await v1
      .table('quarantine')
      .bulkPut(
        Array.from({ length: 50 }, (_, i) => ({ table: 'srs', raw: i, at: 'x', issues: [] })),
      );
    v1.close();
    const repo = new DexieRepository({ dbName: name, nowIso: () => '2026-10-28T12:00:00.000Z' });
    try {
      const f = await repo.exportAll();
      expect(f.data.srs).toHaveLength(3000);
      expect(f.data.daily).toHaveLength(400);
    } finally {
      repo.close();
    }
    const db = new FalaeDb(name);
    expect(await db.quarantine.count()).toBe(50); // rows kept, none added by reading
    db.close();
  });

  it('blocked: an old tab ignoring versionchange -> notice raised, no unhandled rejection', async () => {
    const name = nextName();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const raw = new Dexie(name);
    raw.version(1).stores(V1);
    raw.on('versionchange', () => false); // stays open, blocks the upgrade
    await raw.open();
    const db = new FalaeDb(name);
    const opening = db.open().then(
      () => 'ok',
      (e: unknown) => String(e),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(isDbOutdated()).toBe(true);
    raw.close();
    const res = await opening;
    await new Promise((r) => setTimeout(r, 50));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    // After closing the blocker, a reload (fresh instance) works and keeps data.
    const fresh = new FalaeDb(name);
    await fresh.open();
    expect(fresh.verno).toBe(2);
    fresh.close();
    expect(typeof res).toBe('string');
  });

  it('repository call after the connection was closed by versionchange does not hang', async () => {
    const name = nextName();
    const repo = new DexieRepository({ dbName: name, nowIso: () => '2026-10-28T12:00:00.000Z' });
    await repo.getSettings();
    const newer = new Dexie(name);
    newer.version(2).stores({
      ...V1,
      userCards: 'id, updatedAt',
      mapProgress: 'mapId',
      planProgress: 'planId',
      x: 'id',
    });
    await newer.open();
    const r = await Promise.race([
      repo.getProfile().then(
        () => 'ok',
        () => 'rejected',
      ),
      new Promise((res) => setTimeout(() => res('hang'), 2000)),
    ]);
    expect(r).not.toBe('hang');
    newer.close();
  });
});
