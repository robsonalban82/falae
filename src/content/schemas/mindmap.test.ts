import { formatIssues } from '../schema';
import { mapLineSchema, mindMapSchema, nodeCount, mapRefs } from './mindmap';
import { buildMindMap } from '../../test/fixtures/content/buildMindMap';

type AnyRecord = Record<string, unknown>;
const lines = (value: unknown) => {
  const r = mindMapSchema.safeParse(value);
  return r.success ? [] : formatIssues(r.error);
};
const branches = (map: AnyRecord) => map.branches as AnyRecord[];
const nodesOf = (map: AnyRecord, i = 0) => branches(map)[i]!.nodes as AnyRecord[];
const linesOf = (map: AnyRecord, b = 0, n = 0) => nodesOf(map, b)[n]!.lines as AnyRecord[];
const branch = (color: string, nodes = 1) => ({
  label: `Ramo ${color}`,
  icon: 'pin',
  color,
  nodes: Array.from({ length: nodes }, () => ({ tag: 'exemplo', lines: [{ note: 'x' }] })),
});

describe('mindMapSchema', () => {
  it('accepts the fixture map and counts cards and refs', () => {
    const r = mindMapSchema.safeParse(buildMindMap());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(nodeCount(r.data)).toBe(2);
    expect(mapRefs(r.data)).toEqual(['t1-sk1-word', 't1-sk1-s-hello', 't1-sk2-word', 'fr-001']);
  });

  it('accepts a map without unit, skill, art, intro, doodle or quiz', () => {
    const { unitId, skillId, centerArt, intro, doodle, quiz, ...bare } = buildMindMap();
    expect([unitId, skillId, centerArt, intro, doodle, quiz].every(Boolean)).toBe(true);
    expect(lines(bare)).toEqual([]);
  });

  it('requires the "mm-" prefix in the id', () => {
    expect(lines(buildMindMap({ id: 'to-be' }))).toEqual(['id: O id do mapa começa com "mm-".']);
  });

  it('rejects 7 branches and 1 branch', () => {
    const seven = buildMindMap() as AnyRecord;
    seven.branches = [
      ...branches(seven),
      ...['jabuticaba', 'anil', 'manga', 'maracuja', 'folha'].map((c) => branch(c)),
    ];
    branches(seven)[6]!.color = 'folha';
    expect(lines(seven)).toEqual([
      'branches: O mapa tem de 2 a 6 ramos.',
      'branches › 6 › color: Cor de ramo repetida: "folha".',
    ]);
    const one = buildMindMap() as AnyRecord;
    one.branches = branches(one).slice(0, 1);
    expect(lines(one)).toContain('branches: O mapa tem de 2 a 6 ramos.');
  });

  it('rejects 26 cards and accepts 25', () => {
    const make = (total: number) => {
      const map = buildMindMap() as AnyRecord;
      const extra = total - 2;
      map.branches = [
        ...branches(map),
        branch('anil', Math.ceil(extra / 2)),
        branch('manga', Math.floor(extra / 2)),
      ];
      return map;
    };
    expect(lines(make(25))).toEqual([]);
    expect(lines(make(26))).toEqual([
      'branches: O mapa tem no máximo 25 cartões; divida em dois mapas.',
    ]);
  });

  it('rejects a repeated branch color', () => {
    const map = buildMindMap() as AnyRecord;
    branches(map)[1]!.color = 'folha';
    expect(lines(map)).toEqual(['branches › 1 › color: Cor de ramo repetida: "folha".']);
  });

  it('rejects unpaired or empty "**" in lines and titles', () => {
    const map = buildMindMap() as AnyRecord;
    linesOf(map)[0]!.en = 'I **am';
    nodesOf(map)[0]!.title = 'Cada **** forma';
    expect(lines(map)).toEqual([
      'branches › 0 › nodes › 0 › title: Negrito "**" inválido: use pares, sem espaço nem "*" nas pontas.',
      'branches › 0 › nodes › 0 › lines › 0 › en: Negrito "**" inválido: use pares, sem espaço nem "*" nas pontas.',
    ]);
  });

  it('requires 4 distinct refs (3 is not enough, a repeated ref counts once)', () => {
    const map = buildMindMap() as AnyRecord;
    linesOf(map, 1)[3] = { ref: 't1-sk1-word' };
    expect(lines(map)).toEqual([
      'branches: O mapa precisa de pelo menos 4 linhas com "ref" distintos (para "Praticar este mapa").',
    ]);
  });

  it('limits the hint to 60 characters', () => {
    const map = buildMindMap() as AnyRecord;
    linesOf(map)[1]!.hint = 'a'.repeat(61);
    expect(lines(map)).toEqual([
      'branches › 0 › nodes › 0 › lines › 1 › hint: O hint tem no máximo 60 caracteres.',
    ]);
  });

  it('rejects a line that matches no form, with a PT-BR message', () => {
    for (const bad of [{ en: 'a', note: 'b' }, { wrong: 'a' }, {}, 'texto']) {
      const r = mapLineSchema.safeParse(bad);
      expect(r.success, JSON.stringify(bad)).toBe(false);
      if (r.success) return;
      expect(formatIssues(r.error)).toEqual([
        '(raiz): Linha inválida: use { ref }, { en, pt }, { wrong, right } ou { note }.',
      ]);
    }
  });

  it('rejects a skillId without unitId', () => {
    const map = buildMindMap() as AnyRecord;
    delete map.unitId;
    expect(lines(map)).toEqual(['unitId: Mapa com "skillId" precisa de "unitId".']);
  });

  it('rejects a quiz prompt with two blanks or none', () => {
    for (const prompt of ['I ___ ___ happy.', 'I am happy.', 'I ____ happy.']) {
      const map = buildMindMap() as AnyRecord;
      ((map.quiz as AnyRecord).items as AnyRecord[])[0]!.prompt = prompt;
      expect(lines(map), prompt).toEqual([
        'quiz › items › 0 › prompt: O enunciado precisa de exatamente uma lacuna "___".',
      ]);
    }
  });

  it('rejects an empty or non-expanding quiz pattern and an empty accepted list', () => {
    const quizItems = (map: AnyRecord) => (map.quiz as AnyRecord).items as AnyRecord[];
    const empty = buildMindMap() as AnyRecord;
    quizItems(empty)[0]!.accepted = [''];
    expect(lines(empty)).toEqual(['quiz › items › 0 › accepted › 0: Texto vazio.']);
    const broken = buildMindMap() as AnyRecord;
    quizItems(broken)[0]!.accepted = ['[am'];
    expect(lines(broken)).toEqual([
      'quiz › items › 0 › accepted › 0: Faltou fechar com "]" no padrão "[am".',
    ]);
    const none = buildMindMap() as AnyRecord;
    quizItems(none)[0]!.accepted = [];
    expect(lines(none)).toEqual([
      'quiz › items › 0 › accepted: Informe ao menos uma resposta aceita.',
    ]);
  });

  it('requires 3 to 6 quiz items', () => {
    const map = buildMindMap() as AnyRecord;
    const quiz = map.quiz as AnyRecord;
    quiz.items = (quiz.items as unknown[]).slice(0, 2);
    expect(lines(map)).toEqual(['quiz › items: O teste rápido tem de 3 a 6 itens.']);
  });

  it('rejects unknown icons, colors, tags and kinds in PT-BR', () => {
    const map = buildMindMap({ icon: 'owl', kind: 'outro' }) as AnyRecord;
    branches(map)[0]!.color = 'roxo';
    nodesOf(map)[0]!.tag = 'dica';
    const text = lines(map).join('\n');
    expect(text).toMatch(/^kind: Tipo de mapa desconhecido/m);
    expect(text).toMatch(/^icon: Ícone desconhecido/m);
    expect(text).toMatch(/^branches › 0 › color: Cor desconhecida/m);
    expect(text).toMatch(/^branches › 0 › nodes › 0 › tag: Etiqueta desconhecida/m);
  });

  it('rejects unknown keys (prototype leftovers) in PT-BR', () => {
    const map = buildMindMap({ figureStyle: 'art' }) as AnyRecord;
    linesOf(map)[0]!.emoji = '🙋';
    expect(lines(map)).toEqual([
      'branches › 0 › nodes › 0 › lines › 0: Campo desconhecido: "emoji".',
      '(raiz): Campo desconhecido: "figureStyle".',
    ]);
  });

  it('reports map-level rules together with field errors', () => {
    const map = buildMindMap({ title: '' }) as AnyRecord;
    branches(map)[1]!.color = 'folha';
    linesOf(map, 1)[3] = { note: 'sem ref' };
    linesOf(map)[0]!.en = 'I **am';
    expect(lines(map)).toEqual([
      'title: Texto vazio.',
      'branches › 0 › nodes › 0 › lines › 0 › en: Negrito "**" inválido: use pares, sem espaço nem "*" nas pontas.',
      'branches › 1 › color: Cor de ramo repetida: "folha".',
      'branches: O mapa precisa de pelo menos 4 linhas com "ref" distintos (para "Praticar este mapa").',
    ]);
  });

  it('does not crash on malformed branches', () => {
    for (const b of [null, [null, 1], [{ color: 5 }, { nodes: 'x' }]]) {
      expect(mindMapSchema.safeParse(buildMindMap({ branches: b })).success).toBe(false);
    }
  });
});
