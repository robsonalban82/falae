import {
  emptyFilters,
  filterMaps,
  filterOptions,
  hasFilters,
  parseMapFilters,
  toSearchParams,
} from './filter';

const maps = [
  {
    id: 'mm-a',
    level: 'A1',
    kind: 'gramatica',
    unitId: 'u1',
    search: 'verbo to be ser estar voce',
  },
  { id: 'mm-b', level: 'A2', kind: 'vocabulario', search: 'phrasal verbs get up' },
  { id: 'mm-c', level: 'A2', kind: 'gramatica', unitId: 'u3', search: 'in on at lugar' },
];
const none = new Set<string>();
const ids = (list: { id: string }[]) => list.map((m) => m.id);

describe('parseMapFilters / toSearchParams', () => {
  it('round-trips valid filters', () => {
    const f = parseMapFilters(
      new URLSearchParams('nivel=A2&unidade=u3&tipo=gramatica&estudado=nao&q=in'),
    );
    expect(f).toEqual({ level: 'A2', unitId: 'u3', kind: 'gramatica', studied: false, q: 'in' });
    expect(toSearchParams(f).toString()).toBe(
      'nivel=A2&unidade=u3&tipo=gramatica&estudado=nao&q=in',
    );
  });

  it('ignores unknown values instead of failing', () => {
    expect(parseMapFilters(new URLSearchParams('nivel=Z9&tipo=foo&estudado=talvez&x=1'))).toEqual({
      q: '',
    });
  });

  it('with options, also drops units and levels that do not exist', () => {
    const options = filterOptions(maps);
    const f = parseMapFilters(new URLSearchParams('nivel=B1&unidade=u9&tipo=conversacao'), options);
    expect(f).toEqual({ q: '' });
  });

  it('empty filters make empty params', () => {
    expect(toSearchParams(emptyFilters()).toString()).toBe('');
    expect(hasFilters(emptyFilters())).toBe(false);
    expect(hasFilters({ q: ' x ' })).toBe(true);
    expect(hasFilters({ q: '', studied: false })).toBe(true);
  });
});

describe('filterMaps', () => {
  it('keeps manifest order and combines filters', () => {
    expect(ids(filterMaps(maps, emptyFilters(), none))).toEqual(['mm-a', 'mm-b', 'mm-c']);
    expect(ids(filterMaps(maps, { q: '', level: 'A2' }, none))).toEqual(['mm-b', 'mm-c']);
    expect(ids(filterMaps(maps, { q: '', level: 'A2', kind: 'gramatica' }, none))).toEqual([
      'mm-c',
    ]);
    expect(ids(filterMaps(maps, { q: '', unitId: 'u1' }, none))).toEqual(['mm-a']);
  });

  it('studied: yes and no', () => {
    const studied = new Set(['mm-b']);
    expect(ids(filterMaps(maps, { q: '', studied: true }, studied))).toEqual(['mm-b']);
    expect(ids(filterMaps(maps, { q: '', studied: false }, studied))).toEqual(['mm-a', 'mm-c']);
  });

  it('search ignores accents and matches word prefixes, all words required', () => {
    expect(ids(filterMaps(maps, { q: 'você' }, none))).toEqual(['mm-a']);
    expect(ids(filterMaps(maps, { q: 'voce' }, none))).toEqual(['mm-a']);
    expect(ids(filterMaps(maps, { q: 'phr get' }, none))).toEqual(['mm-b']);
    expect(ids(filterMaps(maps, { q: 'phr xyz' }, none))).toEqual([]);
    expect(ids(filterMaps(maps, { q: '!!' }, none))).toHaveLength(3);
  });

  it('a prefix is not a substring', () => {
    expect(ids(filterMaps(maps, { q: 'erb' }, none))).toEqual([]);
  });
});

describe('filterOptions', () => {
  it('offers only what exists, levels and kinds in canonical order', () => {
    expect(filterOptions(maps)).toEqual({
      levels: ['A1', 'A2'],
      unitIds: ['u1', 'u3'],
      kinds: ['gramatica', 'vocabulario'],
    });
    expect(filterOptions([])).toEqual({ levels: [], unitIds: [], kinds: [] });
  });
});
