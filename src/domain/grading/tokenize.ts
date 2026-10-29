/** Splits a sentence into word-bank tiles (keeps apostrophes, drops surrounding punctuation). */
export function tokenizeForBank(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ''))
    .filter(Boolean);
}
