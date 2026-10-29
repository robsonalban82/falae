const PATTERNS: Record<'correct' | 'wrong' | 'complete', number | number[]> = {
  correct: 15,
  wrong: [30, 40, 30],
  complete: [20, 30, 20, 30, 60],
};

export function vibrate(kind: keyof typeof PATTERNS, enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function')
    return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // ignore
  }
}

/** Whether the browser exposes the Vibration API at all. */
export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
