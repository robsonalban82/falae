import { matchSpokenWords } from './spokenWords';

const missed = (target: string, heard: string) =>
  matchSpokenWords(target, heard)
    .filter((w) => !w.heard)
    .map((w) => w.text);

describe('matchSpokenWords', () => {
  it('everything heard, ignoring case and punctuation', () => {
    expect(matchSpokenWords('Good morning, Ana!', 'good morning ana')).toEqual([
      { text: 'Good', heard: true },
      { text: 'morning,', heard: true },
      { text: 'Ana!', heard: true },
    ]);
  });

  it('marks missing and misheard words', () => {
    expect(missed('Good morning, Ana!', 'good morning anna')).toEqual(['Ana!']);
    expect(missed('I live in Brazil.', 'I leave in Brazil')).toEqual(['live']);
    expect(missed('Good morning, Ana!', '')).toEqual(['Good', 'morning,', 'Ana!']);
  });

  it('keeps the order: a word heard only out of place does not count', () => {
    expect(missed('my name is Ana', 'Ana is my name')).toEqual(['is', 'Ana']);
  });

  it('contractions and numbers match both ways', () => {
    expect(missed("I'm twenty-one.", 'I am 21')).toEqual([]);
    expect(missed('I am 21.', "I'm twenty one")).toEqual([]);
    expect(missed('I am twenty one.', 'I am 21')).toEqual([]);
    expect(missed('I am twenty one.', 'I am 20')).toEqual(['twenty', 'one.']);
  });

  it('extra words in what was heard do not hurt', () => {
    expect(missed('Thank you!', 'uh thank you very much')).toEqual([]);
  });

  it('punctuation-only tokens are never flagged', () => {
    expect(missed('Hi — Ana', 'hi ana')).toEqual([]);
  });
});
