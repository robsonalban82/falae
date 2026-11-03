import {
  finalSessionXp,
  sessionCompletesLesson,
  sessionCountsAsStudy,
  sessionGainsHeart,
  sessionProvesAccuracy,
  sessionStudiesMap,
  sessionUsesHearts,
  sessionXp,
  type SessionKind,
} from './xp';

describe('sessionXp', () => {
  it.each([
    ['lesson', false, 0, 10],
    ['lesson', true, 2, 17],
    ['lesson', true, 99, 20],
    ['review', true, 0, 20],
    ['practice', false, 1, 9],
    ['placement', true, 5, 0],
    ['cards', false, 0, 8],
    ['cards', true, 3, 16],
    ['cards', true, 99, 18],
    ['map', false, 0, 5],
    ['map', true, 5, 5], // no bonuses
  ] as const)('%s perfect=%s combo=%s → %s', (kind, perfect, combo, xp) => {
    expect(sessionXp(kind, perfect, combo)).toBe(xp);
  });
});

describe('finalSessionXp', () => {
  it('a map earns XP only the first time per day; other kinds are untouched', () => {
    expect(finalSessionXp('map', 5, undefined, '2026-10-29')).toBe(5);
    expect(finalSessionXp('map', 5, '2026-10-28', '2026-10-29')).toBe(5);
    expect(finalSessionXp('map', 5, '2026-10-29', '2026-10-29')).toBe(0);
    expect(finalSessionXp('map', 5, '2026-10-30', '2026-10-29')).toBe(0); // clock went back
    expect(finalSessionXp('practice', 8, '2026-10-29', '2026-10-29')).toBe(8);
    expect(finalSessionXp('cards', 8, '2026-10-29', '2026-10-29')).toBe(8);
  });
});

describe('session kind rules', () => {
  const kinds: SessionKind[] = ['lesson', 'review', 'practice', 'placement', 'cards', 'map'];
  const table = (f: (k: SessionKind) => boolean) => kinds.filter(f);

  it('hearts are spent only in lesson/review and gained only in practice', () => {
    expect(table(sessionUsesHearts)).toEqual(['lesson', 'review']);
    expect(table(sessionGainsHeart)).toEqual(['practice']);
  });
  it('everything but placement counts as study (streak, goal, daily)', () => {
    expect(table(sessionCountsAsStudy)).toEqual(['lesson', 'review', 'practice', 'cards', 'map']);
  });
  it('lessonProgress only for lesson/review; mapProgress for map/practice', () => {
    expect(table(sessionCompletesLesson)).toEqual(['lesson', 'review']);
    expect(table(sessionStudiesMap)).toEqual(['practice', 'map']);
  });
  it('only graded sessions prove accuracy', () => {
    expect(table(sessionProvesAccuracy)).toEqual(['lesson', 'review', 'practice']);
  });
});
