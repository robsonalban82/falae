import { repository } from '../data';
import { defaultProfile, type Profile } from '../data/models';
import type { Exercise } from '../content/schema';
import { startLesson, type LessonSummary } from '../domain/lesson/engine';
import { clock } from '../services/clock';
import { useProfile } from './useProfile';

const exercise: Exercise = {
  id: 'x1',
  type: 'multiple-choice',
  itemIds: ['u1-hi'],
  prompt: 'p',
  options: [{ text: 'hi' }, { text: 'bye' }, { text: 'good morning' }],
  answer: 'hi',
};

const summary = (patch: Partial<LessonSummary> = {}): LessonSummary => ({
  xp: 15,
  accuracy: 1,
  durationMs: 60_000,
  mistakes: 0,
  perfect: true,
  itemOutcomes: [{ itemId: 'u1-hi', q: 5 }],
  ...patch,
});

const lesson = (lessonId = 'u1-sk1-l1', kind: 'lesson' | 'placement' = 'lesson') =>
  startLesson({ lessonId, kind, exercises: [exercise], hearts: 5, nowMs: clock.now() });

async function seedProfile(patch: Partial<Profile> = {}) {
  const profile = { ...defaultProfile('2026-10-01T12:00:00.000Z'), ...patch };
  await repository.saveProfile(profile);
  await useProfile.getState().load();
}

beforeEach(async () => {
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
});
afterEach(() => {
  clock.reset();
  vi.restoreAllMocks();
});

