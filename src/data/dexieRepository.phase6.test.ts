import { DexieRepository } from './dexieRepository';
import { onDataReplaced } from './events';
import { defaultProfile, type LessonResult, type SrsCard } from './models';
import type { AppliedCommit, CommitContext, LessonOutcome } from './repository';
import { applyOutcomes } from '../domain/srs/sm2';

const NOW = '2026-10-28T12:00:00.000Z';
const DAY = '2026-10-28';
let repo: DexieRepository;
let n = 0;

beforeEach(() => {
  repo = new DexieRepository({ dbName: `phase6-${++n}`, nowIso: () => NOW });
});
afterEach(() => {
  repo.close();
  vi.restoreAllMocks();
});

const result = (patch: Partial<LessonResult> = {}): LessonResult => ({
  id: crypto.randomUUID(),
  lessonId: 'u1-sk1-l1',
  kind: 'lesson',
  day: DAY,
  finishedAt: NOW,
  xp: 10,
  accuracy: 1,
  durationMs: 1000,
  mistakes: 0,
  perfect: true,
  itemOutcomes: [
    { itemId: 'a', q: 5 },
    { itemId: 'b', q: 4 },
    { itemId: 'c', q: 1 },
  ],
  ...patch,
});

/** Outcome whose apply runs SM-2 on the cards read inside the transaction. */
function outcome(
  r: LessonResult,
  extra: (ctx: CommitContext) => Partial<AppliedCommit<CommitContext>> = () => ({}),
): LessonOutcome<CommitContext> {
  return {
    result: r,
    profile: defaultProfile(NOW),
    srsCards: [],
    newAchievements: [],
    dailyGoalXp: 20,
    apply: (ctx) => ({
      profile: { ...ctx.profile, totalXp: ctx.profile.totalXp + r.xp },
      newAchievements: [],
      srsCards: applyOutcomes(ctx.srsCards, r.itemOutcomes, r.day),
      meta: ctx,
      ...extra(ctx),
    }),
  };
}

const card = (itemId: string, patch: Partial<SrsCard> = {}): SrsCard => ({
  itemId,
  ease: 2.5,
  intervalDays: 3,
  reps: 2,
  lapses: 0,
  dueDay: '2026-10-30',
  lastReviewDay: '2026-10-27',
  ...patch,
});

