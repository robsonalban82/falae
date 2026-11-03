import { DexieRepository } from './dexieRepository';
import { defaultProfile, MAX_USER_CARDS, type LessonResult, type UserCard } from './models';
import { UserCardLimitError, type LessonOutcome } from './repository';
import { finalSessionXp } from '../domain/gamification/xp';

const NOW = '2026-10-29T12:00:00.000Z';
const DAY = '2026-10-29';
let repo: DexieRepository;
let n = 0;

beforeEach(() => {
  repo = new DexieRepository({ dbName: `maps-cards-${++n}`, nowIso: () => NOW });
});
afterEach(() => repo.close());

const card = (id: string, patch: Partial<UserCard> = {}): UserCard => ({
  id,
  en: 'good morning',
  pt: 'bom dia',
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});
const cardId = (i: number) => `uc-card${String(i).padStart(4, '0')}`;

const result = (patch: Partial<LessonResult> = {}): LessonResult => ({
  id: crypto.randomUUID(),
  lessonId: 'map:mm-to-be',
  kind: 'map',
  day: DAY,
  finishedAt: NOW,
  xp: 5,
  accuracy: 1,
  durationMs: 1000,
  mistakes: 0,
  perfect: true,
  itemOutcomes: [],
  context: { mapId: 'mm-to-be' },
  ...patch,
});

/** Commit with an `apply` that, like the real one, decides XP from the fresh mapProgress. */
function commit(r: LessonResult): Promise<unknown> {
  const outcome: LessonOutcome = {
    result: r,
    profile: defaultProfile(NOW),
    srsCards: [],
    newAchievements: [],
    dailyGoalXp: 20,
    apply: (ctx) => {
      const xp = finalSessionXp(r.kind, r.xp, ctx.mapProgress?.lastStudiedDay, r.day);
      return {
        profile: {
          ...ctx.profile,
          totalXp: ctx.profile.totalXp + xp,
        },
        newAchievements: [],
        srsCards: [],
        xp,
        meta: undefined,
      };
    },
  };
  return repo.recordLessonResult(outcome);
}
const dailyOf = async (day = DAY) => (await repo.getDailyStats(day, day))[0];

describe('user cards', () => {
  it('lists newest edit first, saves (upsert) and validates', async () => {
    await repo.saveUserCard(card('uc-aaaaaaaa', { updatedAt: '2026-10-01T00:00:00.000Z' }));
    await repo.saveUserCard(card('uc-bbbbbbbb', { updatedAt: '2026-10-02T00:00:00.000Z' }));
    expect((await repo.listUserCards()).map((c) => c.id)).toEqual(['uc-bbbbbbbb', 'uc-aaaaaaaa']);
    await repo.saveUserCard(card('uc-aaaaaaaa', { pt: 'oi', updatedAt: NOW }));
    const list = await repo.listUserCards();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: 'uc-aaaaaaaa', pt: 'oi' });
    expect(await repo.countUserCards()).toBe(2);
    await expect(repo.saveUserCard(card('uc-cccccccc', { en: 'a|b' }))).rejects.toThrow();
    await expect(repo.saveUserCard(card('bad-id'))).rejects.toThrow();
    expect(await repo.countUserCards()).toBe(2);
  });

  it('limit of 500: the 501st new card is refused, editing an existing one still works', async () => {
    for (let i = 0; i < MAX_USER_CARDS; i++) await repo.saveUserCard(card(cardId(i)));
    await expect(repo.saveUserCard(card(cardId(MAX_USER_CARDS)))).rejects.toBeInstanceOf(
      UserCardLimitError,
    );
    await repo.saveUserCard(card(cardId(0), { pt: 'editado' }));
    expect(await repo.countUserCards()).toBe(MAX_USER_CARDS);
  }, 30_000);

  it('deleteUserCard removes the card and its SrsCard (no orphan)', async () => {
    await repo.saveUserCard(card('uc-aaaaaaaa'));
    await repo.saveUserCard(card('uc-bbbbbbbb'));
    const srs = (itemId: string) => ({
      itemId,
      ease: 2.5,
      intervalDays: 1,
      reps: 1,
      lapses: 0,
      dueDay: DAY,
      lastReviewDay: DAY,
    });
    await repo.upsertSrsCards([srs('uc-aaaaaaaa'), srs('uc-bbbbbbbb'), srs('u1-hi')]);
    await repo.deleteUserCard('uc-aaaaaaaa');
    expect((await repo.listUserCards()).map((c) => c.id)).toEqual(['uc-bbbbbbbb']);
    expect((await repo.getSrsCards()).map((c) => c.itemId).sort()).toEqual([
      'u1-hi',
      'uc-bbbbbbbb',
    ]);
    await repo.deleteUserCard('uc-zzzzzzzz'); // unknown id: no-op
  });
});

