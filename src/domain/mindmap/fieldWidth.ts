import { expandPattern } from '../grading/patterns';

const MIN_CH = 8;
const MAX_CH = 30;

/** Input width in ch from the longest expansion of any accepted pattern (bold letters are wider), clamped. */
export function fieldWidthCh(accepted: readonly string[]): number {
  let longest = 0;
  for (const pattern of accepted) {
    let lengths: number[];
    try {
      lengths = expandPattern(pattern).map((s) => s.length);
    } catch {
      lengths = [pattern.length]; // malformed pattern: fall back to raw length
    }
    for (const n of lengths) longest = Math.max(longest, n);
  }
  return Math.min(Math.max(Math.ceil(longest * 1.2) + 3, MIN_CH), MAX_CH);
}
