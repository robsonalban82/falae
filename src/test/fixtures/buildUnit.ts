import type { Exercise } from '../../content/schema';

/**
 * Builds a schema-valid unit for tests. `n` makes ids unique so several
 * units can coexist in one course. Not real content.
 */
export function buildUnit(n = 1, overrides: Record<string, unknown> = {}) {
  const p = `t${n}`;
  const skills = [1, 2, 3, 4].map((s) => {
    const vocabId = `${p}-sk${s}-word`;
    const sentenceId = `${p}-sk${s}-s-hello`;
    return {
      id: `${p}-sk${s}`,
      title: `Habilidade ${s}`,
      icon: '👋',
      tip: {
        title: 'Dica',
        blocks: [
          { kind: 'text', md: 'Texto **curto**.' },
          { kind: 'examples', items: [{ en: 'Hello!', pt: 'Olá!' }] },
          { kind: 'pitfall', wrong: 'I have 30 years.', right: "I'm 30.", why: 'Idade usa "be".' },
        ],
      },
      vocab: [
        {
          id: vocabId,
          en: 'hello',
          pt: ['olá'],
          acceptedPt: ['[oi|e aí]'],
          example: { en: 'Hello, Ana!', pt: 'Olá, Ana!' },
          emoji: '👋',
          difficulty: 1,
        },
      ],
      sentences: [
        {
          id: sentenceId,
          en: "I'm thirty years old.",
          pt: 'Eu tenho trinta anos.',
          acceptedPt: ['(Eu) tenho [trinta|30] anos'],
          difficulty: 2,
          focus: 'idade-com-be',
        },
      ],
      lessons: [1, 2, 3].map((l) => ({
        id: `${p}-sk${s}-l${l}`,
        exercises: buildExercises(`${p}-sk${s}-l${l}`, vocabId, sentenceId),
      })),
    };
  });
  return {
    id: `${p}-unit`,
    order: n,
    title: `Unidade ${n}`,
    description: 'Unidade de teste',
    color: 'manga',
    skills,
    reviewLesson: {
      id: `${p}-review`,
      exercises: buildExercises(`${p}-review`, `${p}-sk1-word`, `${p}-sk1-s-hello`),
    },
    ...overrides,
  };
}

export function buildExercises(prefix: string, vocabId: string, sentenceId: string): Exercise[] {
  const all: Exercise[] = [
    {
      id: `${prefix}-e1`,
      type: 'multiple-choice',
      itemIds: [vocabId],
      prompt: 'Qual destas é "olá"?',
      options: [{ text: 'hello', emoji: '👋' }, { text: 'bye' }, { text: 'thanks' }],
      answer: 'hello',
    },
    {
      id: `${prefix}-e2`,
      type: 'word-bank',
      itemIds: [sentenceId],
      promptPt: 'Eu tenho trinta anos.',
      answer: "I'm thirty years old.",
      accepted: ["[I'm|I am] [thirty|30] (years old)"],
      distractors: ['have', 'is'],
      explanation: 'Em inglês, idade usa o verbo "be".',
    },
    {
      id: `${prefix}-e3`,
      type: 'translate-typing',
      itemIds: [vocabId],
      promptEn: 'Hello!',
      accepted: ['[Olá|Oi]!'],
    },
    { id: `${prefix}-e4`, type: 'listen-type', itemIds: [vocabId], textEn: 'Hello!' },
    { id: `${prefix}-e5`, type: 'speak', itemIds: [sentenceId], textEn: "I'm thirty years old." },
    {
      id: `${prefix}-e6`,
      type: 'match-pairs',
      itemIds: [vocabId],
      pairs: [
        { en: 'hello', pt: 'olá' },
        { en: 'bye', pt: 'tchau' },
        { en: 'thanks', pt: 'obrigado' },
        { en: 'please', pt: 'por favor' },
      ],
    },
    {
      id: `${prefix}-e7`,
      type: 'fill-blank',
      itemIds: [sentenceId],
      sentence: 'I ___ thirty years old.',
      options: ['am', 'have', 'is'],
      answer: 'am',
      translationPt: 'Eu tenho trinta anos.',
    },
  ];
  // Pad to 10 exercises by cycling with new ids.
  const out: Exercise[] = [...all];
  for (let i = 0; out.length < 10; i++) {
    const base = all[i % all.length] as Exercise;
    out.push({ ...base, id: `${prefix}-e${out.length + 1}` });
  }
  return out;
}
