/**
 * Schema-valid mind map for tests, tied to buildUnit(1) items (t1-…) and buildBank (fr-…).
 * Not real content.
 */
export function buildMindMap(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mm-test',
    title: 'Mapa de teste',
    level: 'A1',
    kind: 'gramatica',
    icon: 'book',
    unitId: 't1-unit',
    skillId: 't1-sk1',
    center: { en: 'to be', pt: 'ser / estar' },
    centerArt: 'centro',
    intro: 'Um mapa pequeno para os testes.',
    doodle: 'do maior pro menor!',
    branches: [
      {
        label: 'Afirmativa',
        icon: 'check',
        color: 'folha',
        nodes: [
          {
            tag: 'regra',
            title: 'Cada pessoa, uma **forma**',
            art: 'escola',
            lines: [
              { en: 'I **am**', pt: 'eu sou / estou' },
              { ref: 't1-sk1-word', hint: 'também "oi"' },
              { ref: 't1-sk1-s-hello' },
            ],
          },
        ],
      },
      {
        label: 'Cuidado',
        icon: 'ban',
        color: 'acerola',
        nodes: [
          {
            tag: 'erro-comum',
            lines: [
              { wrong: 'I have 30 years.', right: "I'm 30.", note: 'Idade usa "be".' },
              { note: 'Na conversa, quase sempre contraído.' },
              { ref: 't1-sk2-word' },
              { ref: 'fr-001' },
            ],
          },
        ],
      },
    ],
    quiz: {
      instruction: 'Complete com a forma certa do to be.',
      items: [
        { prompt: 'I ___ happy.', accepted: ['am'], hintPt: 'Eu estou feliz.' },
        { prompt: 'She ___ a teacher.', accepted: ['is'] },
        { prompt: 'They ___ at school.', accepted: ['are', "'re"] },
      ],
    },
    ...overrides,
  };
}
