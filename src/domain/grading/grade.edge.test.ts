import type { Exercise } from '../../content/schema';
import { collectKnownWords, gradeExercise, gradeSpeech, type ExerciseResponse } from './grade';
import { normalize } from './normalize';

/** QA edge cases for the grader, written as a learner would actually type on a phone. */

const ctx = {
  knownWords: collectKnownWords([
    { text: 'hello thanks bye please quite quiet then than three there their', lang: 'en' },
    { text: 'olá obrigado obrigada tchau por favor muito prazer conhecer', lang: 'pt' },
  ]),
};
const text = (value: string): ExerciseResponse => ({ kind: 'text', value });

const translate = (accepted: string[]): Exercise => ({
  id: 'q-tt',
  type: 'translate-typing',
  itemIds: ['x'],
  promptEn: 'p',
  accepted,
});
const listen = (textEn: string, accepted?: string[]): Exercise => ({
  id: 'q-lt',
  type: 'listen-type',
  itemIds: ['x'],
  textEn,
  ...(accepted ? { accepted } : {}),
});
const bank = (answer: string, accepted?: string[]): Exercise => ({
  id: 'q-wb',
  type: 'word-bank',
  itemIds: ['x'],
  promptPt: 'p',
  answer,
  distractors: ['zzz', 'yyy'],
  ...(accepted ? { accepted } : {}),
});
const verdict = (ex: Exercise, v: string) => gradeExercise(ex, text(v), ctx).verdict;

describe('acentos, maiúsculas e pontuação (PT)', () => {
  const ex = translate(['[Muito obrigado|Muito obrigada|Valeu]!']);
  it.each([
    'muito obrigado',
    'MUITO OBRIGADO!!!',
    'Muito obrigado.',
    '  muito   obrigada  ',
    'valeu',
    'Valeu!!',
    'muito obrigado 🙏',
    'muito, obrigado',
    '¡Muito obrigado!',
  ])('"%s" is correct', (v) => expect(verdict(ex, v)).toBe('correct'));

  it('accent-insensitive in both directions', () => {
    const ac = translate(['Você está ótimo, João']);
    expect(verdict(ac, 'voce esta otimo joao')).toBe('correct');
    const plain = translate(['Voce esta otimo']);
    expect(verdict(plain, 'Você está ótimo')).toBe('correct');
  });

  it('cedilla, til and decomposed unicode (NFD from some keyboards)', () => {
    const ex2 = translate(['Não, obrigação']);
    expect(verdict(ex2, 'nao obrigacao')).toBe('correct');
    expect(verdict(ex2, 'Não, obrigação')).toBe('correct');
  });

  it('curly quotes and apostrophes from iOS keyboards', () => {
    const lt = listen("I'm Ana.");
    expect(verdict(lt, 'I’m Ana')).toBe('correct');
    expect(verdict(lt, 'I`m Ana')).toBe('correct');
  });
});

