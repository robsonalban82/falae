import { expandPattern, expandPatterns, MAX_PATTERN_EXPANSIONS, PatternError } from './patterns';

/** QA edge cases for the (x) / [a|b] pattern expander. */
describe('expandPattern — edge cases', () => {
  it('keeps accents, cedilla and other unicode letters intact', () => {
    expect(expandPattern('[Você|Vc] é (muito) legal, não?')).toEqual([
      'Você é muito legal, não?',
      'Você é legal, não?',
      'Vc é muito legal, não?',
      'Vc é legal, não?',
    ]);
    expect(expandPattern('Açaí (é) ótimo 😋')).toEqual(['Açaí é ótimo 😋', 'Açaí ótimo 😋']);
  });

  it('collapses tabs, newlines and non-breaking spaces and trims the edges', () => {
    expect(expandPattern('  I\tam\n  (very) tired  ')).toEqual(['I am very tired', 'I am tired']);
  });

  it('removes the space left before punctuation when an optional part is dropped', () => {
    expect(expandPattern('Hi (Ana) !')).toEqual(['Hi Ana!', 'Hi!']);
    expect(expandPattern('Yes (, I do) .')).toEqual(['Yes, I do.', 'Yes.']);
    expect(expandPattern('Is it (really) ?')).toEqual(['Is it really?', 'Is it?']);
  });

  it('keeps apostrophes and contractions untouched', () => {
    expect(expandPattern("[I'm|I am] (not) [o'clock|ok]")).toContain("I'm not o'clock");
  });

  it('handles empty groups without crashing', () => {
    expect(expandPattern('a () b')).toEqual(['a b']);
    expect(expandPattern('a [] b')).toEqual(['a b']);
    expect(expandPattern('[|a] b')).toEqual(['b', 'a b']);
    expect(expandPattern('[a|] b')).toEqual(['a b', 'b']);
    expect(expandPattern('[a||b]')).toEqual(['a', 'b']);
  });

  it('returns no answers for patterns that only contain empty groups', () => {
    // Documented behaviour of the expander; see schema.edge.test.ts for whether content may use it.
    expect(expandPattern('()')).toEqual([]);
    expect(expandPattern('[|]')).toEqual([]);
    expect(expandPattern('( )')).toEqual([]);
  });

  it('supports deep nesting', () => {
    expect(expandPattern('a ((b) c)')).toEqual(['a b c', 'a c', 'a']);
    expect(expandPattern('[x [y|z]|w]')).toEqual(['x y', 'x z', 'w']);
  });

  it('rejects stray and mismatched brackets with PatternError', () => {
    for (const bad of [')', ']', '|', '(a]', '[a)', '((a)', '[a|b]]', 'a (b|c)']) {
      expect(() => expandPattern(bad), bad).toThrow(PatternError);
    }
  });

  it('reports the position of an unexpected character (1-based)', () => {
    expect(() => expandPattern('ab)')).toThrow(/posição 3/);
  });

  it('allows exactly the limit and rejects one over it', () => {
    // 2^6 = 64 combinations is exactly the limit.
    const sixGroups = Array.from({ length: 6 }, () => '[a|b]').join(' ');
    expect(expandPattern(sixGroups)).toHaveLength(MAX_PATTERN_EXPANSIONS);
    const sixtyFive = `[${Array.from({ length: 65 }, (_, i) => `w${i}`).join('|')}]`;
    expect(() => expandPattern(sixtyFive)).toThrow(PatternError);
  });

  it('fails fast on pathological input instead of hanging', () => {
    const bomb = Array.from({ length: 40 }, () => '(a)').join(' ');
    const start = performance.now();
    expect(() => expandPattern(bomb)).toThrow(PatternError);
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('handles an empty string', () => {
    expect(expandPattern('')).toEqual([]);
  });
});

describe('expandPatterns', () => {
  it('returns an empty list for no patterns', () => {
    expect(expandPatterns([])).toEqual([]);
  });

  it('applies the limit per pattern, not to the union', () => {
    const p = Array.from({ length: 6 }, () => '[a|b]').join(' ');
    const q = Array.from({ length: 6 }, () => '[c|d]').join(' ');
    expect(expandPatterns([p, q])).toHaveLength(128);
  });

  it('propagates PatternError from any pattern', () => {
    expect(() => expandPatterns(['ok', '(broken'])).toThrow(PatternError);
  });
});
