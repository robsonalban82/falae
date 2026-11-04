import { gradeText } from './grade';
import { displayPattern } from './patterns';

const ctx = { knownWords: new Set<string>() };

describe('gradeText edge cases', () => {
  it('treats whitespace-only input as wrong', () => {
    expect(gradeText('   ', ['hello'], 'en', ctx).verdict).toBe('wrong');
    expect(gradeText('?!', ['hello'], 'en', ctx).verdict).toBe('wrong');
  });

  it('ignores extra spaces and trailing punctuation', () => {
    expect(gradeText('  hello    there ! ', ['hello there'], 'en', ctx).verdict).toBe('correct');
  });

  it('does not crash with an empty pattern list', () => {
    expect(gradeText('hi', [], 'en', ctx)).toEqual({ verdict: 'wrong', correctAnswer: '' });
  });

  it('accepts a curly apostrophe and a missing one', () => {
    expect(gradeText('I’m fine', ["I'm fine"], 'en', ctx).verdict).toBe('correct');
    expect(gradeText('Im fine', ["I'm fine"], 'en', ctx).verdict).toBe('correct');
  });

  it('pt: accepts missing accents and uppercase', () => {
    expect(gradeText('VOCE ESTA', ['Você está'], 'pt', ctx).verdict).toBe('correct');
  });

  it('nested pattern accepts every combination', () => {
    const p = ['(Hello,) [my name is|I am] Ana'];
    expect(gradeText('i am ana', p, 'en', ctx).verdict).toBe('correct');
    expect(gradeText('hello my name is ana', p, 'en', ctx).verdict).toBe('correct');
  });

  it('a malformed pattern throws (callers must pass validated patterns)', () => {
    expect(() => gradeText('x', ['(broken'], 'en', ctx)).toThrow();
  });
});

describe('displayPattern edge cases', () => {
  it.each([
    ['[a|(b)] c', 'a c'],
    ['((a) b) c', 'a b c'],
    ['', ''],
    ['(x)', 'x'],
    ['hello [', 'hello ['],
    ['a ] b', 'a ] b'],
  ])('%j -> %j', (input, out) => {
    expect(displayPattern(input)).toBe(out);
  });
});
