import { unitSchema } from './schema';
import { bankSchema } from './schemas/bank';
import { mindMapSchema, type MindMap } from './schemas/mindmap';
import { buildMindMapContext, mindMapIssues, mindMapSetIssues, unusedArt } from './mindmapIssues';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildMindMap } from '../test/fixtures/content/buildMindMap';

// Units given out of order on purpose: the context must sort them by `order`.
const units = [unitSchema.parse(buildUnit(2)), unitSchema.parse(buildUnit(1))];
const banks = [bankSchema.parse(buildBank()), bankSchema.parse(buildFalseFriendsBank())];
const ctx = buildMindMapContext({ units, banks, art: ['centro', 'escola'] });
const map = (edit?: (m: MindMap) => void): MindMap => {
  const m = mindMapSchema.parse(buildMindMap());
  edit?.(m);
  return m;
};
const firstNode = (m: MindMap) => m.branches[0]!.nodes[0]!;
const L1 = 'ramo 1 "Afirmativa" › cartão 1 › linha 1';

describe('mindMapIssues — "use ref" (QA)', () => {
  it('sorts units by order', () => {
    expect(ctx.units.map((u) => u.id)).toEqual(['t1-unit', 't2-unit']);
  });

  it.each([
    ['HELLO!', 't1-sk1-word'],
    ['**Hello**.', 't1-sk1-word'],
    ['**hel**lo', 't1-sk1-word'],
    ['I am thirty years old', 't1-sk1-s-hello'],
    ['**I’m** thirty years old.', 't1-sk1-s-hello'],
    ['Pretend', 'fc-001'],
    ['  nice to MEET you  ', 'fr-001'],
  ])('flags "%s" as the item %s', (en, id) => {
    const m = map((x) => (firstNode(x).lines[0] = { en, pt: 'x' }));
    expect(mindMapIssues(m, ctx).errors).toEqual([`${L1}: "${en}" já é o item "${id}"; use ref.`]);
  });

  it('does not flag longer or different text, nor wrong/right/note lines', () => {
    const m = map((x) => {
      const n = firstNode(x);
      n.lines[0] = { en: 'Hello, Ana!', pt: 'x' }; // example of the item, not the item
      n.lines.push({ wrong: 'hello', right: 'Hello' }, { note: 'hello' });
    });
    expect(mindMapIssues(m, ctx).errors).toEqual([]);
  });

  it('collects every error of the map in one pass (art, ref, use ref, skill)', () => {
    const m = map((x) => {
      x.centerArt = 'sumiu';
      x.skillId = 't2-sk1';
      const n = firstNode(x);
      n.lines[0] = { en: 'hello', pt: 'oi' };
      n.lines[1] = { ref: 'xa-404' };
    });
    expect(mindMapIssues(m, ctx).errors).toEqual([
      'A habilidade "t2-sk1" não pertence à unidade "t1-unit".',
      'centro: a cena "sumiu" não existe em art/.',
      `${L1}: "hello" já é o item "t1-sk1-word"; use ref.`,
      'ramo 1 "Afirmativa" › cartão 1 › linha 2: o item "xa-404" não existe.',
    ]);
  });
});

describe('mindMapIssues — path position (QA)', () => {
  it('no warning for refs from the same or an earlier unit', () => {
    const m = map((x) => {
      x.unitId = 't2-unit';
      x.skillId = 't2-sk1';
      firstNode(x).lines[0] = { ref: 't1-sk3-word' };
      firstNode(x).lines.push({ ref: 't2-sk4-word' });
    });
    expect(mindMapIssues(m, ctx)).toEqual({ errors: [], warnings: [] });
  });

  it('bank item at the map level is fine; one level above warns', () => {
    const at = map((x) => {
      x.level = 'A2';
      firstNode(x).lines.push({ ref: 'fc-001' });
    });
    expect(mindMapIssues(at, ctx).warnings).toEqual([]);
    const above = map((x) => firstNode(x).lines.push({ ref: 'fc-001' }));
    expect(mindMapIssues(above, ctx).warnings).toEqual([
      'ramo 1 "Afirmativa" › cartão 1 › linha 4: "fc-001" é A2, acima do nível do mapa (A1).',
    ]);
  });

  it('unknown unit: reports it once and skips the path checks of the refs', () => {
    const m = map((x) => {
      x.unitId = 'u9-unit';
      firstNode(x).lines.push({ ref: 'fr-003' });
    });
    expect(mindMapIssues(m, ctx)).toEqual({
      errors: ['A unidade "u9-unit" não existe.'],
      warnings: [],
    });
  });

  it('readability limits: 5 cards and 4 lines are fine', () => {
    const m = map((x) => {
      firstNode(x).lines.push({ note: 'a' }); // 4 lines
      x.branches[1]!.nodes.push(
        ...Array.from({ length: 4 }, () => ({ tag: 'exemplo' as const, lines: [{ note: 'x' }] })),
      ); // 5 cards
    });
    expect(mindMapIssues(m, ctx).warnings).toEqual([]);
  });
});

describe('mindMapSetIssues — QA', () => {
  it('reports file name, repeated id and repeated skill together', () => {
    expect(
      mindMapSetIssues([
        { file: 'mm-a.json', map: { id: 'mm-a', skillId: 't1-sk1' } },
        { file: 'mm-b.json', map: { id: 'mm-a', skillId: 't1-sk1' } },
        { file: 'mm-c.JSON', map: { id: 'mm-c' } },
      ]),
    ).toEqual([
      'mm-b.json: o id "mm-a" precisa ser igual ao nome do arquivo.',
      'Mapa repetido: "mm-a".',
      'A habilidade "t1-sk1" já tem o mapa "mm-a" (e "mm-a").',
      'mm-c.JSON: o id "mm-c" precisa ser igual ao nome do arquivo.',
    ]);
  });

  it('maps without skill never collide', () => {
    expect(
      mindMapSetIssues([
        { file: 'mm-a.json', map: { id: 'mm-a' } },
        { file: 'mm-b.json', map: { id: 'mm-b' } },
      ]),
    ).toEqual([]);
  });

  it('unusedArt: a scene used only as centerArt or only in a card counts as used', () => {
    const m = map();
    expect(unusedArt([m], ['centro', 'escola', 'sobra'])).toEqual(['Cena sem uso: "sobra".']);
    expect(unusedArt([], ['x'])).toEqual(['Cena sem uso: "x".']);
  });
});
