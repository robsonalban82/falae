import { parseBold, stripBold } from './richText';

describe('parseBold', () => {
  it('returns plain text as a single segment', () => {
    expect(parseBold('to be')).toEqual({
      segments: [{ text: 'to be', bold: false }],
      balanced: true,
    });
  });

  it('splits bold pairs', () => {
    expect(parseBold('I **am** here, **you**')).toEqual({
      segments: [
        { text: 'I ', bold: false },
        { text: 'am', bold: true },
        { text: ' here, ', bold: false },
        { text: 'you', bold: true },
      ],
      balanced: true,
    });
  });

  it('keeps an unpaired marker as literal text and flags it', () => {
    expect(parseBold('I **am** **here')).toEqual({
      segments: [
        { text: 'I ', bold: false },
        { text: 'am', bold: true },
        { text: ' **here', bold: false },
      ],
      balanced: false,
    });
  });

  it('flags empty or blank pairs', () => {
    expect(parseBold('a **** b').balanced).toBe(false);
    expect(parseBold('a ** ** b').balanced).toBe(false);
  });

  it('flags bold runs with stray asterisks or spaces at the edges', () => {
    for (const bad of ['***x***', 'a***b***c', 'a ** b ** c', 'a **b ** c', 'a ** b** c']) {
      expect(parseBold(bad).balanced, bad).toBe(false);
    }
    for (const ok of ['a **b c** d', '**I** · **you**', '**x**']) {
      expect(parseBold(ok).balanced, ok).toBe(true);
    }
  });

  it('handles empty text and whole-bold text', () => {
    expect(parseBold('')).toEqual({ segments: [], balanced: true });
    expect(parseBold('**hi**')).toEqual({ segments: [{ text: 'hi', bold: true }], balanced: true });
  });

  it('stripBold removes the markers', () => {
    expect(stripBold("**I'm** · **you're**")).toBe("I'm · you're");
  });
});
