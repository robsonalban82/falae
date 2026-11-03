/** Schema-valid banks for tests (not real content). */
export function buildBank(overrides: Record<string, unknown> = {}) {
  return {
    id: 'frases',
    title: 'Frases do dia a dia',
    level: 'A1',
    vocab: [],
    sentences: [
      { id: 'fr-001', en: 'Nice to meet you.', pt: 'Prazer em te conhecer.', difficulty: 1 },
      { id: 'fr-002', en: 'How are you doing?', pt: 'Tudo bem?', difficulty: 1 },
      { id: 'fr-003', en: "That's a bummer.", pt: 'Que chato.', difficulty: 3, level: 'B1' },
    ],
    ...overrides,
  };
}

export function buildFalseFriendsBank(overrides: Record<string, unknown> = {}) {
  return {
    id: 'falsos-cognatos',
    title: 'Falsos cognatos',
    level: 'A2',
    vocab: [
      {
        id: 'fc-001',
        en: 'pretend',
        pt: ['fingir'],
        example: { en: 'He pretends to work.', pt: 'Ele finge que trabalha.' },
        pronunciation: 'pritÉnd',
        difficulty: 2,
        focus: 'falso-cognato',
        notes: 'Pretend NÃO é "pretender". Pretender = intend.',
      },
    ],
    sentences: [],
    ...overrides,
  };
}
