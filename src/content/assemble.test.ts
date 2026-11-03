import { assembleContent, type RawContent } from './assemble';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildCollections, buildDeck, buildPlan } from '../test/fixtures/content/buildCollections';
import { buildMindMap } from '../test/fixtures/content/buildMindMap';

/** buildUnit(1) made pedagogy-compliant (as in pedagogy.test.ts). */
function unit() {
  const u = buildUnit(1);
  for (const lesson of [...u.skills.flatMap((s) => s.lessons), u.reviewLesson]) {
    for (const e of lesson.exercises)
      if (e.type === 'fill-blank') e.explanation ??= 'Idade usa "be".';
  }
  return u;
}

const content = (overrides: Partial<RawContent> = {}): RawContent => ({
  units: [{ file: 't1.json', raw: unit() }],
  banks: [
    { file: 'frases.json', raw: buildBank() },
    { file: 'falsos-cognatos.json', raw: buildFalseFriendsBank() },
  ],
  maps: [{ file: 'mm-test.json', raw: buildMindMap() }],
  plans: [{ file: 'pl-30d.json', raw: buildPlan() }],
  collections: buildCollections(),
  decks: [buildDeck()],
  art: ['centro', 'escola'],
  ...overrides,
});

describe('assembleContent', () => {
  it('validates every folder and builds the whole manifest', () => {
    const { errors, warnings, manifest, knownWords, counts } = assembleContent(content());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(manifest.units.map((u) => [u.id, u.level])).toEqual([['t1-unit', 'A1']]);
    expect(manifest.banks).toEqual([
      { id: 'falsos-cognatos', level: 'A2', file: 'falsos-cognatos.json', itemIds: ['fc-001'] },
      { id: 'frases', level: 'A1', file: 'frases.json', itemIds: ['fr-001', 'fr-002', 'fr-003'] },
    ]);
    const map = manifest.maps[0]!;
    expect(map).toMatchObject({
      id: 'mm-test',
      file: 'mm-test.json',
      kind: 'gramatica',
      unitId: 't1-unit',
      skillId: 't1-sk1',
      nodeCount: 2,
      itemIds: ['t1-sk1-word', 't1-sk1-s-hello', 't1-sk2-word', 'fr-001'],
      hasQuiz: true,
    });
    // search: map texts and the referenced items, accents and punctuation dropped
    expect(map.search.split(' ')).toEqual(
      expect.arrayContaining(['mapa', 'afirmativa', 'forma', 'hello', 'ola', 'nice', 'prazer']),
    );
    expect(manifest.collections.map((c) => [c.id, c.entryCount, c.levels])).toEqual([
      ['frases', 2, ['A1']],
      ['expressoes', 2, ['A1']],
      ['phrasal', 1, ['A1']],
      ['falsos-cognatos', 1, ['A2']],
      ['plano', 0, []],
    ]);
    expect(manifest.collections[0]!.topics).toEqual([
      { id: 'cumprimentos', title: 'Cumprimentos', icon: 'chat', entryCount: 2 },
    ]);
    expect(manifest.collections[0]).not.toHaveProperty('entries');
    expect(manifest.decks.map((d) => d.id)).toEqual(['dk-viagem']);
    expect(manifest.plans).toEqual([{ id: 'pl-30d', file: 'pl-30d.json', title: '30 dias' }]);
    expect(knownWords).toEqual(expect.arrayContaining(['pretend', 'prazer', 'bummer']));
    expect(counts.items).toBe(8 + 4);
  });

  it('empty folders and absent files are valid', () => {
    const { errors, manifest } = assembleContent({ units: content().units });
    expect(errors).toEqual([]);
    expect(manifest).toMatchObject({ banks: [], maps: [], plans: [], collections: [], decks: [] });
  });

  it('reports invalid files with their path and leaves them out of the manifest', () => {
    const { errors, manifest } = assembleContent(
      content({
        banks: [{ file: 'frases.json', raw: buildBank({ level: 'Z1' }) }],
        maps: [{ file: 'mm-outro.json', raw: buildMindMap() }],
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        '[banks/frases.json] level: Nível CEFR inválido; use A1, A2, B1, B2, C1, C2.',
        '[mindmaps/mm-outro.json] O id "mm-test" precisa ser igual ao nome do arquivo.',
      ]),
    );
    expect(manifest.banks).toEqual([]);
    expect(manifest.maps).toEqual([]);
  });

  it('runs the cross-file rules of banks, maps, collections, decks and plans', () => {
    const map = buildMindMap({ centerArt: 'sumiu' });
    const deck = buildDeck({ itemIds: ['fr-001', 'fr-002', 'fr-003', 'fc-001', 'pv-404'] });
    const { errors, warnings } = assembleContent(
      content({
        maps: [{ file: 'mm-test.json', raw: map }],
        decks: [deck],
        art: ['centro', 'escola', 'sobra'],
      }),
    );
    expect(errors).toEqual([
      '[mindmaps/mm-test.json] centro: a cena "sumiu" não existe em art/.',
      '[dk-viagem] O item "pv-404" não existe.',
    ]);
    expect(warnings).toEqual(['Cena sem uso: "centro".', 'Cena sem uso: "sobra".']);
  });
});
