import { normalize } from '../domain/grading/normalize';
import { stripBold } from '../domain/mindmap/richText';
import { searchWords } from '../domain/text/search';
import { searchText } from './buildManifest';

// The pre-extraction implementation, kept to prove the move changed nothing.
function legacySearchText(texts: Iterable<string>): string {
  const words = new Set<string>();
  for (const text of texts) {
    for (const w of normalize(stripBold(text), 'pt').split(' ')) if (w) words.add(w);
  }
  return [...words].join(' ');
}

const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value !== null && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];

describe('searchWords / searchText on real content', () => {
  const mods = import.meta.glob<{ default: unknown }>('./mindmaps/*.json', { eager: true });
  const files = Object.entries(mods);

  it('has maps to compare', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s gives the same result as the old searchText', (_path, mod) => {
    const texts = strings(mod.default);
    expect(searchWords(texts)).toBe(legacySearchText(texts));
    expect(searchText(texts)).toBe(legacySearchText(texts));
  });
});
