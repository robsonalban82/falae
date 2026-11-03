import { formatIssues, unitSchema } from './schema';
import { bankSchema, courseIssues } from './schemas/course';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank } from '../test/fixtures/content/buildBank';

const units = () => [unitSchema.parse(buildUnit(1))];
const sentence = (id: string, en: string) => ({ id, en, pt: 'p', difficulty: 1 });
const bank = (overrides: Record<string, unknown>) => bankSchema.parse(buildBank(overrides));
const dupMsg = (id: string, bankId: string, en: string, owner: string) =>
  `Item "${id}" do banco ${bankId} repete "${en}", que já é o item "${owner}". Remova-o do banco e faça a coleção apontar para "${owner}".`;

describe('courseIssues — "one place per item" (QA)', () => {
  it('compares en ignoring case, punctuation, spaces, accents and contractions', () => {
    const b = bank({
      sentences: [
        sentence('fr-1', '  HELLO!!! '),
        sentence('fr-2', 'I am thirty years old'),
        sentence('fr-3', 'Café, olá'),
        sentence('fr-4', 'cafe ola?'),
      ],
    });
    expect(courseIssues({ units: units(), banks: [b] })).toEqual([
      dupMsg('fr-1', 'frases', 'HELLO!!!', 't1-sk1-word'),
      dupMsg('fr-2', 'frases', 'I am thirty years old', 't1-sk1-s-hello'),
      dupMsg('fr-4', 'frases', 'cafe ola?', 'fr-3'),
    ]);
  });

  it('a bank vocab and a bank sentence with the same en collide (vocab first)', () => {
    const b = bank({
      vocab: [
        {
          id: 'fr-9',
          en: 'nice to meet you',
          pt: ['prazer'],
          example: { en: 'Nice to meet you, Ana.', pt: 'Prazer, Ana.' },
          difficulty: 1,
        },
      ],
    });
    expect(courseIssues({ units: units(), banks: [b] })).toEqual([
      dupMsg('fr-001', 'frases', 'Nice to meet you.', 'fr-9'),
    ]);
  });

  it('unit items may repeat each other (not a bank rule)', () => {
    // buildUnit uses en "hello" in every skill; that must stay valid
    expect(courseIssues({ units: units(), banks: [] })).toEqual([]);
  });

  it('extra-a1 and extra-a2 share the "xa-" prefix, so their ids must be globally unique', () => {
    const a1 = bank({ id: 'extra-a1', sentences: [sentence('xa-001', 'Okay.')] });
    const a2 = bank({ id: 'extra-a2', sentences: [sentence('xa-001', 'Fine.')] });
    expect(courseIssues({ units: units(), banks: [a1, a2] })).toEqual([
      'Id duplicado "xa-001" (item no banco extra-a1 e item no banco extra-a2).',
    ]);
  });

  it('"fr" or "frases-1" do not satisfy the "fr-" prefix', () => {
    const b = bank({ sentences: [sentence('frases-1', 'See you.'), sentence('fr', 'Bye bye.')] });
    expect(courseIssues({ units: units(), banks: [b] })).toEqual([
      'Item "frases-1" do banco frases precisa começar com "fr-".',
      'Item "fr" do banco frases precisa começar com "fr-".',
    ]);
  });

  it('reports duplicated id, repeated en, wrong prefix and reserved prefix together', () => {
    const b = bank({
      sentences: [
        sentence('fr-1', 'See you.'),
        sentence('fr-1', 'Hello'),
        sentence('uc-1', 'Bye.'),
      ],
    });
    expect(courseIssues({ units: units(), banks: [b] })).toEqual([
      'Id duplicado "fr-1" (item no banco frases e item no banco frases).',
      dupMsg('fr-1', 'frases', 'Hello', 't1-sk1-word'),
      'O id "uc-1" (item no banco frases) usa o prefixo "uc-", reservado para as cartas do aluno.',
      'Item "uc-1" do banco frases precisa começar com "fr-".',
    ]);
  });

  it('accepts empty banks', () => {
    const b = bank({ vocab: [], sentences: [] });
    expect(courseIssues({ units: units(), banks: [b] })).toEqual([]);
  });
});

describe('bankSchema — QA', () => {
  it('reports every field problem at once, in PT-BR where the schema defines it', () => {
    const r = bankSchema.safeParse(
      buildBank({ title: ' ', level: 'a2', sentences: [{ ...sentence('Fr 1', ''), level: 'b1' }] }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(formatIssues(r.error)).toEqual([
      'title: Texto vazio.',
      'level: Nível CEFR inválido; use A1, A2, B1, B2, C1, C2.',
      'sentences › 0 › id: Use ids em kebab-case (ex.: u1-hello).',
      'sentences › 0 › en: Texto vazio.',
      'sentences › 0 › level: Nível CEFR inválido; use A1, A2, B1, B2, C1, C2.',
    ]);
  });
});
