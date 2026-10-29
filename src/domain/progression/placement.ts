/** Placement test (docs/fases/FASE-6.md §7). Pure: no React, Dexie or content import. */
import type { Exercise } from '../../content/schema';
import { applyFallbacks, type Capabilities } from '../lesson/fallbacks';
import { seededRandom, shuffle } from '../random';

export const PLACEMENT_SIZE = 15;
export const PLACEMENT_PASS = 0.8;
const REVIEW_PICKS = 3;

/**
 * Assessment must not depend on audio, nor be answerable by trial and error:
 * speak/listen-type need audio and match-pairs always ends "correct".
 */
const EXCLUDED = new Set<Exercise['type']>(['speak', 'listen-type', 'match-pairs']);

type PlacementUnit = {
  skills: readonly { lessons: readonly { exercises: readonly Exercise[] }[] }[];
  reviewLesson: { exercises: readonly Exercise[] };
};

/** One exercise per lesson + 3 from the review, chosen by seed, easy → hard. */
export function pickPlacementExercises(
  unit: PlacementUnit,
  caps: Capabilities,
  seed: number,
): Exercise[] {
  const rand = seededRandom(seed);
  const chosen = new Set<string>();
  const out: Exercise[] = [];
  const eligible = (exercises: readonly Exercise[]) =>
    applyFallbacks(exercises, caps, () => undefined).filter(
      (e) => !EXCLUDED.has(e.type) && !chosen.has(e.id),
    );
  /** Random candidate, preferring a type different from the previous pick. */
  const pick = (candidates: Exercise[]): Exercise | undefined => {
    const shuffled = shuffle(candidates, rand);
    const prev = out.at(-1)?.type;
    return shuffled.find((e) => e.type !== prev) ?? shuffled[0];
  };
  const take = (ex: Exercise | undefined) => {
    if (!ex) return;
    chosen.add(ex.id);
    out.push(ex);
  };

  for (const skill of unit.skills) {
    for (const lesson of skill.lessons) {
      // A lesson without an eligible exercise borrows one from the same skill.
      const own = eligible(lesson.exercises);
      take(pick(own.length > 0 ? own : eligible(skill.lessons.flatMap((l) => l.exercises))));
    }
  }
  for (let i = 0; i < REVIEW_PICKS; i++) take(pick(eligible(unit.reviewLesson.exercises)));
  return out.slice(0, PLACEMENT_SIZE);
}

export function placementScore(outcome: { correct: number; answered: number }): number {
  return outcome.answered === 0 ? 0 : outcome.correct / outcome.answered;
}

export function placementPassed(score: number): boolean {
  return score >= PLACEMENT_PASS;
}