describe('contrações (EN)', () => {
  const lt = listen("I'm thirty years old.");
  it.each([
    "I'm thirty years old",
    'I am thirty years old',
    "i'm 30 years old",
    'I am 30 years old.',
  ])('"%s" is correct', (v) => expect(verdict(lt, v)).toBe('correct'));

  it('negative contractions both ways', () => {
    expect(verdict(listen("I don't know."), 'I do not know')).toBe('correct');
    expect(verdict(listen('She does not like it.'), "She doesn't like it")).toBe('correct');
    expect(verdict(listen("I can't swim."), 'I cannot swim')).toBe('correct');
    expect(verdict(listen("I can't swim."), 'I can not swim')).toBe('correct');
  });

  it('wrong contraction is still wrong', () => {
    expect(verdict(listen("He's tall."), "She's tall")).toBe('wrong');
    expect(verdict(listen("I'm tired."), "I'll tired")).toBe('wrong');
  });

  it('contraction typed without apostrophe on a phone keyboard is accepted (fixed)', () => {
    expect(verdict(lt, 'Im thirty years old')).toBe('correct');
    expect(verdict(listen("I don't know."), 'I dont know')).toBe('correct');
    expect(verdict(listen("I can't swim."), 'I cant swim')).toBe('correct');
    expect(verdict(listen("She doesn't like it."), 'She doesnt like it')).toBe('correct');
    expect(verdict(listen("You're nice."), 'Youre nice')).toBe('correct');
    expect(verdict(listen("I've got it."), 'Ive got it')).toBe('correct');
    expect(verdict(listen("Let's go."), 'Lets go')).toBe('correct');
  });

  it('apostrophe-less forms that are real words stay words (its/were/well/ill/wont)', () => {
    expect(verdict(listen('The dog wagged its tail.'), 'The dog wagged its tail')).toBe('correct');
    expect(verdict(listen('We were happy.'), 'We were happy')).toBe('correct');
    expect(verdict(listen('I am well.'), 'I am well')).toBe('correct');
    expect(verdict(listen("We're happy."), 'Were happy')).toBe('wrong');
    expect(verdict(listen("I'll go."), 'Ill go')).toBe('wrong');
    expect(normalize("it's", 'en')).not.toBe(normalize('its', 'en'));
  });
});

describe('números', () => {
  it('EN digits ↔ words, including hyphenated and "a hundred"', () => {
    expect(verdict(listen('I am 21.'), 'I am twenty-one')).toBe('correct');
    expect(verdict(listen('I am 21.'), 'I am twenty one')).toBe('correct');
    expect(verdict(listen('She is twenty-one.'), 'She is 21')).toBe('correct');
    expect(verdict(listen('I have 100 books.'), 'I have a hundred books')).toBe('correct');
    expect(verdict(listen('I have 100 books.'), 'I have one hundred books')).toBe('correct');
    expect(verdict(listen('It is zero.'), 'It is 0')).toBe('correct');
  });

  it('PT digits ↔ words with "e"', () => {
    const ex = translate(['Eu tenho vinte e um anos']);
    expect(verdict(ex, 'eu tenho 21 anos')).toBe('correct');
    expect(verdict(translate(['Tenho 14 anos']), 'tenho catorze anos')).toBe('correct');
    expect(verdict(translate(['Tenho 14 anos']), 'tenho quatorze anos')).toBe('correct');
    expect(verdict(translate(['São duas horas']), 'são 2 horas')).toBe('correct');
  });

  it('time 5:30 equals "5 30"', () => {
    expect(verdict(listen("It's 5:30."), 'It is 5 30')).toBe('correct');
  });

  it('a different number is wrong (never "almost")', () => {
    expect(verdict(listen("I'm thirty."), "I'm thirteen")).toBe('wrong');
    expect(verdict(listen("I'm 30."), "I'm 31")).toBe('wrong');
    expect(verdict(translate(['Tenho trinta anos']), 'tenho treze anos')).toBe('wrong');
  });

  it('"to" and "too" are not turned into "two"', () => {
    expect(normalize('Nice to meet you too', 'en')).toBe('nice to meet you too');
  });
});