describe('useProfile.commitLesson', () => {
  it('writes result, daily, streak, goal and achievements together', async () => {
    await seedProfile();
    const out = await useProfile.getState().commitLesson(lesson(), summary(), 10);

    expect(out.streak).toMatchObject({ event: 'first', increased: true });
    expect(out.goal).toEqual({
      progress: { xp: 15, goal: 10, ratio: 1, met: true },
      celebrate: true,
    });
    expect(out.newAchievements).toEqual(['first-lesson', 'perfect-lesson']);

    const stored = await repository.getProfile();
    expect(stored).toMatchObject({
      totalXp: 15,
      lastGoalCelebratedDay: '2026-10-29',
      streak: { current: 1, longest: 1, lastActiveDay: '2026-10-29', xpTowardFreeze: 15 },
    });
    expect(await repository.getDailyStats('2026-10-29', '2026-10-29')).toEqual([
      { day: '2026-10-29', xp: 15, lessons: 1, goalMet: true },
    ]);
    expect((await repository.getAchievements()).map((a) => a.id).sort()).toEqual([
      'first-lesson',
      'perfect-lesson',
    ]);
    expect(useProfile.getState().profile).toEqual(stored);
  });

  it('second lesson the same day: no new celebration, no repeated achievements', async () => {
    await seedProfile();
    await useProfile.getState().commitLesson(lesson(), summary(), 10);
    clock.advance(60_000);
    const out = await useProfile.getState().commitLesson(lesson('u1-sk1-l2'), summary(), 10);
    expect(out.goal.celebrate).toBe(false);
    expect(out.newAchievements).toEqual([]);
    expect(out.streak?.event).toBe('sameDay');
    expect((await repository.getProfile()).totalXp).toBe(30);
  });

  it('next day with a missed day uses a freeze', async () => {
    await seedProfile({
      streak: {
        current: 2,
        longest: 2,
        lastActiveDay: '2026-10-27',
        freezes: 1,
        xpTowardFreeze: 0,
      },
    });
    const out = await useProfile.getState().commitLesson(lesson(), summary(), 20);
    expect(out.streak).toMatchObject({ event: 'frozen', freezeUsed: true });
    expect((await repository.getProfile()).streak).toMatchObject({ current: 3, freezes: 0 });
  });

  it('placement does not touch streak or goal', async () => {
    await seedProfile();
    const out = await useProfile
      .getState()
      .commitLesson(lesson('u1-sk1-l1', 'placement'), summary({ xp: 0 }), 10);
    expect(out.streak).toBeNull();
    expect(out.goal.celebrate).toBe(false);
    expect((await repository.getProfile()).streak.lastActiveDay).toBeUndefined();
  });

  it('early-bird uses the local hour from the clock', async () => {
    clock.setNow('2026-10-29T07:30:00');
    await seedProfile();
    const out = await useProfile.getState().commitLesson(lesson(), summary({ perfect: false }), 50);
    expect(out.newAchievements).toContain('early-bird');
  });

  it('an invalid outcome writes nothing', async () => {
    await seedProfile();
    const before = useProfile.getState().profile;
    await expect(
      useProfile.getState().commitLesson(lesson(), summary({ accuracy: 1.5 }), 10),
    ).rejects.toThrow();
    expect(await repository.getRecentResults(10)).toEqual([]);
    expect(await repository.getAchievements()).toEqual([]);
    expect(await repository.getDailyStats('2026-10-29', '2026-10-29')).toEqual([]);
    expect((await repository.getProfile()).totalXp).toBe(0);
    expect(useProfile.getState().profile).toEqual(before);
  });

  it('repeating the same commit does not duplicate anything and reloads the stored profile', async () => {
    await seedProfile();
    const state = lesson();
    await useProfile.getState().commitLesson(state, summary(), 10);
    const out = await useProfile.getState().commitLesson(state, summary(), 10);
    expect(out).toMatchObject({ streak: null, newAchievements: [], goal: { celebrate: false } });
    expect(await repository.getRecentResults(10)).toHaveLength(1);
    const stored = await repository.getProfile();
    expect(stored.totalXp).toBe(15);
    expect(useProfile.getState().profile).toEqual(stored);
    expect(await repository.getAchievements()).toHaveLength(2);
  });

  it('two concurrent commits of different runs both count (fresh reads inside the transaction)', async () => {
    await seedProfile();
    const a = lesson('u1-sk1-l1');
    const b = { ...lesson('u1-sk1-l2'), startedAt: a.startedAt + 1 };
    await Promise.all([
      useProfile.getState().commitLesson(a, summary(), 50),
      useProfile.getState().commitLesson(b, summary(), 50),
    ]);
    const stored = await repository.getProfile();
    expect(stored.totalXp).toBe(30);
    expect(stored.streak.xpTowardFreeze).toBe(30);
    expect(await repository.getRecentResults(10)).toHaveLength(2);
    expect((await repository.getDailyStats('2026-10-29', '2026-10-29'))[0]?.xp).toBe(30);
  });

  it('a stale store profile does not overwrite what another tab saved', async () => {
    await seedProfile();
    // Another tab saved more XP meanwhile; this store still holds the old profile.
    await repository.saveProfile({ ...(await repository.getProfile()), totalXp: 100 });
    await useProfile.getState().commitLesson(lesson(), summary(), 50);
    expect((await repository.getProfile()).totalXp).toBe(115);
    expect(useProfile.getState().profile.totalXp).toBe(115);
  });

  it('clock went back: no goal celebration and no new goalMet day', async () => {
    await seedProfile({
      streak: {
        current: 3,
        longest: 3,
        lastActiveDay: '2026-10-30',
        freezes: 0,
        xpTowardFreeze: 0,
      },
    });
    const out = await useProfile.getState().commitLesson(lesson(), summary(), 10);
    expect(out.streak?.event).toBe('clockBack');
    expect(out.goal.celebrate).toBe(false);
    expect((await repository.getDailyStats('2026-10-29', '2026-10-29'))[0]?.goalMet).toBe(false);
  });

  it('reloads by itself after importAll replaces the data', async () => {
    await seedProfile();
    const file = await repository.exportAll();
    await repository.importAll({
      ...file,
      data: { ...file.data, profile: { ...file.data.profile, totalXp: 777 } },
    });
    await vi.waitFor(() => expect(useProfile.getState().profile.totalXp).toBe(777));
  });
});
