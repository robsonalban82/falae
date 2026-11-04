import { normalize } from '../grading/normalize';
import { stripBold } from '../mindmap/richText';

/** Normalized, deduplicated words (accents and punctuation dropped, so "voce" finds "você"). */
export function searchWords(texts: Iterable<string>): string {
  const words = new Set<string>();
  for (const text of texts) {
    for (const w of normalize(stripBold(text), 'pt').split(' ')) if (w) words.add(w);
  }
  return [...words].join(' ');
}
