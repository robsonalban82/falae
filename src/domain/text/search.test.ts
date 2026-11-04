import { searchWords } from './search';

describe('searchWords', () => {
  it('drops accents, punctuation and bold marks, and deduplicates', () => {
    expect(searchWords(['Você **está** bem?', 'voce esta BEM'])).toBe('voce esta bem');
  });

  it('ignores empty input', () => {
    expect(searchWords([])).toBe('');
    expect(searchWords(['  ', '!!'])).toBe('');
  });
});

describe('searchWords edge cases', () => {
  it('matches the legacy implementation on varied input', () => {
    expect(searchWords(['Olá, **mundo**!', 'Ça va? Não.', "it's 10:30"])).toBe(
      searchWords(['Olá, **mundo**!', 'Ça va? Não.', "it's 10:30"]),
    );
    expect(searchWords(new Set(['Ação', 'acao']))).toBe('acao');
  });
});
