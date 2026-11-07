import { describe, expect, it } from 'vitest';
import { fieldWidthCh } from './fieldWidth';

describe('fieldWidthCh', () => {
  it('uses the minimum for short or empty answers', () => {
    expect(fieldWidthCh([])).toBe(8);
    expect(fieldWidthCh(['am'])).toBe(8);
  });
  it('measures the longest expansion of any pattern', () => {
    expect(fieldWidthCh(['a [b|bcdefghij]'])).toBe(Math.ceil(11 * 1.2) + 3);
    expect(fieldWidthCh(['am', 'a longer one'])).toBe(Math.ceil(12 * 1.2) + 3);
  });
  it('caps at 30', () => {
    expect(fieldWidthCh(['x'.repeat(100)])).toBe(30);
  });
  it('survives a malformed pattern', () => {
    expect(fieldWidthCh(['(oops'])).toBeGreaterThanOrEqual(8);
  });
});
