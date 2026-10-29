import { diffChars } from './diffChars';

const marked = (expected: string, actual: string) =>
  diffChars(expected, actual)
    .filter((s) => s.diff)
    .map((s) => s.text);

describe('diffChars', () => {
  it('identical answers have no differences', () => {
    expect(diffChars('Good morning!', 'good morning')).toEqual([
      { text: 'Good morning!', diff: false },
    ]);
  });

  it('marks a missing letter', () => {
    expect(marked('afternoon', 'afternon')).toEqual(['o']);
  });

  it('marks a swapped letter', () => {
    expect(diffChars('thanks', 'thenks')).toEqual([
      { text: 'th', diff: false },
      { text: 'a', diff: true },
      { text: 'nks', diff: false },
    ]);
  });

  it('ignores case, accents and punctuation', () => {
    expect(marked('Olá, João!', 'ola joao')).toEqual([]);
  });

  it('an extra letter in the answer marks nothing in the expected text', () => {
    expect(marked('hello', 'helllo')).toEqual([]);
  });

  it('keeps the full expected text across segments', () => {
    const segs = diffChars('Good afternoon!', 'good aftrnoon');
    expect(segs.map((s) => s.text).join('')).toBe('Good afternoon!');
    expect(segs.filter((s) => s.diff).map((s) => s.text)).toEqual(['e']);
  });

  it('empty inputs', () => {
    expect(diffChars('', 'abc')).toEqual([]);
    expect(marked('abc', '')).toEqual(['abc']);
  });
});
