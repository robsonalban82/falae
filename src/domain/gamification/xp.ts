/** XP rules (docs/ARQUITETURA.md §8, docs/MAPAS-E-CARTAS.md §4.5). */

export type SessionKind = 'lesson' | 'review' | 'practice' | 'placement' | 'cards' | 'map';

export const PERFECT_BONUS = 5;
export const COMBO_STEP = 5;
export const MAX_COMBO_BONUS = 5;
export const MAP_STUDY_XP = 5;

function assertNever(value: never): never {
  throw new Error(`Unhandled session kind: ${String(value)}`);
}

/** Provisional XP of a finished session (the commit may lower a `map` to 0, see `finalSessionXp`). */
export function sessionXp(kind: SessionKind, perfect: boolean, comboBonus: number): number {
  const bonus = Math.min(MAX_COMBO_BONUS, Math.max(0, comboBonus));
  const withBonuses = (base: number) => base + (perfect ? PERFECT_BONUS : 0) + bonus;
  switch (kind) {
    case 'placement':
      return 0;
    case 'lesson':
      return withBonuses(10);
    case 'review':
      return withBonuses(15);
    case 'practice':
    case 'cards': // same formula as Practice (the >= 5 cards rule belongs to the session builder)
      return withBonuses(8);
    case 'map':
      return MAP_STUDY_XP; // no bonuses
    default:
      return assertNever(kind);
  }
}

/**
 * XP actually granted at commit time. A map earns XP only the first time it is studied on a
 * given day (or after it, if the clock went back); repeating it is recorded but worth 0.
 */
export function finalSessionXp(
  kind: SessionKind,
  provisionalXp: number,
  mapLastStudiedDay: string | undefined,
  day: string,
): number {
  // `>=`: with the clock set back, a map already studied "in the future" must not pay again.
  return kind === 'map' && mapLastStudiedDay !== undefined && mapLastStudiedDay >= day
    ? 0
    : provisionalXp;
}

/** Only lessons and unit reviews cost hearts when you miss. */
export function sessionUsesHearts(kind: SessionKind): boolean {
  switch (kind) {
    case 'lesson':
    case 'review':
      return true;
    case 'practice':
    case 'placement':
    case 'cards':
    case 'map':
      return false;
    default:
      return assertNever(kind);
  }
}

/** Only Practice (including "Praticar este mapa") gives a heart back. */
export function sessionGainsHeart(kind: SessionKind): boolean {
  switch (kind) {
    case 'practice':
      return true;
    case 'lesson':
    case 'review':
    case 'placement':
    case 'cards':
    case 'map':
      return false;
    default:
      return assertNever(kind);
  }
}

/** Counts for streak, daily goal and chart. Placement is an assessment, not study. */
export function sessionCountsAsStudy(kind: SessionKind): boolean {
  switch (kind) {
    case 'placement':
      return false;
    case 'lesson':
    case 'review':
    case 'practice':
    case 'cards':
    case 'map':
      return true;
    default:
      return assertNever(kind);
  }
}

/** Writes lessonProgress (completion of a path lesson). */
export function sessionCompletesLesson(kind: SessionKind): boolean {
  switch (kind) {
    case 'lesson':
    case 'review':
      return true;
    case 'practice':
    case 'placement':
    case 'cards':
    case 'map':
      return false;
    default:
      return assertNever(kind);
  }
}

/** Sessions that record study of a mind map (mapProgress). */
export function sessionStudiesMap(kind: SessionKind): boolean {
  switch (kind) {
    case 'map':
    case 'practice':
      return true;
    case 'lesson':
    case 'review':
    case 'placement':
    case 'cards':
      return false;
    default:
      return assertNever(kind);
  }
}

/** Accuracy-based sessions: `perfect` proves right answers (self-graded cards/maps do not). */
export function sessionProvesAccuracy(kind: SessionKind): boolean {
  switch (kind) {
    case 'lesson':
    case 'review':
    case 'practice':
      return true;
    case 'placement':
    case 'cards':
    case 'map':
      return false;
    default:
      return assertNever(kind);
  }
}
