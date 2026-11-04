import { fixtureLookup } from './testFixture';
import { lineView } from './lines';

describe('lineView', () => {
  it('item: display pattern, joined senses, hint and strong only in vocabulario', () => {
    expect(lineView({ ref: 'u1-im', hint: 'ser ou estar' }, 'regra', fixtureLookup)).toEqual({
      kind: 'item',
      itemId: 'u1-im',
      en: "I'm fine",
      pt: 'estou, sou',
      hint: 'ser ou estar',
      strong: false,
    });
    expect(lineView({ ref: 'xa-happy' }, 'vocabulario', fixtureLookup)).toEqual({
      kind: 'item',
      itemId: 'xa-happy',
      en: 'happy',
      pt: 'feliz',
      strong: true,
    });
  });

  it('text: bold segments and plain speakText', () => {
    expect(lineView({ en: 'you **are** here', pt: 'você está' }, 'exemplo', fixtureLookup)).toEqual(
      {
        kind: 'text',
        en: [
          { text: 'you ', bold: false },
          { text: 'are', bold: true },
          { text: ' here', bold: false },
        ],
        speakText: 'you are here',
        pt: 'você está',
      },
    );
    expect(lineView({ en: 'plain' }, 'exemplo', fixtureLookup)).not.toHaveProperty('pt');
  });

  it('fix and note', () => {
    expect(lineView({ wrong: 'a', right: 'b', note: 'n' }, 'erro-comum', fixtureLookup)).toEqual({
      kind: 'fix',
      wrong: 'a',
      right: 'b',
      note: 'n',
    });
    expect(lineView({ wrong: 'a', right: 'b' }, 'erro-comum', fixtureLookup)).not.toHaveProperty(
      'note',
    );
    expect(lineView({ note: 'Atenção' }, 'regra', fixtureLookup)).toEqual({
      kind: 'note',
      text: 'Atenção',
    });
  });

  it('a ref missing from the lookup gives null', () => {
    expect(lineView({ ref: 'nope' }, 'regra', fixtureLookup)).toBeNull();
  });
});
