import { getCourseManifest } from '../content/loader';
import { repository } from '../data';
import { defaultProfile } from '../data/models';
import { clock } from '../services/clock';
import { saveSession, loadSession, clearSession } from '../features/lesson/sessionStore';
import { buildMapPracticeSession, mapPracticeLessonId } from './usePractice';
import { useProfile } from './useProfile';

const MAP = 'mm-to-be';
const caps = { tts: false, stt: false, speakDisabled: true };

beforeEach(async () => {
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
  clearSession();
});
afterEach(() => clock.reset());

describe('buildMapPracticeSession', () => {
  it('builds a practice session only with the map items, context.mapId and no listen-type without TTS', async () => {
    const ids = new Set(getCourseManifest().maps.find((m) => m.id === MAP)?.itemIds);
    const s = await buildMapPracticeSession(MAP, caps);
    expect(s).not.toBeNull();
    expect(s?.kind).toBe('practice');
    expect(s?.lessonId).toBe(mapPracticeLessonId(MAP));
    expect(s?.context).toEqual({ mapId: MAP });
    const used = s?.exercises.flatMap((e) => e.itemIds) ?? [];
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((id) => ids.has(id))).toBe(true);
    expect(s?.exercises.some((e) => e.type === 'listen-type')).toBe(false);
  });

  it('returns null for an unknown map', async () => {
    expect(await buildMapPracticeSession('nope', caps)).toBeNull();
  });

  it('keeps context.mapId across a reload and the commit records mapProgress and +1 heart', async () => {
    const s = await buildMapPracticeSession(MAP, caps);
    if (!s) throw new Error('no session');
    saveSession(s);
    const resumed = loadSession(mapPracticeLessonId(MAP));
    expect(resumed?.context).toEqual({ mapId: MAP });

    await repository.saveProfile({
      ...defaultProfile(clock.iso()),
      hearts: 3,
      heartsUpdatedAt: clock.iso(),
    });
    await useProfile.getState().load();
    const saved = await useProfile.getState().commitSession(
      {
        lessonId: s.lessonId,
        kind: 'practice',
        context: resumed?.context,
        startedAt: clock.now(),
        summary: {
          xp: 10,
          accuracy: 1,
          durationMs: 1000,
          mistakes: 0,
          itemOutcomes: [],
          perfect: true,
        },
      },
      10,
    );
    expect(saved.heartGained).toBe(true);
    expect((await repository.getProfile()).hearts).toBe(4);
    expect((await repository.getMapProgress()).map((m) => m.mapId)).toContain(MAP);
  });
});
