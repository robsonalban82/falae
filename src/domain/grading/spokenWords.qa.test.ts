import { matchSpokenWords } from './spokenWords';

const heardOf = (t: string, h: string) => matchSpokenWords(t, h).map((w) => w.heard);

describe('matchSpokenWords QA', () => {
  it('empty transcript: nothing heard; empty target: empty list', () => {
    expect(heardOf('Hello Ana', '')).toEqual([false, false]);
    expect(matchSpokenWords('', 'hello')).toEqual([]);
    expect(matchSpokenWords('   ', 'hello')).toEqual([]);
  });
  it('case and punctuation ignored, shown text keeps the original', () => {
    const r = matchSpokenWords('Hello, my name is Ana.', 'HELLO my NAME is ana');
    expect(r.every((w) => w.heard)).toBe(true);
    expect(r.map((w) => w.text)).toEqual(['Hello,', 'my', 'name', 'is', 'Ana.']);
  });
  it('contractions: expanded vs contracted both match', () => {
    expect(heardOf("I'm thirty", 'I am thirty')).toEqual([true, true]);
    expect(heardOf('I am thirty', "I'm thirty")).toEqual([true, true, true]);
    expect(heardOf("I'm thirty", 'thirty')).toEqual([false, true]);
  });
  it('numbers: digits vs words', () => {
    expect(heardOf('I am 30 years old', 'I am thirty years old')).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(heardOf('I am thirty', 'I am 30')).toEqual([true, true, true]);
  });
  it('repeated words are matched in order, not reused', () => {
    expect(heardOf('no no no', 'no')).toEqual([true, false, false]);
    expect(heardOf('the cat and the dog', 'the dog')).toEqual([true, false, false, false, true]);
  });
  it('extra heard words and wrong order do not create false positives', () => {
    expect(heardOf('good morning', 'morning good')).toHaveLength(2);
    expect(heardOf('good morning', 'morning good').filter(Boolean)).toHaveLength(1);
    expect(heardOf('hi', 'oh hi there my friend')).toEqual([true]);
  });
  it('accents do not crash', () => {
    expect(() => matchSpokenWords('café', 'cafe')).not.toThrow();
    expect(heardOf('café', 'cafe')).toEqual([true]);
  });
  it('punctuation-only words are never flagged', () => {
    expect(heardOf('Hello — Ana', 'hello Ana')).toEqual([true, true, true]);
  });
  it('huge transcript stays fast and correct', () => {
    const big = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(' ');
    const t0 = Date.now();
    const r = matchSpokenWords('hello my name is Ana', `${big} hello my name is Ana`);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.every((w) => w.heard)).toBe(true);
  });
  it('does not mutate / handles odd whitespace', () => {
    expect(heardOf('a\n b\t c', ' a   b c ')).toEqual([true, true, true]);
  });
});
