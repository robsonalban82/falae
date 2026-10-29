import { achievements, newlyUnlocked, type AchievementStats } from './achievements';

const zero: AchievementStats = {
  totalXp: 0,
  streakLongest: 0,
  lessonsCompleted: 0,
  unitsCompleted: 0,
  goalDaysMet: 0,
  wordsLearned: 0,
  last: { perfect: false, localHour: 12, kind: 'lesson' },
};
const none = new Set<string>();
const unlocks = (patch: Partial<AchievementStats>) => newlyUnlocked({ ...zero, ...patch }, none);

describe('achievements', () => {
  it('ids are unique', () => {
    expect(new Set(achievements.map((a) => a.id)).size).toBe(achievements.length);
  });

  it('nothing unlocks from zero', () => {
    expect(unlocks({})).toEqual([]);
  });

  it.each([
    ['first-lesson', { lessonsCompleted: 0 }, { lessonsCompleted: 1 }],
    ['streak-3', { streakLongest: 2 }, { streakLongest: 3 }],
    ['streak-7', { streakLongest: 6 }, { streakLongest: 7 }],
    ['streak-30', { streakLongest: 29 }, { streakLongest: 30 }],
    ['words-50', { wordsLearned: 49 }, { wordsLearned: 50 }],
    ['words-100', { wordsLearned: 99 }, { wordsLearned: 100 }],
    ['words-250', { wordsLearned: 249 }, { wordsLearned: 250 }],
    ['first-unit', { unitsCompleted: 0 }, { unitsCompleted: 1 }],
    ['goal-7', { goalDaysMet: 6 }, { goalDaysMet: 7 }],
    ['xp-500', { totalXp: 499 }, { totalXp: 500 }],
    ['xp-1000', { totalXp: 999 }, { totalXp: 1000 }],
    [
      'early-bird',
      { last: { ...zero.last, localHour: 8 } },
      { last: { ...zero.last, localHour: 7 } },
    ],
  ] as const)('%s unlocks exactly at the limit', (id, below, at) => {
    expect(unlocks(below)).not.toContain(id);
    expect(unlocks(at)).toContain(id);
  });

  it('perfect-lesson needs a perfect non-placement session', () => {
    expect(unlocks({ last: { ...zero.last, perfect: true } })).toContain('perfect-lesson');
    expect(unlocks({ last: { ...zero.last, perfect: true, kind: 'review' } })).toContain(
      'perfect-lesson',
    );
    expect(unlocks({ last: { ...zero.last, perfect: true, kind: 'placement' } })).not.toContain(
      'perfect-lesson',
    );
    expect(unlocks({ last: { ...zero.last, perfect: false } })).not.toContain('perfect-lesson');
  });

  it('already unlocked ones never repeat', () => {
    const stats = { ...zero, lessonsCompleted: 3, totalXp: 600 };
    expect(newlyUnlocked(stats, new Set(['first-lesson', 'xp-500']))).toEqual([]);
  });

  it('several can unlock at once (e.g. after importing a backup)', () => {
    expect(
      unlocks({ lessonsCompleted: 20, streakLongest: 8, totalXp: 1200, unitsCompleted: 1 }),
    ).toEqual(['first-lesson', 'streak-3', 'streak-7', 'first-unit', 'xp-500', 'xp-1000']);
  });
});
