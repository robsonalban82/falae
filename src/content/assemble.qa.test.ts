import { assembleContent, type RawContent } from './assemble';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildMindMap } from '../test/fixtures/content/buildMindMap';

// QA: try to break assembleContent (what validate:content and manifest.test.ts run).

function unit(n = 1) {
  const u = buildUnit(n);
  for (const lesson of [...u.skills.flatMap((s) => s.lessons), u.reviewLesson]) {
    for (const e of lesson.exercises)
      if (e.type === 'fill-blank') e.explanation ??= 'Idade usa "be".';
  }
  return u;
}
const base = (o: Partial<RawContent> = {}): RawContent => ({
  units: [{ file: 't1.json', raw: unit() }],
  ...o,
});

describe('assembleContent (QA)', () => {
  it('no units at all does not throw and gives an empty manifest', () => {
    const { manifest, counts } = assembleContent({ units: [] });
    expect(manifest.units).toEqual([]);
    expect(counts).toEqual({ units: 0, items: 0, lessons: 0, exercises: 0 });
  });

  it('explicitly empty folders and empty collections/decks are valid', () => {
    const { errors, manifest } = assembleContent(
      base({ banks: [], maps: [], plans: [], collections: [], decks: [], art: [] }),
    );
    expect(errors).toEqual([]);
    expect(manifest).toMatchObject({ banks: [], maps: [], plans: [], collections: [], decks: [] });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'oi'],
    ['an empty object', {}],
  ])('a bank file holding %s is reported with its path, never thrown', (_case, raw) => {
    const { errors, manifest } = assembleContent(base({ banks: [{ file: 'frases.json', raw }] }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.startsWith('[banks/frases.json]'))).toBe(true);
    expect(manifest.banks).toEqual([]);
  });

  it('collections.json or decks.json holding null are reported (not treated as absent)', () => {
    const { errors } = assembleContent(base({ collections: null, decks: null }));
    expect(errors.some((e) => e.startsWith('[collections.json]'))).toBe(true);
    expect(errors.some((e) => e.startsWith('[decks.json]'))).toBe(true);
  });

  it('a bank item reusing a unit item id is an error', () => {
    const bank = buildBank({
      sentences: [{ id: 't1-sk1-word', en: 'Something else here.', pt: 'Outra.', difficulty: 1 }],
    });
    const { errors } = assembleContent(base({ banks: [{ file: 'frases.json', raw: bank }] }));
    expect(errors.join('\n')).toMatch(/Id duplicado "t1-sk1-word"/);
  });

  it('a map citing an item of a bank that failed validation is reported too', () => {
    const { errors } = assembleContent(
      base({
        banks: [{ file: 'frases.json', raw: buildBank({ level: 'Z9' }) }],
        maps: [{ file: 'mm-test.json', raw: buildMindMap() }],
        art: ['centro', 'escola'],
      }),
    );
    expect(errors.some((e) => e.startsWith('[banks/frases.json]'))).toBe(true);
    expect(
      errors.some((e) => e.startsWith('[mindmaps/mm-test.json]') && e.includes('fr-001')),
    ).toBe(true);
  });

  it('file name must match the id exactly (case, extension)', () => {
    const { errors } = assembleContent(
      base({
        banks: [
          { file: 'Frases.json', raw: buildBank() },
          { file: 'falsos-cognatos.JSON', raw: buildFalseFriendsBank() },
        ],
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        '[banks/Frases.json] O id "frases" precisa ser igual ao nome do arquivo.',
        '[banks/falsos-cognatos.JSON] O id "falsos-cognatos" precisa ser igual ao nome do arquivo.',
      ]),
    );
  });

  it('the manifest is the same whatever the order the files are read in', () => {
    const banks = [
      { file: 'frases.json', raw: buildBank() },
      { file: 'falsos-cognatos.json', raw: buildFalseFriendsBank() },
    ];
    const a = assembleContent(base({ banks }));
    const b = assembleContent(base({ banks: [...banks].reverse() }));
    expect(a.manifest).toEqual(b.manifest);
    expect(a.knownWords).toEqual(b.knownWords);
  });

  it('an invalid unit is left out but valid banks still enter the manifest', () => {
    const { errors, manifest } = assembleContent({
      units: [
        { file: 't1.json', raw: unit() },
        { file: 't2.json', raw: { id: 't2-unit', title: 42 } },
      ],
      banks: [{ file: 'falsos-cognatos.json', raw: buildFalseFriendsBank() }],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(manifest.units.map((u) => u.id)).toEqual(['t1-unit']);
    expect(manifest.banks.map((b) => b.id)).toEqual(['falsos-cognatos']);
  });
});