describe('plan progress', () => {
  it('saves, reads by id and validates', async () => {
    expect(await repo.getPlanProgress('plan-30')).toBeUndefined();
    const p = { planId: 'plan-30', startedDay: DAY, manualDone: [1, 2] };
    await repo.savePlanProgress(p);
    expect(await repo.getPlanProgress('plan-30')).toEqual(p);
    await expect(repo.savePlanProgress({ ...p, manualDone: [1, 1] })).rejects.toThrow();
  });
});

describe('commit: maps and cards', () => {
  it('an invalid stored mapProgress row goes to quarantine and the map counts as never studied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const raw = { mapId: 'mm-to-be', timesStudied: 'many' };
    // Write the bad row straight into the table (what a corrupt store would look like).
    const { FalaeDb } = await import('./db');
    const db = new FalaeDb(`maps-cards-${n}`);
    await db.table('mapProgress').put(raw);
    db.close();
    await commit(result());
    expect((await repo.getMapProgress())[0]).toMatchObject({ mapId: 'mm-to-be', timesStudied: 1 });
    const db2 = new FalaeDb(`maps-cards-${n}`);
    const q = await db2.quarantine.toArray();
    db2.close();
    expect(q).toMatchObject([{ table: 'mapProgress', raw }]);
    expect((await dailyOf())?.xp).toBe(5);
  });

  it('map twice the same day = 5 + 0 XP, timesStudied 2, daily and profile agree', async () => {
    await commit(result());
    await commit(result());
    expect(await repo.getMapProgress()).toEqual([
      { mapId: 'mm-to-be', firstStudiedAt: NOW, lastStudiedDay: DAY, timesStudied: 2 },
    ]);
    expect((await dailyOf())?.xp).toBe(5);
    expect((await repo.getProfile()).totalXp).toBe(5);
    const xps = (await repo.getRecentResults(10)).map((r) => r.xp);
    expect(xps.sort()).toEqual([0, 5]); // the stored result carries the final XP
  });

  it('map on another day earns 5 again', async () => {
    await commit(result());
    await commit(result({ day: '2026-10-30' }));
    expect((await dailyOf('2026-10-30'))?.xp).toBe(5);
    expect((await repo.getMapProgress())[0]).toMatchObject({
      lastStudiedDay: '2026-10-30',
      timesStudied: 2,
    });
  });

  it('a different map is independent', async () => {
    await commit(result());
    await commit(result({ context: { mapId: 'mm-other' } }));
    expect((await dailyOf())?.xp).toBe(10);
    expect(await repo.getMapProgress()).toHaveLength(2);
  });

  it('two concurrent map commits (two tabs) add up exactly once (ADR-008)', async () => {
    await Promise.all([commit(result()), commit(result())]);
    expect((await repo.getMapProgress())[0]?.timesStudied).toBe(2);
    expect((await dailyOf())?.xp).toBe(5);
    expect((await repo.getProfile()).totalXp).toBe(5);
    expect((await dailyOf())?.lessons).toBe(2);
  });

  it('a clock that went back does not move lastStudiedDay backwards', async () => {
    await commit(result({ day: '2026-10-30' }));
    await commit(result({ day: DAY }));
    expect((await repo.getMapProgress())[0]?.lastStudiedDay).toBe('2026-10-30');
  });

  it('practice with a mapId upserts mapProgress', async () => {
    await commit(
      result({
        kind: 'practice',
        xp: 8,
        lessonId: 'map-practice:mm-to-be',
        context: { mapId: 'mm-to-be' },
      }),
    );
    expect(await repo.getMapProgress()).toMatchObject([{ mapId: 'mm-to-be', timesStudied: 1 }]);
    expect(await repo.getLessonProgress()).toHaveLength(0);
  });

  it('cards sum distinct cards into daily.cards, never write lessonProgress or mapProgress', async () => {
    const outcomes = (ids: string[]) => ids.map((itemId) => ({ itemId, q: 4 }));
    const base = {
      kind: 'cards' as const,
      xp: 8,
      lessonId: 'deck:frases',
      context: { deckKey: 'frases' },
    };
    await commit(result({ ...base, itemOutcomes: outcomes(['fr-001', 'fr-002', 'fr-001']) }));
    expect((await dailyOf())?.cards).toBe(2);
    await commit(result({ ...base, itemOutcomes: outcomes(['fr-003']) }));
    expect(await dailyOf()).toMatchObject({ cards: 3, xp: 16, lessons: 2 });
    expect(await repo.getLessonProgress()).toHaveLength(0);
    expect(await repo.getMapProgress()).toEqual([]);
  });

  it('non-cards sessions leave daily.cards absent', async () => {
    await commit(result());
    expect(await dailyOf()).not.toHaveProperty('cards');
  });

  it('cards and map count for the daily goal', async () => {
    await commit(result({ kind: 'cards', xp: 8, context: { deckKey: 'd' } }));
    await commit(result({ xp: 5 }));
    expect((await dailyOf())?.goalMet).toBe(false);
    await commit(result({ kind: 'cards', xp: 8, context: { deckKey: 'd' } }));
    expect(await dailyOf()).toMatchObject({ xp: 21, goalMet: true });
  });
});
