import type { Exercise, ExerciseOf } from '../../content/schema';
import {
  collectKnownWords,
  correctAnswerOf,
  gradeExercise,
  gradeSpeech,
  type ExerciseResponse,
} from './grade';

const ctx = {
  knownWords: collectKnownWords([
    { text: 'then than quite quiet morning good night brother', lang: 'en' },
    { text: 'irmão irmã bom dia', lang: 'pt' },
  ]),
};
const text = (value: string): ExerciseResponse => ({ kind: 'text', value });
const choice = (value: string): ExerciseResponse => ({ kind: 'choice', value });

const wordBank: ExerciseOf<'word-bank'> = {
  id: 'e-wb',
  type: 'word-bank',
  itemIds: ['x'],
  promptPt: 'Eu tenho trinta anos.',
  answer: "I'm thirty years old.",
  accepted: ["[I'm|I am] [thirty|30] (years old)"],
  distractors: ['have', 'is'],
};

const translate: ExerciseOf<'translate-typing'> = {
  id: 'e-tt',
  type: 'translate-typing',
  itemIds: ['x'],
  promptEn: 'Good morning, my brother!',
  accepted: ['Bom dia, [meu irmão|mano]!'],
};

const listen: ExerciseOf<'listen-type'> = {
  id: 'e-lt',
  type: 'listen-type',
  itemIds: ['x'],
  textEn: "It's quiet tonight.",
};

describe('free-text grading', () => {
  it.each([
    "I'm thirty years old.",
    'i am thirty years old',
    'I am 30',
    "I'M THIRTY",
    'I am thirty years old!!!',
  ])('word-bank accepts %s', (value) => {
    expect(gradeExercise(wordBank, text(value), ctx).verdict).toBe('correct');
  });

  it('word-bank rejects the classic Brazilian mistake and never gives "almost"', () => {
    expect(gradeExercise(wordBank, text('I have thirty years'), ctx)).toEqual({
      verdict: 'wrong',
      correctAnswer: "I'm thirty years old.",
    });
    expect(gradeExercise(wordBank, text("I'm thirty yeers old"), ctx).verdict).toBe('wrong');
  });

  it.each(['Bom dia, meu irmão!', 'bom dia meu irmao', 'BOM DIA, MANO', 'Bom   dia,meu irmão.'])(
    'translate accepts %s',
    (value) => {
      expect(gradeExercise(translate, text(value), ctx).verdict).toBe('correct');
    },
  );

  it('returns the matching display form on success', () => {
    expect(gradeExercise(translate, text('bom dia mano'), ctx).correctAnswer).toBe(
      'Bom dia, mano!',
    );
  });

  it('forgives one typo in a long word that is not a real word', () => {
    const r = gradeExercise(translate, text('Bom dia, meu irmaoo'), ctx);
    expect(r).toEqual({ verdict: 'almost', correctAnswer: 'Bom dia, meu irmão!', note: 'typo' });
  });

  it('does not forgive typos in short words', () => {
    expect(gradeExercise(translate, text('Bom diz, meu irmão'), ctx).verdict).toBe('wrong');
  });

  it('does not forgive two typos or two wrong words', () => {
    expect(gradeExercise(translate, text('Bom dia, meu irmaooo'), ctx).verdict).toBe('wrong');
    expect(gradeExercise(translate, text('Boa noite, meu irmão'), ctx).verdict).toBe('wrong');
  });

  it('does not treat a different real word as a typo (quite vs quiet)', () => {
    expect(gradeExercise(listen, text("It's quite tonight"), ctx).verdict).toBe('wrong');
    expect(gradeExercise(listen, text("It's quiett tonight"), ctx).verdict).toBe('almost');
  });

  it('rejects empty or whitespace answers and wrong response kinds', () => {
    expect(gradeExercise(translate, text('   '), ctx).verdict).toBe('wrong');
    expect(gradeExercise(translate, text('!!!'), ctx).verdict).toBe('wrong');
    expect(gradeExercise(translate, choice('Bom dia'), ctx).verdict).toBe('wrong');
  });

  it('accepts "its" typed for "it\'s" only when that makes the answer right', () => {
    const clock: ExerciseOf<'listen-type'> = {
      id: 'e-c',
      type: 'listen-type',
      itemIds: ['x'],
      textEn: "It's seven o'clock.",
    };
    expect(gradeExercise(clock, text('its seven oclock'), ctx).verdict).toBe('correct');
    const tail: ExerciseOf<'listen-type'> = {
      id: 'e-d',
      type: 'listen-type',
      itemIds: ['x'],
      textEn: 'The dog wagged its tail.',
    };
    expect(gradeExercise(tail, text('the dog wagged its tail'), ctx).verdict).toBe('correct');
    expect(gradeExercise(tail, text("the dog wagged it's tail"), ctx).verdict).toBe('wrong');
  });

  it('listen-type accepts contractions either way', () => {
    expect(gradeExercise(listen, text('it is quiet tonight'), ctx).verdict).toBe('correct');
  });
});

describe('choice grading', () => {
  const mc: Exercise = {
    id: 'e-mc',
    type: 'multiple-choice',
    itemIds: ['x'],
    prompt: 'Qual é "irmão"?',
    options: [{ text: 'brother' }, { text: 'sister' }, { text: 'father' }],
    answer: 'brother',
  };
  const fb: Exercise = {
    id: 'e-fb',
    type: 'fill-blank',
    itemIds: ['x'],
    sentence: 'I ___ thirty.',
    options: ['am', 'have', 'is'],
    answer: 'am',
    translationPt: 'Eu tenho trinta anos.',
  };

  it('multiple-choice', () => {
    expect(gradeExercise(mc, choice('brother'), ctx).verdict).toBe('correct');
    expect(gradeExercise(mc, choice('sister'), ctx)).toEqual({
      verdict: 'wrong',
      correctAnswer: 'brother',
    });
  });

  it('fill-blank shows the full sentence as the correct answer', () => {
    expect(gradeExercise(fb, choice('am'), ctx).verdict).toBe('correct');
    expect(gradeExercise(fb, choice('have'), ctx)).toEqual({
      verdict: 'wrong',
      correctAnswer: 'I am thirty.',
    });
  });

  it('match-pairs is correct once completed', () => {
    const mp: Exercise = {
      id: 'e-mp',
      type: 'match-pairs',
      itemIds: ['x'],
      pairs: [
        { en: 'a', pt: 'a1' },
        { en: 'b', pt: 'b1' },
        { en: 'c', pt: 'c1' },
        { en: 'd', pt: 'd1' },
      ],
    };
    expect(gradeExercise(mp, { kind: 'pairs', mistakes: 2 }, ctx).verdict).toBe('correct');
    expect(correctAnswerOf(mp)).toContain('a = a1');
  });
});

describe('speech grading', () => {
  it('accepts exact and contracted transcripts', () => {
    expect(gradeSpeech("I'm thirty years old", ['I am 30 years old'])).toBe(true);
  });

  it('accepts when 80% of the words are recognized in order', () => {
    expect(gradeSpeech('nice to meet you too', ['nice to meet you'])).toBe(true);
  });

  it('rejects poor recognition but checks every alternative', () => {
    expect(gradeSpeech('nice to meet you', ['ice cream'])).toBe(false);
    expect(gradeSpeech('nice to meet you', ['ice cream', 'nice to meet you'])).toBe(true);
    expect(gradeSpeech('nice to meet you', [])).toBe(false);
  });

  it('rejects the right words in the wrong order', () => {
    expect(gradeSpeech('you meet to nice', ['nice to meet you'])).toBe(false);
  });
});
