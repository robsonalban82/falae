import { repository } from '../data';
import { defaultProfile, type Profile } from '../data/models';
import type { Exercise } from '../content/schema';
import { startLesson, type LessonSummary } from '../domain/lesson/engine';
import type { SessionKind } from '../domain/gamification/xp';
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

const summary = (xp: number, patch: Partial<LessonSummary> = {}): LessonSummary => ({
  xp,
  accuracy: 1,
  durationMs: 1000,
  mistakes: 0,
  perfect: true,
  itemOutcomes: [{ itemId: 'u1-hi', q: 5 }],
  ...patch,
});

let runs = 0;
/** `startedAt` (nowMs) differs per call so each run gets its own result id. */
const session = (kind: SessionKind, context?: { mapId?: string; deckKey?: string }) =>
  startLesson({
    lessonId: `${kind}:x`,
    kind,
    exercises: [exercise],
    hearts: 5,
    nowMs: clock.now() + ++runs,
    ...(context ? { context } : {}),
  });

async function seed(patch: Partial<Profile> = {}) {
  await repository.saveProfile({ ...defaultProfile('2026-10-01T12:00:00.000Z'), ...patch });
  await useProfile.getState().load();
}
const today = () => clock.today();
const dailyToday = async () => (await repository.getDailyStats(today(), today()))[0];
const ids = async () => (await repository.getAchievements()).map((a) => a.id);

beforeEach(async () => {
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
});
afterEach(() => clock.reset());

describe('useProfile.commitLesson by session kind', () => {
  it('map: 5 XP the first time per day, 0 after; result and totals agree', async () => {
    await seed();
    const ctx = { mapId: 'mm-to-be' };
    const first = await useProfile.getState().commitLesson(session('map', ctx), summary(5), 10);
    const second = await useProfile.getState().commitLesson(session('map', ctx), summary(5), 10);
    expect(first.result.xp).toBe(5);
    expect(second.result.xp).toBe(0);
    expect((await repository.getProfile()).totalXp).toBe(5);
    expect((await dailyToday())?.xp).toBe(5);
    expect((await repository.getMapProgress())[0]).toMatchObject({ timesStudied: 2 });
  });

  it('two concurrent map commits (two tabs): 5 XP in total (ADR-008)', async () => {
    await seed();
    const ctx = { mapId: 'mm-to-be' };
    await Promise.all([
      useProfile.getState().commitLesson(session('map', ctx), summary(5), 10),
      useProfile.getState().commitLesson(session('map', ctx), summary(5), 10),
    ]);
    expect((await repository.getProfile()).totalXp).toBe(5);
    expect((await dailyToday())?.xp).toBe(5);
    expect((await repository.getMapProgress())[0]?.timesStudied).toBe(2);
  });

  it('cards/map count for streak and goal but never move hearts or light practice achievements', async () => {
    await seed({ hearts: 0, heartsUpdatedAt: clock.iso() });
    const c = await useProfile
      .getState()
      .commitLesson(session('cards', { deckKey: 'frases' }), summary(8), 10);
    const m = await useProfile
      .getState()
      .commitLesson(session('map', { mapId: 'mm-1' }), summary(5), 10);
    expect(c.heartGained).toBe(false);
    expect(m.heartGained).toBe(false);
    expect(c.streak).toMatchObject({ increased: true });
    expect((await repository.getProfile()).hearts).toBe(0);
    expect((await dailyToday())?.goalMet).toBe(true); // 8 + 5 >= 10
    expect(await ids()).not.toContain('persistent');
    expect(await ids()).not.toContain('perfect-lesson');
    expect((await repository.getLessonProgress()).length).toBe(0);
  });

  it('practice with a mapId: +1 heart, upserts mapProgress, persistent still lights at 0 hearts', async () => {
    await seed({ hearts: 0, heartsUpdatedAt: clock.iso() });
    const out = await useProfile
      .getState()
      .commitLesson(session('practice', { mapId: 'mm-to-be' }), summary(8), 10);
    expect(out.heartGained).toBe(true);
    expect((await repository.getProfile()).hearts).toBe(1);
    expect(await ids()).toEqual(expect.arrayContaining(['persistent', 'perfect-lesson']));
    expect((await repository.getMapProgress())[0]).toMatchObject({
      mapId: 'mm-to-be',
      timesStudied: 1,
    });
  });
});
