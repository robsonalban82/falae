import Dexie from 'dexie';
import { FalaeDb } from './db';
import { DexieRepository } from './dexieRepository';
import { isDbOutdated, onDbOutdated, resetDbOutdated } from './events';
import { exportFileSchema } from './models';

const NOW = '2026-10-28T12:00:00.000Z';
let n = 0;
const nextName = () => `migration-${++n}`;

/** Frozen copy of the v1 schema (do NOT import it from db.ts: this is the contract). */
function openV1(name: string): Dexie {
  const db = new Dexie(name);
  db.version(1).stores({
    profile: 'id',
    settings: 'id',
    lessonProgress: 'lessonId',
    results: 'id, day, lessonId, finishedAt',
    srs: 'itemId, dueDay',
    daily: 'day',
    achievements: 'id',
    quarantine: '++id',
  });
  return db;
}

const profile = {
  id: 'me',
  createdAt: '2026-10-01T10:00:00.000Z',
  onboardingDone: true,
  placement: { score: 0.6, skippedUnit1: false },
  totalXp: 120,
  hearts: 4,
  heartsUpdatedAt: NOW,
  streak: { current: 3, longest: 5, lastActiveDay: '2026-10-28', freezes: 1, xpTowardFreeze: 20 },
  lastGoalCelebratedDay: '2026-10-27',
};
const settings = {
  id: 'me',
  dailyGoalXp: 30,
  sound: false,
  haptics: true,
  theme: 'dark',
  reminder: { enabled: true, time: '19:30' },
};
const lessonProgress = [
  { lessonId: 'u1-sk1-l1', completedCount: 2, bestAccuracy: 0.9, firstCompletedAt: NOW },
  { lessonId: 'u1-sk1-l2', completedCount: 1, bestAccuracy: 1, firstCompletedAt: NOW },
];
const resultBase = {
  day: '2026-10-28',
  finishedAt: NOW,
  xp: 15,
  accuracy: 0.9,
  durationMs: 90_000,
  mistakes: 1,
  perfect: false,
  itemOutcomes: [{ itemId: 'u1-hello', q: 5 }],
};
const results = (['lesson', 'review', 'practice', 'placement'] as const).map((kind, i) => ({
  ...resultBase,
  id: `r-${kind}`,
  lessonId: `u1-sk1-l${i + 1}`,
  kind,
}));
const srs = [
  {
    itemId: 'u1-hello',
    ease: 2.5,
    intervalDays: 1,
    reps: 1,
    lapses: 0,
    dueDay: '2026-10-29',
    lastReviewDay: '2026-10-28',
  },
];
const daily = [
  { day: '2026-10-27', xp: 10, lessons: 1, goalMet: false },
  { day: '2026-10-28', xp: 35, lessons: 2, goalMet: true },
];
const achievements = [{ id: 'first-lesson', unlockedAt: NOW }];
// A row the app would have quarantined (the raw value is arbitrary).
const quarantine = [{ id: 1, table: 'profile', raw: { id: 'me', bad: 1 }, at: NOW, issues: ['x'] }];

async function seedV1(name: string): Promise<void> {
  const v1 = openV1(name);
  await v1.table('profile').put(profile);
  await v1.table('settings').put(settings);
  await v1.table('lessonProgress').bulkPut(lessonProgress);
  await v1.table('results').bulkPut(results);
  await v1.table('srs').bulkPut(srs);
  await v1.table('daily').bulkPut(daily);
  await v1.table('achievements').bulkPut(achievements);
  await v1.table('quarantine').bulkPut(quarantine);
  v1.close();
}

describe('Dexie v1 -> v2 migration', () => {
  it('keeps every v1 row untouched and adds empty new tables', async () => {
    const name = nextName();
    await seedV1(name);

    const db = new FalaeDb(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect(await db.profile.toArray()).toEqual([profile]);
    expect(await db.settings.toArray()).toEqual([settings]);
    expect(await db.lessonProgress.toArray()).toEqual(lessonProgress);
    expect(await db.results.orderBy('id').toArray()).toEqual(
      [...results].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await db.srs.toArray()).toEqual(srs);
    expect(await db.daily.toArray()).toEqual(daily);
    expect(await db.achievements.toArray()).toEqual(achievements);
    expect(await db.quarantine.toArray()).toEqual(quarantine);
    expect(await db.userCards.count()).toBe(0);
    expect(await db.mapProgress.count()).toBe(0);
    expect(await db.planProgress.count()).toBe(0);
    db.close();
  });

  it('reads through the repository without quarantining anything, and round-trips an export', async () => {
    const name = nextName();
    await seedV1(name);
    const repo = new DexieRepository({ dbName: name, nowIso: () => NOW });
    try {
      expect(await repo.getProfile()).toEqual(profile);
      expect(await repo.getSettings()).toEqual(settings);

      const before = await repo.exportAll();
      expect(exportFileSchema.parse(before)).toEqual(before);
      expect(before.data.results).toHaveLength(results.length);

      const db = new FalaeDb(name);
      expect(await db.quarantine.toArray()).toEqual(quarantine); // nothing new
      db.close();

      await repo.importAll(before);
      expect(await repo.exportAll()).toEqual(before);
    } finally {
      repo.close();
    }
  });

  it('reads old rows without the new optional fields', async () => {
    const name = nextName();
    await seedV1(name);
    const repo = new DexieRepository({ dbName: name, nowIso: () => NOW });
    try {
      const file = await repo.exportAll();
      expect(file.data.daily.every((d) => d.cards === undefined)).toBe(true);
      expect(file.data.results.every((r) => r.context === undefined)).toBe(true);
    } finally {
      repo.close();
    }
  });
});

describe('versionchange / blocked', () => {
  beforeEach(() => resetDbOutdated());

  it('closes the open connection and raises the notice when another connection upgrades', async () => {
    const name = nextName();
    const seen = vi.fn();
    const off = onDbOutdated(seen);
    const db = new FalaeDb(name);
    await db.open();
    expect(isDbOutdated()).toBe(false);

    // A "newer app" in another tab opens a higher version.
    const newer = new Dexie(name);
    newer.version(2).stores({
      profile: 'id',
      settings: 'id',
      lessonProgress: 'lessonId',
      results: 'id, day, lessonId, finishedAt',
      srs: 'itemId, dueDay',
      daily: 'day',
      achievements: 'id',
      quarantine: '++id',
      userCards: 'id, updatedAt',
      mapProgress: 'mapId',
      planProgress: 'planId',
      extra: 'id',
    });
    await newer.open();

    expect(db.isOpen()).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(isDbOutdated()).toBe(true);
    newer.close();
    off();
  });
});
