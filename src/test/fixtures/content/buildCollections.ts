/** Schema-valid collections, deck and plan for tests (not real content). */
export function buildCollections() {
  const cover = (icon: string, color: string) => ({ icon, color, paper: 'pautado' });
  return [
    {
      id: 'frases',
      order: 1,
      kind: 'phrases',
      title: 'Frases do dia a dia',
      subtitle: 'Prontas para usar',
      cover: cover('chat', 'folha'),
      topics: [{ id: 'cumprimentos', title: 'Cumprimentos', icon: 'chat' }],
      entries: [
        { itemId: 'fr-001', topic: 'cumprimentos', situation: 'Quando alguém é apresentado.' },
        { itemId: 'fr-002', topic: 'cumprimentos', situation: 'Com alguém que você conhece.' },
      ],
    },
    {
      id: 'expressoes',
      order: 2,
      kind: 'expressions',
      title: 'Expressões e gírias',
      subtitle: 'Fale como nativo',
      cover: cover('star', 'manga'),
      entries: [
        { itemId: 'fr-001', formality: 'neutro', situation: 'Para encerrar o assunto.' },
        { itemId: 'fr-002', formality: 'giria', avoidWhen: 'Em situação formal.' },
      ],
    },
    {
      id: 'phrasal',
      order: 3,
      kind: 'phrasal-verbs',
      title: 'Phrasal verbs',
      subtitle: 'Verbo + partícula',
      cover: cover('swap', 'jabuticaba'),
      entries: [{ itemId: 't1-sk1-word', baseVerb: 'get' }],
      mapIds: ['mm-test'],
    },
    {
      id: 'falsos-cognatos',
      order: 4,
      kind: 'false-friends',
      title: 'Falsos cognatos',
      subtitle: 'Parece, mas não é',
      cover: cover('ban', 'acerola'),
      entries: [{ itemId: 'fc-001' }],
      mapIds: ['mm-test'],
    },
    {
      id: 'plano',
      order: 5,
      kind: 'study-plan',
      title: '30 dias',
      subtitle: 'Um pouco por dia',
      cover: cover('calendar', 'anil'),
      planId: 'pl-30d',
    },
  ];
}

export function buildDeck(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dk-viagem',
    title: 'Viagem',
    icon: 'pin',
    level: 'A1',
    itemIds: ['t1-sk1-word', 't1-sk2-word', 't1-sk3-word', 't1-sk4-word', 'fr-001'],
    ...overrides,
  };
}

/** 30 days walking the lessons of buildUnit(1) in path order. */
export function buildPlan(overrides: Record<string, unknown> = {}) {
  const lessons = [1, 2, 3, 4].flatMap((s) => [1, 2, 3].map((l) => `t1-sk${s}-l${l}`));
  return {
    id: 'pl-30d',
    title: '30 dias',
    level: 'A1',
    days: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      title: `Dia ${i + 1}`,
      mapId: 'mm-test',
      itemIds: ['t1-sk1-word', 't1-sk2-word', 't1-sk3-word', 't1-sk4-word', 'fr-001'],
      lessonId: lessons[Math.min(lessons.length - 1, Math.floor(i / 3))],
    })),
    ...overrides,
  };
}
