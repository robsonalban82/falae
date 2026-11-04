import { normalize, words } from './normalize';

export type SpokenWord = { text: string; heard: boolean };

/**
 * Marks which words of `target` show up, in order, in what speech recognition heard, so the
 * learner sees what came through. Uses the grader's normalization (case, punctuation,
 * contractions, numbers) and an LCS alignment; a word counts as heard when all its normalized
 * parts were matched.
 */
export function matchSpokenWords(target: string, heard: string): SpokenWord[] {
  const shown = target.split(/\s+/).filter(Boolean);
  const tokensOf = (from: number, to: number) =>
    words(normalize(shown.slice(from, to).join(' '), 'en'));
  // Group words the sentence-level normalization merges ("twenty one" → "21"), like the grader.
  const groups: { from: number; to: number; tokens: string[] }[] = [];
  for (let i = 0; i < shown.length;) {
    let to = i + 1;
    for (let j = i + 2; j <= Math.min(shown.length, i + 4); j++) {
      // Only when word i itself merges with what follows, not a merge further along.
      if (tokensOf(i, j).length < tokensOf(i, i + 1).length + tokensOf(i + 1, j).length) to = j;
    }
    groups.push({ from: i, to, tokens: tokensOf(i, to) });
    i = to;
  }
  const a = groups.flatMap((g, gi) => g.tokens.map((token) => ({ token, group: gi })));
  const b = words(normalize(heard, 'en'));

  const cols = b.length + 1;
  const lcs = new Array<number>((a.length + 1) * cols).fill(0);
  const at = (i: number, j: number) => lcs[i * cols + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i * cols + j] =
        a[i]?.token === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));

  const matched = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i]?.token === b[j]) {
      matched.add(i);
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) i++;
    else j++;
  }

  const groupHeard = groups.map((_, gi) => a.every((x, i) => x.group !== gi || matched.has(i)));
  return shown.map((text, w) => {
    const gi = groups.findIndex((g) => w >= g.from && w < g.to);
    // Punctuation-only "words" (e.g. "—") have no tokens: never flag them.
    return { text, heard: groupHeard[gi] ?? true };
  });
}
