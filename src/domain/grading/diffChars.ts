/** Highlights where a near-miss answer differs from the expected one ("quase" feedback). */

export type DiffSegment = { text: string; diff: boolean };

const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
const fold = (ch: string) => ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Splits `expected` into segments, marking letters that are missing or different in `actual`.
 * Case, accents, spaces and punctuation are ignored (the grader ignores them too).
 * Uses an LCS alignment over letters, so one typo marks one letter.
 */
export function diffChars(expected: string, actual: string): DiffSegment[] {
  const exp = [...expected];
  const expIdx = exp.flatMap((ch, i) => (isLetter(ch) ? [i] : []));
  const a = expIdx.map((i) => fold(exp[i] ?? ''));
  const b = [...actual].filter(isLetter).map(fold);

  // LCS table (answers are short).
  const rows = a.length + 1;
  const cols = b.length + 1;
  const lcs = new Array<number>(rows * cols).fill(0);
  const at = (i: number, j: number) => lcs[i * cols + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * cols + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const differs = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && at(i, j + 1) >= at(i + 1, j)) {
      j++;
    } else {
      differs.add(expIdx[i] ?? -1);
      i++;
    }
  }

  const segments: DiffSegment[] = [];
  exp.forEach((ch, k) => {
    const diff = differs.has(k);
    const last = segments[segments.length - 1];
    if (last && last.diff === diff) last.text += ch;
    else segments.push({ text: ch, diff });
  });
  return segments;
}
