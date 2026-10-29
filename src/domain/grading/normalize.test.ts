import { levenshtein, normalize, stripAccents, normalizeNumbers } from './normalize';

describe('normalize — EN', () => {
  it.each([
    ['Hello!', 'hello'],
    ['  HELLO,   there.  ', 'hello there'],
    ['Nice to meet you!!!', 'nice to meet you'],
    ['“Hi,” said Ana.', 'hi said ana'],
  ])('basic cleanup: %s', (input, expected) => {
    expect(normalize(input, 'en')).toBe(expected);
  });

  it.each([
    ["I'm thirty", 'i am 30'],
    ['I’m tired', 'i am tired'], // typographic apostrophe
    ["I don't know", 'i do not know'],
    ["She doesn't", 'she does not'],
    ["I can't", 'i can not'],
    ['I cannot', 'i can not'],
    ["We won't", 'we will not'],
    ["It's late", 'it is late'],
    ["What's your name?", 'what is your name'],
    ["Let's go", 'let us go'],
    ["They've arrived", 'they have arrived'],
    ["You'll see", 'you will see'],
    ["I'd like a coffee", 'i would like a coffee'],
  ])('expands contractions: %s', (input, expected) => {
    expect(normalize(input, 'en')).toBe(expected);
  });

  it('treats contracted and full forms the same', () => {
    expect(normalize("I'm not hungry", 'en')).toBe(normalize('I am not hungry', 'en'));
    expect(normalize("He isn't here", 'en')).toBe(normalize('He is not here', 'en'));
  });

  it('keeps possessives comparable without breaking them', () => {
    expect(normalize("Ana's brother", 'en')).toBe('anas brother');
    expect(normalize("It's five o'clock", 'en')).toBe('it is 5 oclock');
  });

  it.each([
    ['thirty', '30'],
    ['twenty-one', '21'],
    ['twenty one', '21'],
    ['ninety nine', '99'],
    ['a hundred', '100'],
    ['one hundred', '100'],
    ['zero', '0'],
    ['I have two brothers', 'i have 2 brothers'],
    ['5:30', '5 30'],
    ['five thirty', '5 30'],
  ])('numbers: %s', (input, expected) => {
    expect(normalize(input, 'en')).toBe(expected);
  });
});

describe('normalize — PT', () => {
  it.each([
    ['Você é brasileiro?', 'voce e brasileiro'],
    ['VOCÊ', 'voce'],
    ['Olá, tudo bem?', 'ola tudo bem'],
    ['Ação e reação', 'acao e reacao'],
    ['café com pão', 'cafe com pao'],
  ])('accents, case and punctuation: %s', (input, expected) => {
    expect(normalize(input, 'pt')).toBe(expected);
  });

  it.each([
    ['trinta', '30'],
    ['vinte e um', '21'],
    ['vinte e uma', '21'],
    ['três', '3'],
    ['duas irmãs', '2 irmas'],
    ['cem', '100'],
    ['catorze', '14'],
    ['quatorze', '14'],
  ])('numbers: %s', (input, expected) => {
    expect(normalize(input, 'pt')).toBe(expected);
  });

  it.each([
    ['às 8h', 'as 8'],
    ['às 8h30', 'as 8 30'],
    ['às 7:00', 'as 7'],
    ['às 7:30', 'as 7 30'],
    ['às oito', 'as 8'],
  ])('times: %s', (input, expected) => {
    expect(normalize(input, 'pt')).toBe(expected);
  });

  it('does not expand English contractions in Portuguese', () => {
    expect(normalize("d'água", 'pt')).toBe('dagua');
  });
});

describe('helpers', () => {
  it('stripAccents removes diacritics only', () => {
    expect(stripAccents('ãéîõüç')).toBe('aeiouc');
  });

  it('levenshtein with early exit', () => {
    expect(levenshtein('morning', 'morning')).toBe(0);
    expect(levenshtein('morning', 'mornin')).toBe(1);
    expect(levenshtein('morning', 'mroning')).toBe(2);
    expect(levenshtein('a', 'abcdef', 1)).toBe(2);
  });
});

describe('normalizeNumbers (Phase 7)', () => {
  it.each([
    ['I have 7 apples', 'I have seven apples'],
    ['twenty-one', '21'],
    ['twenty one', '21'],
    ['twenty-one', 'twenty one'],
    ['twelve', '12'],
    ['one hundred', '100'],
    ['a hundred', '100'],
    ['zero', '0'],
    ['ninety-nine', '99'],
  ])('%s = %s', (a, b) => {
    expect(normalizeNumbers(a)).toBe(normalizeNumbers(b));
  });

  it.each([
    ['seventh', 'seventh'],
    ['seventeen', '17'],
    ['twenty-seventh', '20 seventh'],
    ['I am 30', 'i am 30'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeNumbers(input)).toBe(expected);
  });

  it('Portuguese spellings', () => {
    expect(normalizeNumbers('vinte e um', 'pt')).toBe('21');
    expect(normalizeNumbers('três', 'pt')).toBe('3');
  });
});
