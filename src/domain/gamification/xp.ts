/** XP rules (docs/ARQUITETURA.md §8). */

export type SessionKind = 'lesson' | 'review' | 'practice' | 'placement';

const BASE_XP: Record<SessionKind, number> = { lesson: 10, review: 15, practice: 8, placement: 0 };
export const PERFECT_BONUS = 5;
export const COMBO_STEP = 5;
export const MAX_COMBO_BONUS = 5;

export function sessionXp(kind: SessionKind, perfect: boolean, comboBonus: number): number {
  if (kind === 'placement') return 0;
  const bonus = Math.min(MAX_COMBO_BONUS, Math.max(0, comboBonus));
  return BASE_XP[kind] + (perfect ? PERFECT_BONUS : 0) + bonus;
}
