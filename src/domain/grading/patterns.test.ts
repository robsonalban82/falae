import { expandPattern, expandPatterns, PatternError } from './patterns';

describe('expandPattern', () => {
  it('returns plain text unchanged', () => {
    expect(expandPattern('Good morning!')).toEqual(['Good morning!']);
  });

  it('expands optional parts and collapses spaces', () => {
    expect(expandPattern('(Eu) sou Ana')).toEqual(['Eu sou Ana', 'sou Ana']);
    expect(expandPattern('I am 30 (years old).')).toEqual(['I am 30 years old.', 'I am 30.']);
  });

  it('expands alternatives', () => {
    expect(expandPattern("[I'm|I am] tired")).toEqual(["I'm tired", 'I am tired']);
  });

  it('combines optional and alternatives, including nesting', () => {
    const out = expandPattern('(Eu) tenho [trinta|30] anos (de idade)');
    expect(out).toHaveLength(8);
    expect(out).toContain('tenho 30 anos');
    expect(expandPattern('[a (b)|c]')).toEqual(['a b', 'a', 'c']);
  });

  it('deduplicates results', () => {
    expect(expandPattern('[oi|oi]')).toEqual(['oi']);
    expect(expandPatterns(['oi', '[oi|olá]'])).toEqual(['oi', 'olá']);
  });

  it('rejects malformed patterns', () => {
    expect(() => expandPattern('(Eu sou')).toThrow(PatternError);
    expect(() => expandPattern('[a|b')).toThrow(PatternError);
    expect(() => expandPattern('a)')).toThrow(PatternError);
    expect(() => expandPattern('a|b')).toThrow(PatternError);
  });

  it('enforces the expansion limit', () => {
    const huge = Array.from({ length: 7 }, () => '[a|b]').join(' ');
    expect(() => expandPattern(huge)).toThrow(/mais de 64/);
    expect(expandPattern(huge, 200)).toHaveLength(128);
  });
});
