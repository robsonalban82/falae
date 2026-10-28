import type { Exercise } from '../content/schema';

/**
 * Developer/E2E fixture: a small unit that exercises all 7 exercise types so the lesson
 * engine can be played before the real course exists. Loaded only with VITE_DEMO=1.
 * Not course content — real lessons live in src/content/units (autor-de-conteudo).
 */

const hello = 'demo-hello';
const thanks = 'demo-thanks';
const nice = 'demo-s-nice';
const age = 'demo-s-age';

const lessonOne: Exercise[] = [
  {
    id: 'e01',
    type: 'multiple-choice',
    itemIds: [hello],
    prompt: 'Qual destas significa "olá"?',
    options: [
      { text: 'hello', emoji: '👋' },
      { text: 'thanks', emoji: '🙏' },
      { text: 'bye', emoji: '🚪' },
    ],
    answer: 'hello',
  },
  {
    id: 'e02',
    type: 'match-pairs',
    itemIds: [hello, thanks],
    pairs: [
      { en: 'hello', pt: 'olá' },
      { en: 'thanks', pt: 'obrigado' },
      { en: 'bye', pt: 'tchau' },
      { en: 'please', pt: 'por favor' },
    ],
  },
  {
    id: 'e03',
    type: 'word-bank',
    itemIds: [nice],
    promptPt: 'Prazer em te conhecer.',
    answer: 'Nice to meet you.',
    accepted: ['[Nice|Pleased] to meet you'],
    distractors: ['know', 'for'],
  },
  {
    id: 'e04',
    type: 'translate-typing',
    itemIds: [thanks],
    promptEn: 'Thanks a lot!',
    accepted: ['[Muito obrigado|Muito obrigada|Valeu]!'],
  },
  {
    id: 'e05',
    type: 'fill-blank',
    itemIds: [age],
    sentence: 'I ___ thirty years old.',
    options: ['am', 'have', 'is'],
    answer: 'am',
    translationPt: 'Eu tenho trinta anos.',
    explanation: 'Em inglês, idade usa o verbo "be": I am 30 (não "I have 30 years").',
  },
  { id: 'e06', type: 'listen-type', itemIds: [nice], textEn: 'Nice to meet you.' },
  { id: 'e07', type: 'speak', itemIds: [hello], textEn: 'Hello, my name is Ana.' },
  {
    id: 'e08',
    type: 'word-bank',
    itemIds: [age],
    promptPt: 'Eu tenho trinta anos.',
    answer: "I'm thirty years old.",
    accepted: ["[I'm|I am] [thirty|30] (years old)"],
    distractors: ['have', 'is'],
    explanation: 'Idade em inglês: "I\'m 30" ou "I\'m 30 years old".',
  },
  {
    id: 'e09',
    type: 'multiple-choice',
    itemIds: [thanks],
    prompt: 'Como se diz "obrigado"?',
    options: [
      { text: 'sorry', emoji: '😅' },
      { text: 'thanks', emoji: '🙏' },
      { text: 'hello', emoji: '👋' },
    ],
    answer: 'thanks',
  },
  {
    id: 'e10',
    type: 'translate-typing',
    itemIds: [nice],
    promptEn: 'Nice to meet you, Ana.',
    accepted: ['(É um) prazer [em|de] [te|lhe] conhecer, Ana', 'Prazer, Ana', 'Muito prazer, Ana'],
  },
];

// Clone hand-written exercises with unique ids for the other lessons (ids are global).
function lessonFrom(prefix: string): { id: string; exercises: Exercise[] } {
  return { id: prefix, exercises: lessonOne.map((e) => ({ ...e, id: `${prefix}-${e.id}` })) };
}

export const demoUnit = {
  id: 'demo-unit',
  order: 99,
  title: 'Demo do motor de lição',
  description: 'Unidade de desenvolvimento com todos os tipos de exercício.',
  color: 'anil',
  skills: [1, 2, 3, 4].map((s) => ({
    id: `demo-sk${s}`,
    title: `Demo ${s}`,
    icon: '🧪',
    tip: {
      title: 'Dica de demonstração',
      blocks: [
        { kind: 'text', md: 'Idade em inglês usa o verbo **be**.' },
        { kind: 'examples', items: [{ en: "I'm 30.", pt: 'Tenho 30 anos.' }] },
        {
          kind: 'pitfall',
          wrong: 'I have 30 years.',
          right: "I'm 30.",
          why: 'Em inglês você "é" a idade.',
        },
      ],
    },
    vocab:
      s === 1
        ? [
            {
              id: hello,
              en: 'hello',
              pt: ['olá'],
              acceptedPt: ['oi'],
              example: { en: 'Hello, Ana!', pt: 'Olá, Ana!' },
              emoji: '👋',
              difficulty: 1,
            },
            {
              id: thanks,
              en: 'thanks',
              pt: ['obrigado', 'obrigada'],
              acceptedPt: ['valeu'],
              example: { en: 'Thanks, João!', pt: 'Obrigado, João!' },
              emoji: '🙏',
              difficulty: 1,
            },
          ]
        : [],
    sentences:
      s === 1
        ? [
            {
              id: nice,
              en: 'Nice to meet you.',
              pt: 'Prazer em te conhecer.',
              acceptedPt: ['(Muito) prazer', 'Prazer em [te|lhe] conhecer'],
              difficulty: 2,
            },
            {
              id: age,
              en: "I'm thirty years old.",
              pt: 'Eu tenho trinta anos.',
              acceptedPt: ['(Eu) tenho [trinta|30] anos (de idade)'],
              difficulty: 2,
              focus: 'idade-com-be',
            },
          ]
        : [],
    lessons: [1, 2, 3].map((l) => lessonFrom(`demo-sk${s}-l${l}`)),
  })),
  reviewLesson: lessonFrom('demo-review'),
};