describe('quase certo (1 erro de digitação)', () => {
  const ex = translate(['Prazer em te conhecer']);
  it('one wrong letter in a long word → almost, with the right answer shown', () => {
    const r = gradeExercise(ex, text('prazer em te conheser'), ctx);
    expect(r).toMatchObject({
      verdict: 'almost',
      correctAnswer: 'Prazer em te conhecer',
      note: 'typo',
    });
  });

  it('missing or extra letter also counts as one typo', () => {
    expect(verdict(ex, 'prazer em te conhecr')).toBe('almost');
    expect(verdict(ex, 'prazer em te conhecerr')).toBe('almost');
  });

  it('two typos in one word, or typos in two words → wrong', () => {
    expect(verdict(ex, 'prazer em te conhesr')).toBe('wrong');
    expect(verdict(ex, 'prazr em te conheser')).toBe('wrong');
  });

  it('typo in a short word (< 5 letters) → wrong', () => {
    expect(verdict(ex, 'prazer em ti conhecer')).toBe('wrong');
  });

  it('a typo that forms another known word → wrong (no false positive)', () => {
    expect(verdict(listen('It is quiet.'), 'It is quite')).toBe('wrong');
    expect(verdict(listen('Bigger than me.'), 'Bigger then me')).toBe('wrong');
  });

  it('missing word is never "almost"', () => {
    expect(verdict(ex, 'prazer te conhecer')).toBe('wrong');
  });

  it('word-bank never returns almost', () => {
    expect(verdict(bank('Nice to meet you.'), 'Nice to meat you')).toBe('wrong');
  });

  it('transposed letters (distance 2) are treated as wrong — documented behaviour', () => {
    // Damerau would forgive "conehcer"; current Levenshtein does not.
    expect(verdict(ex, 'prazer em te conehcer')).toBe('wrong');
  });
});

describe('respostas vazias e lixo', () => {
  const ex = translate(['Olá']);
  it.each(['', '   ', '!!!', '...', '🙂', '\n\t'])('"%s" → wrong, never throws', (v) => {
    expect(verdict(ex, v)).toBe('wrong');
  });

  it('very long input does not hang', () => {
    const t0 = performance.now();
    expect(verdict(ex, 'a'.repeat(20_000))).toBe('wrong');
    expect(verdict(ex, 'olá '.repeat(2_000))).toBe('wrong');
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('extra words are wrong', () => {
    expect(verdict(ex, 'olá olá')).toBe('wrong');
    expect(verdict(listen('Hello.'), 'Hello there')).toBe('wrong');
  });
});

describe('alternativas e word-bank', () => {
  it('word-bank accepts each listed alternative and the plain answer', () => {
    const ex = bank("I'm thirty years old.", ["[I'm|I am] [thirty|30] (years old)"]);
    for (const v of ["I'm thirty years old", 'I am thirty', "I'm 30", 'I am thirty years old']) {
      expect(verdict(ex, v), v).toBe('correct');
    }
    expect(verdict(ex, 'I have thirty years')).toBe('wrong');
  });

  it('word order matters', () => {
    expect(verdict(bank('Nice to meet you.'), 'to Nice meet you')).toBe('wrong');
  });

  it('multiple-choice and fill-blank ignore case/spaces but not content', () => {
    const mc: Exercise = {
      id: 'q-mc',
      type: 'multiple-choice',
      itemIds: ['x'],
      prompt: 'p',
      options: [{ text: 'hello' }, { text: 'bye' }, { text: 'thanks' }],
      answer: 'hello',
    };
    expect(gradeExercise(mc, { kind: 'choice', value: ' Hello ' }, ctx).verdict).toBe('correct');
    expect(gradeExercise(mc, { kind: 'choice', value: 'bye' }, ctx).verdict).toBe('wrong');
    expect(gradeExercise(mc, { kind: 'text', value: 'hello' }, ctx).verdict).toBe('wrong');
  });
});

describe('fala', () => {
  it('80% threshold: 4 of 5 words passes, 3 of 5 fails', () => {
    const target = 'Hello my name is Ana';
    expect(gradeSpeech(target, ['hello my name is'])).toBe(true);
    expect(gradeSpeech(target, ['hello name Ana'])).toBe(false);
  });

  it('recognizer output with digits/contractions matches the written target', () => {
    expect(gradeSpeech("I'm thirty years old.", ['I am 30 years old'])).toBe(true);
  });

  it('empty transcripts fail', () => {
    expect(gradeSpeech('Hello', [])).toBe(false);
    expect(gradeSpeech('Hello', [''])).toBe(false);
  });

  it('extra filler words do not hurt', () => {
    expect(gradeSpeech('Nice to meet you', ['uh nice to meet you too'])).toBe(true);
  });
});
