import { check, checkAll, initialQuizState, score, shownAnswer, toggleAnswers } from './quiz';

const ctx = { knownWords: new Set(['coffee', 'hot']) };
const items = [
  { accepted: ["isn't", 'is not'] },
  { accepted: ['are'] },
  { accepted: ['beautiful'] },
];

describe('quiz', () => {
  it('starts empty', () => {
    expect(initialQuizState(3).items.map((i) => i.status)).toEqual(['empty', 'empty', 'empty']);
  });

  it('accepts "isn\'t" and "is not"', () => {
    const s0 = initialQuizState(3);
    expect(check(s0, 0, "isn't", items, ctx).items[0]).toEqual({ status: 'right' });
    expect(check(s0, 0, 'Is not', items, ctx).items[0]).toEqual({ status: 'right' });
  });

  it('a typo is almost, shows the correct form and counts as right', () => {
    const s = check(initialQuizState(3), 2, 'beautifull', items, ctx);
    expect(s.items[2]).toEqual({ status: 'almost', correctAnswer: 'beautiful' });
    expect(score(s)).toEqual({ right: 1, checked: 1, total: 3 });
  });

  it('wrong shows the first accepted answer; blank stays empty', () => {
    const s = check(initialQuizState(3), 1, 'is', items, ctx);
    expect(s.items[1]).toEqual({ status: 'wrong', correctAnswer: 'are' });
    expect(check(s, 1, '   ', items, ctx).items[1]).toEqual({ status: 'empty' });
  });

  it('does not mutate and ignores a bad index', () => {
    const s0 = initialQuizState(3);
    check(s0, 0, 'is', items, ctx);
    expect(s0.items[0]).toEqual({ status: 'empty' });
    expect(check(s0, 9, 'x', items, ctx)).toBe(s0);
  });

  it('checkAll grades every blank, empties included', () => {
    const s = checkAll(initialQuizState(3), ['is not', '', 'ugly'], items, ctx);
    expect(s.items.map((i) => i.status)).toEqual(['right', 'empty', 'wrong']);
    expect(score(s)).toEqual({ right: 1, checked: 2, total: 3 });
  });

  it('toggleAnswers flips and shownAnswer is the first pattern, concrete', () => {
    const s = toggleAnswers(initialQuizState(1));
    expect(s.showAnswers).toBe(true);
    expect(toggleAnswers(s).showAnswers).toBe(false);
    expect(shownAnswer({ accepted: ["(I'm) fine", 'x'] })).toBe("I'm fine");
  });
});
