/** Which items the Practice session uses (docs/ARQUITETURA.md §7, ADR-011). */
import type { DayKey } from '../time';
import { isLearned, type Card } from './sm2';

export const PRACTICE_SIZE = 12;
export const PRACTICE_MIN_ITEMS = 4;

export function dueCount(cards: readonly Card[], today: DayKey): number {
  return cards.filter((c) => c.dueDay <= today).length;
}

export function wordsLearned(cards: readonly Pick<Card, 'reps' | 'intervalDays'>[]): number {
  return cards.filter(isLearned).length;
}

/**
 * Learned count after a commit, from the count before and the cards that changed.
 * No clamping: a negative result means `before` was inconsistent with the cards, and that
 * must stay visible instead of being hidden.
 */
export function learnedAfter(
  before: number,
  oldCards: readonly Card[],
  newCards: readonly Card[],
): number {
  const changed = new Set(newCards.map((c) => c.itemId));
  const lost = oldCards.filter((c) => changed.has(c.itemId) && isLearned(c)).length;
  return before - lost + wordsLearned(newCards);
}

const byId = (a: Card, b: Card) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0);
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Up to PRACTICE_SIZE distinct item ids: overdue first (oldest due, most lapses, lowest ease),
 * topped up to PRACTICE_MIN_ITEMS with the weakest not-due cards, then with `fallbackItemIds`.
 */
export function selectForPractice(
  cards: readonly Card[],
  today: DayKey,
  fallbackItemIds: readonly string[],
  knownItemIds: ReadonlySet<string>,
): string[] {
  const eligible = cards.filter((c) => knownItemIds.has(c.itemId));
  const due = eligible
    .filter((c) => c.dueDay <= today)
    .sort(
      (a, b) => cmpStr(a.dueDay, b.dueDay) || b.lapses - a.lapses || a.ease - b.ease || byId(a, b),
    );
  const out = due.slice(0, PRACTICE_SIZE).map((c) => c.itemId);
  if (out.length < PRACTICE_MIN_ITEMS) {
    const notDue = eligible
      .filter((c) => c.dueDay > today)
      .sort((a, b) => a.ease - b.ease || cmpStr(a.dueDay, b.dueDay) || byId(a, b));
    for (const c of notDue) {
      if (out.length >= PRACTICE_MIN_ITEMS) break;
      out.push(c.itemId);
    }
  }
  if (out.length < PRACTICE_MIN_ITEMS) {
    const taken = new Set(out);
    for (const id of fallbackItemIds) {
      if (out.length >= PRACTICE_MIN_ITEMS) break;
      if (!knownItemIds.has(id) || taken.has(id)) continue;
      taken.add(id);
      out.push(id);
    }
  }
  return out;
}
