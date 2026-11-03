import { parseBold, stripBold } from './richText';

// QA edge cases for **bold** parsing (MAPAS-E-CARTAS §2.5).
describe('parseBold — QA edges', () => {
  it('keeps unicode (accents, emoji) intact inside and around bold', () => {
    expect(parseBold('Você **está** 😀 **ação**')).toEqual({
      segments: [
        { text: 'Você ', bold: false },
        { text: 'está', bold: true },
        { text: ' 😀 ', bold: false },
        { text: 'ação', bold: true },
      ],
      balanced: true,
    });
  });

  it('a lone "**" is unbalanced and stays visible as literal text', () => {
    expect(parseBold('**')).toEqual({ segments: [{ text: '**', bold: false }], balanced: false });
    expect(parseBold('a **b** c **')).toEqual({
      segments: [
        { text: 'a ', bold: false },
        { text: 'b', bold: true },
        { text: ' c **', bold: false },
      ],
      balanced: false,
    });
  });

  it('flags an odd number of markers anywhere (first, middle, last)', () => {
    for (const t of ['**a', 'a**', '**a** **b', '**a**b**', '** ** **']) {
      expect(parseBold(t).balanced, t).toBe(false);
    }
  });

  it('flags empty and blank pairs (also tabs and newlines)', () => {
    for (const t of ['****', 'x****', '**\t**', '**\n**', '**a** **  **']) {
      expect(parseBold(t).balanced, JSON.stringify(t)).toBe(false);
    }
  });

  it('accepts adjacent pairs and merges them into one bold run', () => {
    expect(parseBold('**a****b**')).toEqual({
      segments: [{ text: 'ab', bold: true }],
      balanced: true,
    });
  });

  it('single asterisks and backslashes are plain text (no escape syntax)', () => {
    expect(parseBold('*a* 5 * 3')).toEqual({
      segments: [{ text: '*a* 5 * 3', bold: false }],
      balanced: true,
    });
    expect(stripBold('\\*\\*x\\*\\*')).toBe('\\*\\*x\\*\\*');
  });

  it('never loses non-marker characters (stripBold of balanced text = text minus "**")', () => {
    const samples = [
      'I **am**',
      '**I**, **you**, **we**',
      'no bold',
      '**x** y **z**',
      'ação **é** já',
    ];
    for (const t of samples) {
      expect(parseBold(t).balanced, t).toBe(true);
      expect(stripBold(t), t).toBe(t.replaceAll('**', ''));
    }
  });

  it('unbalanced text keeps the stray marker in stripBold', () => {
    expect(stripBold('I **am')).toBe('I **am');
  });
});
