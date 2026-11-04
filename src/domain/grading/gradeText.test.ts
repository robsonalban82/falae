import { gradeText } from './grade';

const ctx = { knownWords: new Set(['coffee', 'then', 'than']) };

describe('gradeText', () => {
  it('accepts the exact answer, ignoring case and punctuation', () => {
    expect(gradeText('Good Morning!', ['good morning'], 'en', ctx)).toEqual({
      verdict: 'correct',
      correctAnswer: 'good morning',
    });
  });

  it('forgives one typo in a long word', () => {
    expect(gradeText('good mornning', ['good morning'], 'en', ctx)).toEqual({
      verdict: 'almost',
      correctAnswer: 'good morning',
      note: 'typo',
    });
  });

  it('rejects a wrong answer and shows the first pattern', () => {
    expect(gradeText('good night', ['[good|nice] morning', 'hello'], 'en', ctx)).toEqual({
      verdict: 'wrong',
      correctAnswer: 'good morning',
    });
    expect(gradeText('', ['hello'], 'en', ctx).verdict).toBe('wrong');
  });

  it('accepts any expansion of a pattern and reports the matched form', () => {
    expect(gradeText('im fine', ["(I'm) fine"], 'en', ctx).verdict).toBe('correct');
    expect(gradeText('fine', ["(I'm) fine"], 'en', ctx)).toEqual({
      verdict: 'correct',
      correctAnswer: 'fine',
    });
    expect(gradeText('hello', ['[hi|hello]'], 'en', ctx).correctAnswer).toBe('hello');
  });

  it('grades Portuguese with the pt normalizer', () => {
    expect(gradeText('voce esta bem', ['Você está bem'], 'pt', ctx).verdict).toBe('correct');
  });

  it('does not forgive a typo that is itself a known word', () => {
    expect(gradeText('than', ['then'], 'en', ctx).verdict).toBe('wrong');
  });

  it('does not forgive typos in short words (< 5 letters)', () => {
    expect(gradeText('helo', ['hello'], 'en', ctx).verdict).toBe('almost');
    expect(gradeText('cat', ['cot'], 'en', ctx).verdict).toBe('wrong');
    expect(gradeText('gode', ['good'], 'en', ctx).verdict).toBe('wrong');
  });

  it('turns typo tolerance off with allowTypo: false', () => {
    expect(gradeText('good mornning', ['good morning'], 'en', ctx, { allowTypo: false })).toEqual({
      verdict: 'wrong',
      correctAnswer: 'good morning',
    });
  });
});