describe('commit with SRS (Fase 6)', () => {
  it('a lesson with 3 items creates 3 cards with result, daily and profile', async () => {
    await repo.recordLessonResult(outcome(result()));
    const cards = await repo.getSrsCards();
    expect(cards.map((c) => c.itemId).sort()).toEqual(['a', 'b', 'c']);
    expect(await repo.getRecentResults(5)).toHaveLength(1);
    expect((await repo.getProfile()).totalXp).toBe(10);
    expect(await repo.getDailyStats(DAY, DAY)).toHaveLength(1);
  });

  it('repeating the same commit changes nothing', async () => {
    const r = result();
    await repo.recordLessonResult(outcome(r));
    const before = await repo.getSrsCards();
    expect((await repo.recordLessonResult(outcome(r))).applied).toBe(false);
    expect(await repo.getSrsCards()).toEqual(before);
  });

  it('an invalid card rolls back the result and the profile', async () => {
    await expect(
      repo.recordLessonResult(outcome(result(), () => ({ srsCards: [card('a', { ease: 0.5 })] }))),
    ).rejects.toThrow();
    expect(await repo.getRecentResults(5)).toEqual([]);
    expect((await repo.getProfile()).totalXp).toBe(0);
    expect(await repo.getSrsCards()).toEqual([]);
  });

  it('hands only the session cards (plus extraItemIds) and counts to apply', async () => {
    await repo.upsertSrsCards([card('a'), card('z'), card('y', { reps: 0, intervalDays: 1 })]);
    await repo.importAll({
      ...(await repo.exportAll()),
      data: {
        ...(await repo.exportAll()).data,
        lessonProgress: [
          { lessonId: 'l1', completedCount: 1, bestAccuracy: 1, firstCompletedAt: NOW },
        ],
        daily: [
          { day: '2026-10-20', xp: 30, lessons: 1, goalMet: true },
          { day: '2026-10-21', xp: 5, lessons: 1, goalMet: false },
          { day: DAY, xp: 25, lessons: 1, goalMet: true },
        ],
      },
    });
    const saved = await repo.recordLessonResult({
      ...outcome(result()),
      extraItemIds: ['z', 'missing'],
    });
    if (!saved.applied || !saved.meta) throw new Error('not applied');
    const ctx = saved.meta;
    expect(ctx.srsCards.map((c) => c.itemId).sort()).toEqual(['a', 'z']);
    expect(ctx.wordsLearnedBefore).toBe(2);
    expect(ctx.goalMetCount).toBe(1);
    expect(ctx.goalMetToday).toBe(true);
    expect([...ctx.completedLessonIds]).toEqual(['l1']);
  });

  it('never reads the results table beyond the idempotency get', async () => {
    await repo.recordLessonResult(outcome(result()));
    const table = repo['db'].results; // test-only access to the private Dexie instance
    const spies = (
      ['toArray', 'toCollection', 'where', 'filter', 'orderBy', 'count', 'each'] as const
    ).map((m) => vi.spyOn(table, m));
    const get = vi.spyOn(table, 'get');
    await repo.recordLessonResult(outcome(result()));
    expect(get).toHaveBeenCalledTimes(1);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('placement writes no daily row', async () => {
    await repo.recordLessonResult(
      outcome(result({ kind: 'placement', lessonId: 'placement', xp: 0, itemOutcomes: [] })),
    );
    expect(await repo.getDailyStats('2026-01-01', '2026-12-31')).toEqual([]);
    expect(await repo.getRecentResults(1)).toHaveLength(1);
  });
});

describe('corrupted profile on commit (pendência 9.1)', () => {
  const corrupt = { id: 'me', totalXp: -5, hearts: 99 };

  it('moves the original row to quarantine and continues with the default', async () => {
    await repo['db'].profile.put(corrupt as never); // invalid on purpose
    await repo.recordLessonResult(outcome(result()));
    const q = await repo['db'].quarantine.toArray();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ table: 'profile', raw: corrupt });
    expect((await repo.getProfile()).totalXp).toBe(10);
  });

  it('a failing commit writes neither the quarantine nor the profile', async () => {
    await repo['db'].profile.put(corrupt as never); // invalid on purpose
    await expect(
      repo.recordLessonResult(outcome(result(), () => ({ srsCards: [card('a', { ease: 0 })] }))),
    ).rejects.toThrow();
    expect(await repo['db'].quarantine.count()).toBe(0);
    expect(await repo['db'].profile.get('me')).toEqual(corrupt);
  });
});

describe('updateProfile and resetAll', () => {
  it('updateProfile reads, mutates, validates and writes', async () => {
    const p = await repo.updateProfile((x) => ({ ...x, onboardingDone: true }));
    expect(p.onboardingDone).toBe(true);
    expect((await repo.getProfile()).onboardingDone).toBe(true);
    await expect(repo.updateProfile((x) => ({ ...x, hearts: 9 }))).rejects.toThrow();
    expect((await repo.getProfile()).hearts).toBe(5);
  });

  it('resetAll clears settings and quarantine and notifies the stores', async () => {
    const listener = vi.fn();
    const off = onDataReplaced(listener);
    await repo.saveSettings({ ...(await repo.getSettings()), dailyGoalXp: 50 });
    await repo['db'].quarantine.add({ table: 'profile', raw: {}, at: NOW, issues: [] });
    await repo.resetAll();
    off();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await repo.getSettings()).dailyGoalXp).toBe(20);
    expect(await repo['db'].quarantine.count()).toBe(0);
  });
});
