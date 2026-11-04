import { toFlashcard } from './flashcard';

describe('toFlashcard', () => {
  it('builds front and back from a plain item', () => {
    expect(
      toFlashcard({
        id: 'u1-hello',
        en: '[hi|hello]',
        pt: ['oi', 'olá'],
        emoji: '👋',
        pronunciation: 'rrelou',
        example: { en: 'Hello, Ana.', pt: 'Olá, Ana.' },
      }),
    ).toEqual({
      itemId: 'u1-hello',
      source: 'unit',
      front: { en: 'hi', emoji: '👋' },
      back: {
        pt: 'oi, olá',
        example: { en: 'Hello, Ana.', pt: 'Olá, Ana.' },
        pronunciation: 'rrelou',
      },
    });
  });

  it('false friend: notes become caution', () => {
    const card = toFlashcard(
      {
        id: 'ff-caution',
        en: 'caution',
        pt: ['cautela'],
        focus: 'falso-cognato',
        notes: 'Não é "caução".',
      },
      undefined,
      { source: 'bank', level: 'A2' },
    );
    expect(card.back.caution).toBe('Não é "caução".');
    expect(card.source).toBe('bank');
    expect(card.level).toBe('A2');
  });

  it('notes without the false-friend focus are not a caution', () => {
    const card = toFlashcard({ id: 'x', en: 'x', pt: 'x', notes: 'algo' });
    expect(card.back).toEqual({ pt: 'x' });
  });

  it('collection entry adds situation, formality and avoidWhen', () => {
    const card = toFlashcard(
      { id: 'x', en: 'What’s up?', pt: 'E aí?' },
      { situation: 'Entre amigos', formality: 'giria', avoidWhen: 'Em reuniões' },
    );
    expect(card.back).toEqual({
      pt: 'E aí?',
      situation: 'Entre amigos',
      formality: 'giria',
      avoidWhen: 'Em reuniões',
    });
    expect(card.front).toEqual({ en: 'What’s up?' });
  });
});
