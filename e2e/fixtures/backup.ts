/**
 * A coherent backup file for import E2E/screenshots (Phase 7): total XP = sum of results,
 * daily = results grouped by day, streak matches the active days, SRS cards only for items
 * practiced in those results (all real unit-1 items), lesson progress = completed lessons.
 */
const results = [
  { lessonId: 'u1-sk1-l1', day: '2026-10-18', xp: 15, items: ['u1-hi', 'u1-bye'] },
  { lessonId: 'u1-sk1-l2', day: '2026-10-19', xp: 15, items: ['u1-good-morning'] },
  { lessonId: 'u1-sk1-l3', day: '2026-10-19', xp: 12, items: ['u1-good-afternoon'] },
];

export const backupTotals = {
  xp: results.reduce((n, r) => n + r.xp, 0), // 42
  lessons: results.length,
  streak: 2,
  achievements: 1,
  cards: results.flatMap((r) => r.items).length,
};

export function coherentBackup(settings: unknown) {
  const days = [...new Set(results.map((r) => r.day))];
  return {
    app: 'falae',
    schemaVersion: 1,
    exportedAt: '2026-10-20T15:00:00.000Z',
    data: {
      profile: {
        id: 'me',
        createdAt: '2026-10-18T12:00:00.000Z',
        onboardingDone: true,
        totalXp: backupTotals.xp,
        hearts: 5,
        heartsUpdatedAt: '2026-10-19T20:00:00.000Z',
        streak: {
          current: days.length,
          longest: days.length,
          freezes: 0,
          xpTowardFreeze: backupTotals.xp,
          lastActiveDay: days.at(-1),
        },
      },
      settings,
      lessonProgress: results.map((r) => ({
        lessonId: r.lessonId,
        completedCount: 1,
        bestAccuracy: 1,
        firstCompletedAt: `${r.day}T19:00:00.000Z`,
      })),
      results: results.map((r, i) => ({
        id: `${r.lessonId}-${i}`,
        lessonId: r.lessonId,
        kind: 'lesson',
        day: r.day,
        finishedAt: `${r.day}T19:0${i}:00.000Z`,
        xp: r.xp,
        accuracy: 1,
        durationMs: 120_000,
        mistakes: 0,
        perfect: true,
        itemOutcomes: r.items.map((itemId) => ({ itemId, q: 5 })),
      })),
      srs: results.flatMap((r) =>
        r.items.map((itemId) => ({
          itemId,
          ease: 2.6,
          intervalDays: 1,
          reps: 1,
          lapses: 0,
          dueDay: '2026-10-20',
          lastReviewDay: r.day,
        })),
      ),
      daily: days.map((day) => {
        const ofDay = results.filter((r) => r.day === day);
        const xp = ofDay.reduce((n, r) => n + r.xp, 0);
        return { day, xp, lessons: ofDay.length, goalMet: xp >= 20 };
      }),
      achievements: [{ id: 'first-lesson', unlockedAt: '2026-10-18T19:00:00.000Z' }],
    },
  };
}
