/** Hearts (docs/ARQUITETURA.md §8): max 5, −1 per mistake in normal lessons, +1 every 4 h. */

export const MAX_HEARTS = 5;
export const HEART_REFILL_MS = 4 * 60 * 60 * 1000;

export type HeartsState = { hearts: number; heartsUpdatedAt: string };

/** Applies lazy refill. `heartsUpdatedAt` is the start of the current refill period. */
export function refillHearts(
  state: HeartsState,
  nowMs: number,
): HeartsState & { nextHeartInMs: number | null } {
  if (state.hearts >= MAX_HEARTS) return { ...state, hearts: MAX_HEARTS, nextHeartInMs: null };
  // A timestamp in the future (clock change, bad import) would push the wait past one period:
  // treat it as "now" so the next heart is never more than HEART_REFILL_MS away.
  const since = Math.min(Date.parse(state.heartsUpdatedAt), nowMs);
  const elapsed = nowMs - since;
  const gained = Math.floor(elapsed / HEART_REFILL_MS);
  const hearts = Math.min(MAX_HEARTS, state.hearts + gained);
  if (hearts >= MAX_HEARTS) {
    return { hearts, heartsUpdatedAt: new Date(nowMs).toISOString(), nextHeartInMs: null };
  }
  const periodStart = since + gained * HEART_REFILL_MS;
  return {
    hearts,
    heartsUpdatedAt: new Date(periodStart).toISOString(),
    nextHeartInMs: periodStart + HEART_REFILL_MS - nowMs,
  };
}

export function loseHeart(state: HeartsState, nowMs: number): HeartsState {
  const current = refillHearts(state, nowMs);
  if (current.hearts <= 0) return { hearts: 0, heartsUpdatedAt: current.heartsUpdatedAt };
  // Losing the first heart from full starts the refill clock now.
  const heartsUpdatedAt =
    current.hearts >= MAX_HEARTS ? new Date(nowMs).toISOString() : current.heartsUpdatedAt;
  return { hearts: current.hearts - 1, heartsUpdatedAt };
}

export function gainHeart(state: HeartsState, nowMs: number): HeartsState {
  const current = refillHearts(state, nowMs);
  const hearts = Math.min(MAX_HEARTS, current.hearts + 1);
  return {
    hearts,
    heartsUpdatedAt: hearts >= MAX_HEARTS ? new Date(nowMs).toISOString() : current.heartsUpdatedAt,
  };
}
