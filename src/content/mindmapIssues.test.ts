import { unitSchema } from './schema';
import { bankSchema } from './schemas/bank';
import { mindMapSchema, type MindMap } from './schemas/mindmap';
import {
  buildMindMapContext,
  mindMapIssues,
  mindMapSetIssues,
  normalizeMapEn,
  unusedArt,
} from './mindmapIssues';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildMindMap } from '../test/fixtures/content/buildMindMap';

const units = [unitSchema.parse(buildUnit(1)), unitSchema.parse(buildUnit(2))];
const banks = [bankSchema.parse(buildBank()), bankSchema.parse(buildFalseFriendsBank())];
const ctx = buildMindMapContext({ units, banks, art: ['centro', 'escola', 'sobra'] });
const map = (edit?: (m: MindMap) => void): MindMap => {
  const m = mindMapSchema.parse(buildMindMap());
  edit?.(m);
  return m;
};
const firstNode = (m: MindMap) => m.branches[0]!.nodes[0]!;

describe('buildMindMapContext', () => {
  it('indexes unit and bank items with normalized en, level and unit', () => {
    expect(ctx.items.get('t1-sk1-word')).toEqual({ en: 'hello', level: 'A1', unitId: 't1-unit' });
    expect(ctx.items.get('fr-003')).toEqual({ en: 'that is a bummer', level: 'B1' });
    expect(ctx.items.get('fc-001')).toEqual({ en: 'pretend', level: 'A2' });
    expect(ctx.units.map((u) => u.id)).toEqual(['t1-unit', 't2-unit']);
  });

  it('normalizes map text without bold markers', () => {
    expect(normalizeMapEn("**I'm** Brazilian!")).toBe('i am brazilian');
  });
});

describe('mindMapIssues', () => {
  it('accepts the fixture map', () => {
    expect(mindMapIssues(map(), ctx)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects missing scenes (center and card)', () => {
    const m = map((x) => {
      x.centerArt = 'nao-existe';
      firstNode(x).art = 'sumiu';
    });
    expect(mindMapIssues(m, ctx).errors).toEqual([
      'centro: a cena "nao-existe" não existe em art/.',
      'ramo 1 "Afirmativa" › cartão 1: a cena "sumiu" não existe em art/.',
    ]);
  });

  it('rejects a ref to a missing item', () => {
    const m = map((x) => {
      firstNode(x).lines[1] = { ref: 'u9-nada' };
    });
    expect(mindMapIssues(m, ctx).errors).toEqual([
      'ramo 1 "Afirmativa" › cartão 1 › linha 2: o item "u9-nada" não existe.',
    ]);
  });

  it('rejects an en line equal to an existing item ("use ref")', () => {
    const m = map((x) => {
      firstNode(x).lines[0] = { en: '**Nice** to meet you!', pt: 'Prazer!' };
    });
    expect(mindMapIssues(m, ctx).errors).toEqual([
      'ramo 1 "Afirmativa" › cartão 1 › linha 1: "**Nice** to meet you!" já é o item "fr-001"; use ref.',
    ]);
  });

  it('rejects a skillId from another unit and an unknown unit', () => {
    expect(
      mindMapIssues(
        map((x) => (x.skillId = 't2-sk1')),
        ctx,
      ).errors,
    ).toEqual(['A habilidade "t2-sk1" não pertence à unidade "t1-unit".']);
    expect(
      mindMapIssues(
        map((x) => (x.unitId = 'u9-unit')),
        ctx,
      ).errors,
    ).toEqual(['A unidade "u9-unit" não existe.']);
  });

  it('warns about refs from a later unit or above the map level', () => {
    const m = map((x) => {
      firstNode(x).lines[0] = { ref: 't2-sk1-word' };
      firstNode(x).lines.push({ ref: 'fr-003' });
    });
    expect(mindMapIssues(m, ctx)).toEqual({
      errors: [],
      warnings: [
        'ramo 1 "Afirmativa" › cartão 1 › linha 1: "t2-sk1-word" é da unidade "t2-unit", depois de "t1-unit".',
        'ramo 1 "Afirmativa" › cartão 1 › linha 4: "fr-003" é B1, acima do nível do mapa (A1).',
      ],
    });
  });

  it('does not check the path position of a map without unit', () => {
    const m = map((x) => {
      delete x.unitId;
      delete x.skillId;
      firstNode(x).lines[0] = { ref: 't2-sk1-word' };
      firstNode(x).lines.push({ ref: 'fr-003' });
    });
    expect(mindMapIssues(m, ctx)).toEqual({ errors: [], warnings: [] });
  });

  it('warns about more than 5 cards in a branch and more than 4 lines in a card', () => {
    const m = map((x) => {
      const node = firstNode(x);
      node.lines.push({ note: 'a' }, { note: 'b' });
      x.branches[1]!.nodes = Array.from({ length: 6 }, () => ({
        tag: 'exemplo' as const,
        lines: [{ note: 'x' }],
      }));
    });
    expect(mindMapIssues(m, ctx).warnings).toEqual([
      'ramo 1 "Afirmativa" › cartão 1: 5 linhas (recomendado até 4).',
      'ramo 2 "Cuidado": 6 cartões (recomendado até 5).',
    ]);
  });
});

describe('mindMapSetIssues', () => {
  it('accepts distinct maps named after their files', () => {
    expect(
      mindMapSetIssues([
        { file: 'mm-a.json', map: { id: 'mm-a', skillId: 't1-sk1' } },
        { file: 'mm-b.json', map: { id: 'mm-b', skillId: 't1-sk2' } },
        { file: 'mm-c.json', map: { id: 'mm-c' } },
      ]),
    ).toEqual([]);
  });

  it('rejects two maps for the same skill', () => {
    expect(
      mindMapSetIssues([
        { file: 'mm-a.json', map: { id: 'mm-a', skillId: 't1-sk1' } },
        { file: 'mm-b.json', map: { id: 'mm-b', skillId: 't1-sk1' } },
      ]),
    ).toEqual(['A habilidade "t1-sk1" já tem o mapa "mm-a" (e "mm-b").']);
  });

  it('rejects an id different from the file name and repeated ids', () => {
    expect(
      mindMapSetIssues([
        { file: 'mm-to-be.json', map: { id: 'mm-tobe' } },
        { file: 'mm-tobe.json', map: { id: 'mm-tobe' } },
      ]),
    ).toEqual([
      'mm-to-be.json: o id "mm-tobe" precisa ser igual ao nome do arquivo.',
      'Mapa repetido: "mm-tobe".',
    ]);
  });
});

describe('unusedArt', () => {
  it('warns about scenes no map uses', () => {
    expect(unusedArt([map()], ctx.art)).toEqual(['Cena sem uso: "sobra".']);
    expect(unusedArt([map()], ['centro', 'escola'])).toEqual([]);
  });
});
