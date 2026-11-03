import type { z } from 'zod';
import { formatIssues } from '../schema';
import { mapLineSchema, mapQuizItemSchema, mindMapSchema } from './mindmap';
import { buildMindMap } from '../../test/fixtures/content/buildMindMap';

type AnyRecord = Record<string, unknown>;
const lines = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : formatIssues(r.error);
};
const branches = (map: AnyRecord) => map.branches as AnyRecord[];
const nodesOf = (map: AnyRecord, i = 0) => branches(map)[i]!.nodes as AnyRecord[];
const linesOf = (map: AnyRecord, b = 0, n = 0) => nodesOf(map, b)[n]!.lines as AnyRecord[];
const colors = ['folha', 'acerola', 'jabuticaba', 'anil', 'manga', 'maracuja'];
const plainBranch = (color: string) => ({
  label: `Ramo ${color}`,
  icon: 'pin',
  color,
  nodes: [{ tag: 'exemplo', lines: [{ note: 'x' }] }],
});

describe('mapLineSchema — QA', () => {
  it('reports the field error of the matching form, not the generic union message', () => {
    expect(lines(mapLineSchema, { ref: 'U1 Hi' })).toEqual([
      'ref: Use ids em kebab-case (ex.: u1-hello).',
    ]);
    expect(lines(mapLineSchema, { en: 'a **b', pt: 'x' })).toEqual([
      'en: Negrito "**" inválido: use pares, sem espaço nem "*" nas pontas.',
    ]);
    expect(lines(mapLineSchema, { en: '  ', pt: '' })).toEqual([
      'en: Texto vazio.',
      'pt: Texto vazio.',
    ]);
    expect(lines(mapLineSchema, { wrong: '', right: 'ok' })).toEqual(['wrong: Texto vazio.']);
  });

  it('rejects a line with only "right" and mixed forms (ref + en)', () => {
    const generic =
      '(raiz): Linha inválida: use { ref }, { en, pt }, { wrong, right } ou { note }.';
    expect(lines(mapLineSchema, { right: 'I am 30.' })).toEqual([generic]);
    expect(lines(mapLineSchema, { ref: 'u1-hi', en: 'hi' })).toEqual([generic]);
    expect(lines(mapLineSchema, { note: 5 })).toEqual([generic]);
    expect(lines(mapLineSchema, null)).toEqual([generic]);
  });

  it('accepts en without pt, and wrong/right without note', () => {
    expect(lines(mapLineSchema, { en: 'I **am** here' })).toEqual([]);
    expect(lines(mapLineSchema, { wrong: 'I have 30 years.', right: "I'm 30." })).toEqual([]);
  });

  it('hint limit: 60 characters (accents count once, surrounding spaces are trimmed)', () => {
    expect(lines(mapLineSchema, { ref: 'u1-hi', hint: 'é'.repeat(60) })).toEqual([]);
    expect(lines(mapLineSchema, { ref: 'u1-hi', hint: `  ${'a'.repeat(60)}  ` })).toEqual([]);
    expect(lines(mapLineSchema, { ref: 'u1-hi', hint: 'é'.repeat(61) })).toEqual([
      'hint: O hint tem no máximo 60 caracteres.',
    ]);
    expect(lines(mapLineSchema, { ref: 'u1-hi', hint: '' })).toEqual(['hint: Texto vazio.']);
  });
});

describe('mindMapSchema — QA limits', () => {
  it('accepts exactly 2 and exactly 6 branches', () => {
    const two = buildMindMap() as AnyRecord;
    expect(branches(two)).toHaveLength(2);
    expect(lines(mindMapSchema, two)).toEqual([]);
    const six = buildMindMap() as AnyRecord;
    six.branches = [...branches(six), ...colors.slice(2).map(plainBranch)];
    expect(branches(six)).toHaveLength(6);
    expect(lines(mindMapSchema, six)).toEqual([]);
  });

  it('accepts exactly 4 distinct refs', () => {
    // fixture has exactly 4 distinct refs
    const map = buildMindMap() as AnyRecord;
    const refs = branches(map)
      .flatMap((b) => (b.nodes as AnyRecord[]).flatMap((n) => n.lines as AnyRecord[]))
      .filter((l) => 'ref' in l);
    expect(new Set(refs.map((l) => l.ref)).size).toBe(4);
    expect(lines(mindMapSchema, map)).toEqual([]);
  });

  it('counts refs once even across branches; 0 refs reports a single error', () => {
    const map = buildMindMap() as AnyRecord;
    for (const b of [0, 1]) {
      nodesOf(map, b)[0]!.lines = [{ note: 'só texto' }];
    }
    expect(lines(mindMapSchema, map)).toEqual([
      'branches: O mapa precisa de pelo menos 4 linhas com "ref" distintos (para "Praticar este mapa").',
    ]);
  });

  it('accepts 3 and 6 quiz items, rejects 7', () => {
    const item = { prompt: 'I ___ ok.', accepted: ['am'] };
    const quiz = (n: number) =>
      buildMindMap({ quiz: { instruction: 'Complete.', items: Array(n).fill(item) } });
    expect(lines(mindMapSchema, quiz(3))).toEqual([]);
    expect(lines(mindMapSchema, quiz(6))).toEqual([]);
    expect(lines(mindMapSchema, quiz(7))).toEqual([
      'quiz › items: O teste rápido tem de 3 a 6 itens.',
    ]);
  });

  it('accepts the blank at the start, the end, or glued to punctuation', () => {
    for (const prompt of ['___ he at school?', 'Good ___', 'Kids, get ___!', '8:30 = eight ___']) {
      expect(lines(mapQuizItemSchema, { prompt, accepted: ['x'] }), prompt).toEqual([]);
    }
  });

  it('rejects 4+ underscores as an ambiguous blank', () => {
    for (const prompt of ['I ____ ok.', 'I ______ ok.']) {
      expect(lines(mapQuizItemSchema, { prompt, accepted: ['x'] }), prompt).toEqual([
        'prompt: O enunciado precisa de exatamente uma lacuna "___".',
      ]);
    }
  });

  it('reports several broken lines and the ref rule at once, in PT-BR', () => {
    const map = buildMindMap() as AnyRecord;
    const l = linesOf(map);
    l[0] = { en: '**I am', pt: 'x' };
    l[1] = { ref: 'Bad Ref' };
    l[2] = { right: 'só right' };
    const out = lines(mindMapSchema, map);
    expect(out).toContain(
      'branches › 0 › nodes › 0 › lines › 0 › en: Negrito "**" inválido: use pares, sem espaço nem "*" nas pontas.',
    );
    expect(out).toContain(
      'branches › 0 › nodes › 0 › lines › 1 › ref: Use ids em kebab-case (ex.: u1-hello).',
    );
    expect(out).toContain(
      'branches › 0 › nodes › 0 › lines › 2: Linha inválida: use { ref }, { en, pt }, { wrong, right } ou { note }.',
    );
  });

  it('rejects the prototype "exercise" key and lowercase level in PT-BR', () => {
    const out = lines(mindMapSchema, buildMindMap({ level: 'a1', exercise: {} }));
    expect(out).toEqual([
      'level: Nível CEFR inválido; use A1, A2, B1, B2, C1, C2.',
      '(raiz): Campo desconhecido: "exercise".',
    ]);
  });
});
