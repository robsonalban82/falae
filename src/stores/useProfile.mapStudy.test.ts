import { repository } from '../data';
import { defaultProfile, type Profile } from '../data/models';
import { fixtureLookup, fixtureMap } from '../domain/mindmap/testFixture';
import {
  hideableChunks,
  initialRevealState,
  mapStudyLessonId,
  mapStudySummary,
  rate,
  reveal,
  toggleReveal,
  type RevealRating,
} from '../domain/mindmap/reveal';
import { newCard, review } from '../domain/srs/sm2';
import type { LessonSummary } from '../domain/lesson/engine';
import { clock } from '../services/clock';
import { useProfile, type SessionCommit } from './useProfile';

const MAP = 'mm-to-be';
const chunks = hideableChunks(fixtureMap, fixtureLookup);

/** Reveals every chunk; `ratings` maps chunk keys to an optional rating. */
function studied(ratings: Record<string, RevealRating> = {}): LessonSummary {
  let s = toggleReveal(initialRevealState());
  for (const c of chunks) s = reveal(s, c.key, chunks);
  for (const [key, r] of Object.entries(ratings)) s = rate(s, key, r, chunks);
  return mapStudySummary(s, chunks, clock.now() - 60_000, clock.now());
}

let runs = 0;
const mapSession = (summary: LessonSummary, startedAt = clock.now() + ++runs): SessionCommit => ({
  lessonId: mapStudyLessonId(MAP),
  kind: 'map',
  context: { mapId: MAP },
  startedAt,
  summary,
});

async function seed(patch: Partial<Profile> = {}) {
  await repository.saveProfile({ ...defaultProfile('2026-10-01T12:00:00.000Z'), ...patch });
  await useProfile.getState().load();
}
const commit = (s: SessionCommit) => useProfile.getState().commitSession(s, 10);
const today = () => clock.today();
const keyOf = (itemId: string) => chunks.find((c) => c.itemId === itemId)?.key ?? '';

beforeEach(async () => {
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
});
afterEach(() => clock.reset());

describe('useProfile.commitSession (map study)', () => {
  it('records mapProgress and earns 5 XP, with the deterministic id map:<mapId>-<startedAt>', async () => {
    await seed();
    const session = mapSession(studied(), 1_000);
    const saved = await commit(session);
    expect(saved.result).toMatchObject({
      id: `map:${MAP}-1000`,
      lessonId: `map:${MAP}`,
      kind: 'map',
      context: { mapId: MAP },
      xp: 5,
    });
    expect((await repository.getProfile()).totalXp).toBe(5);
    expect((await repository.getDailyStats(today(), today()))[0]?.xp).toBe(5);
    expect(await repository.getMapProgress()).toEqual([
      expect.objectContaining({ mapId: MAP, timesStudied: 1, lastStudiedDay: today() }),
    ]);
  });

  it('a second study on the same day earns 0 XP and counts timesStudied 2', async () => {
    await seed();
    expect((await commit(mapSession(studied()))).result.xp).toBe(5);
    expect((await commit(mapSession(studied()))).result.xp).toBe(0);
    expect((await repository.getProfile()).totalXp).toBe(5);
    expect((await repository.getMapProgress())[0]?.timesStudied).toBe(2);
  });

  it('the next day earns 5 XP again', async () => {
    await seed();
    await commit(mapSession(studied()));
    clock.setNow('2026-10-30T12:00:00');
    expect((await commit(mapSession(studied()))).result.xp).toBe(5);
  });

  it('"practice this map" first, then a map study the same day: 0 XP (ADR-018 c)', async () => {
    await seed();
    await commit({
      lessonId: `map-practice:${MAP}`,
      kind: 'practice',
      context: { mapId: MAP },
      startedAt: clock.now(),
      summary: { ...studied(), xp: 10, itemOutcomes: [] },
    });
    const before = (await repository.getProfile()).totalXp;
    expect((await commit(mapSession(studied()))).result.xp).toBe(0);
    expect((await repository.getProfile()).totalXp).toBe(before);
  });

  it('never moves hearts (neither gains nor spends)', async () => {
    await seed({ hearts: 3, heartsUpdatedAt: clock.iso() });
    const saved = await commit(mapSession(studied()));
    expect(saved.heartGained).toBe(false);
    expect((await repository.getProfile()).hearts).toBe(3);
  });

  it('"Lembrei" becomes q 4 and "Não lembrei" q 1 in the SrsCard', async () => {
    await seed();
    await commit(
      mapSession(studied({ [keyOf('xa-happy')]: 'remembered', [keyOf('u1-im')]: 'forgot' })),
    );
    const cards = await repository.getSrsCards();
    const byId = (id: string) => cards.find((c) => c.itemId === id);
    expect(byId('xa-happy')).toEqual(review(newCard('xa-happy', today()), 4, today()));
    expect(byId('u1-im')).toEqual(review(newCard('u1-im', today()), 1, today()));
  });

  it('a line without a rating creates no SrsCard', async () => {
    await seed();
    await commit(mapSession(studied({ [keyOf('xa-happy')]: 'remembered' })));
    expect((await repository.getSrsCards()).map((c) => c.itemId)).toEqual(['xa-happy']);
    await commit(mapSession(studied()));
    expect((await repository.getSrsCards()).map((c) => c.itemId)).toEqual(['xa-happy']);
  });

  it('re-committing the same run (same id) adds nothing', async () => {
    await seed();
    const session = mapSession(studied({ [keyOf('xa-happy')]: 'remembered' }), 2_000);
    expect((await commit(session)).result.xp).toBe(5);
    const again = await commit(session);
    expect(again.result.xp).toBe(0);
    expect(again.streak).toBeNull();
    expect((await repository.getProfile()).totalXp).toBe(5);
    expect((await repository.getMapProgress())[0]?.timesStudied).toBe(1);
    expect(await repository.getRecentResults(10)).toHaveLength(1);
  });

  it('counts as study: the streak starts with the first map of the day', async () => {
    await seed();
    const saved = await commit(mapSession(studied()));
    expect(saved.streak?.increased).toBe(true);
    expect((await repository.getProfile()).streak.current).toBe(1);
  });
});
