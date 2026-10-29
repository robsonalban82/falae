/** SM-2 adapted (docs/ARQUITETURA.md §7). Pure: no React, Dexie or content. */
import { addDays, type DayKey } from '../time';

/** Structural copy of data/models SrsCard (domain does not import data/). */
export type Card = {
  itemId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueDay: DayKey;
  lastReviewDay: DayKey;
};

export type Quality = 1 | 2 | 4 | 5;
export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL_DAYS = 180;
/** Cards with reps ≥ 1 and interval ≥ 3 days count as learned words. */
export const LEARNED_MIN_INTERVAL_DAYS = 3;

export function newCard(itemId: string, today: DayKey): Card {
  return {
    itemId,
    ease: INITIAL_EASE,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueDay: today,
    lastReviewDay: today,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Applies one review with quality `q` (0–5; < 3 is a failure). */
export function review(card: Card, q: number, today: DayKey): Card {
  // Clock went back: never rewrite a card with a "past" review.
  if (today < card.lastReviewDay) return card;
  const success = q >= 3;
  // Same-day rules: a card created today (never reviewed) may advance; a card already reviewed
  // today never advances again, and one that already failed today is not penalized twice.
  const fresh = card.reps === 0 && card.lapses === 0 && card.intervalDays === 0;
  if (card.lastReviewDay === today && !fresh && (success || card.reps === 0)) return card;

  const ease = Math.max(MIN_EASE, round2(card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  let reps: number;
  let lapses = card.lapses;
  let interval: number;
  if (!success) {
    reps = 0;
    lapses += 1;
    interval = 1;
  } else {
    reps = card.reps + 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(card.intervalDays * card.ease);
  }
  interval = Math.min(interval, MAX_INTERVAL_DAYS);
  return {
    itemId: card.itemId,
    ease,
    intervalDays: interval,
    reps,
    lapses,
    dueDay: addDays(today, interval),
    lastReviewDay: today,
  };
}

const sameCard = (a: Card, b: Card) =>
  a.ease === b.ease &&
  a.intervalDays === b.intervalDays &&
  a.reps === b.reps &&
  a.lapses === b.lapses &&
  a.dueDay === b.dueDay &&
  a.lastReviewDay === b.lastReviewDay;

/**
 * Reviews every item of a session. Repeated item ids use the lowest q.
 * Returns only cards that were created or changed, in first-appearance order.
 */
export function applyOutcomes(
  existing: readonly Card[],
  outcomes: readonly { itemId: string; q: number }[],
  today: DayKey,
): Card[] {
  const byId = new Map(existing.map((c) => [c.itemId, c]));
  const lowest = new Map<string, number>();
  for (const { itemId, q } of outcomes) {
    const prev = lowest.get(itemId);
    lowest.set(itemId, prev === undefined ? q : Math.min(prev, q));
  }
  const out: Card[] = [];
  for (const [itemId, q] of lowest) {
    const before = byId.get(itemId);
    const after = review(before ?? newCard(itemId, today), q, today);
    if (!before || !sameCard(before, after)) out.push(after);
  }
  return out;
}

/** Placement passed: items without a card start as already known (interval 3). Existing cards are untouched. */
export function seedTestedOut(
  existing: readonly Card[],
  itemIds: readonly string[],
  today: DayKey,
): Card[] {
  const known = new Set(existing.map((c) => c.itemId));
  const out: Card[] = [];
  for (const itemId of itemIds) {
    if (known.has(itemId)) continue;
    known.add(itemId);
    out.push({
      itemId,
      ease: INITIAL_EASE,
      intervalDays: LEARNED_MIN_INTERVAL_DAYS,
      reps: 2,
      lapses: 0,
      dueDay: addDays(today, LEARNED_MIN_INTERVAL_DAYS),
      lastReviewDay: today,
    });
  }
  return out;
}

export function isLearned(c: Pick<Card, 'reps' | 'intervalDays'>): boolean {
  return c.reps >= 1 && c.intervalDays >= LEARNED_MIN_INTERVAL_DAYS;
}
