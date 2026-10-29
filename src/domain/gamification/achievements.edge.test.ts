import { describe, expect, it } from 'vitest';
import { achievements, newlyUnlocked, type AchievementStats } from './achievements';

const base: AchievementStats = {
  totalXp: 0,
  streakLongest: 0,
  lessonsCompleted: 0,
  unitsCompleted: 0,
  goalDaysMet: 0,
  wordsLearned: 0,
  last: { perfect: false, localHour: 12, kind: 'lesson' },
};

describe('achievements edge cases', () => {
  it('ids are unique and kebab-case', () => {
    const ids = achievements.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('fresh empty stats unlock nothing', () => {
    expect(newlyUnlocked(base, new Set())).toEqual([]);
  });
  it('perfect placement does not unlock perfect-lesson', () => {
    expect(
      newlyUnlocked(
        { ...base, last: { ...base.last, perfect: true, kind: 'placement' } },
        new Set(),
      ),
    ).not.toContain('perfect-lesson');
  });
  it('early-bird boundary: 7 yes, 8 no, 0 (midnight) yes', () => {
    const at = (h: number) =>
      newlyUnlocked({ ...base, last: { ...base.last, localHour: h } }, new Set());
    expect(at(7)).toContain('early-bird');
    expect(at(8)).not.toContain('early-bird');
    expect(at(0)).toContain('early-bird');
  });
  it('imported backup with huge totals unlocks all at once in definition order, minus already', () => {
    const big = {
      ...base,
      totalXp: 5000,
      streakLongest: 40,
      lessonsCompleted: 50,
      unitsCompleted: 4,
      goalDaysMet: 10,
      wordsLearned: 300,
      last: { perfect: true, localHour: 6, kind: 'lesson' as const },
    };
    const all = newlyUnlocked(big, new Set());
    expect(all).toEqual(achievements.map((a) => a.id));
    expect(newlyUnlocked(big, new Set(all))).toEqual([]);
    expect(newlyUnlocked(big, new Set(['unknown-old-id']))).toHaveLength(all.length);
  });
});
