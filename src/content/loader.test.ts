import { courseManifest } from './manifest.generated';
import { buildManifest } from './buildManifest';
import {
  ContentLoadError,
  createContentLoader,
  createUnitLoader,
  findLesson,
  findSkillUnit,
  pathUnits,
} from './loader';
import { unitSchema } from './schema';
import { studyPlanSchema } from './schemas/collection';
import { bankSchema } from './schemas/course';
import { mindMapSchema } from './schemas/mindmap';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildCollections, buildPlan } from '../test/fixtures/content/buildCollections';
import { buildMindMap } from '../test/fixtures/content/buildMindMap';

const real = import.meta.glob<{ default: unknown }>('./units/*.json');

function spiedImporters() {
  const calls: string[] = [];
  const importers = Object.fromEntries(
    Object.entries(real).map(([path, load]) => [
      path,
      () => {
        calls.push(path);
        return load();
      },
    ]),
  );
  return { calls, importers };
}

describe('content loader (lazy units)', () => {
  it('draws the path from the manifest only', () => {
    expect(pathUnits().map((u) => u.id)).toEqual(courseManifest.units.map((u) => u.id));
  });

  it('opening a lesson imports and validates only its unit, once', async () => {
    const { calls, importers } = spiedImporters();
    const loader = createUnitLoader(courseManifest.units, importers);
    const second = courseManifest.units[1]!;
    const lessonId = second.skills[0]!.lessons[0]!.id;
    const where = findLesson(lessonId);
    expect(where).toEqual({ unitId: second.id, skillId: second.skills[0]!.id, index: 0 });

    const unit = await loader.load(where!.unitId);
    await loader.load(where!.unitId);
    expect(unit.id).toBe(second.id);
    expect(calls).toEqual([`./units/${second.file}`]);
  });

  it('finds review lessons and skills', () => {
    const first = courseManifest.units[0]!;
    expect(findLesson(first.reviewLesson.id)).toEqual({
      unitId: first.id,
      skillId: null,
      index: -1,
    });
    expect(findSkillUnit(first.skills[2]!.id)).toBe(first.id);
    expect(findLesson('nope')).toBeNull();
    expect(findSkillUnit('nope')).toBeNull();
  });

  it('rejects invalid content with a typed error (and does not cache the failure)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    const unit = courseManifest.units[0]!;
    const loader = createUnitLoader(courseManifest.units, {
      [`./units/${unit.file}`]: async () => {
        attempts++;
        return { default: { id: unit.id, title: 42 } };
      },
    });
    await expect(loader.load(unit.id)).rejects.toMatchObject({
      name: 'ContentLoadError',
      reason: 'invalid',
      id: unit.id,
      kind: 'unit',
    });
    await expect(loader.load(unit.id)).rejects.toBeInstanceOf(ContentLoadError);
    expect(attempts).toBe(2);
    error.mockRestore();
  });

  it('rejects unknown units as missing', async () => {
    const loader = createUnitLoader(courseManifest.units, {});
    await expect(loader.load('ghost')).rejects.toMatchObject({ reason: 'missing' });
  });
});

describe('content loader (banks, maps, plans, collections)', () => {
  const unit1 = buildUnit(1);
  const unit2 = buildUnit(2);
  const manifest = buildManifest({
    units: [
      { unit: unitSchema.parse(unit1), file: 't1.json' },
      { unit: unitSchema.parse(unit2), file: 't2.json' },
    ],
    banks: [
      { bank: bankSchema.parse(buildBank()), file: 'frases.json' },
      { bank: bankSchema.parse(buildFalseFriendsBank()), file: 'falsos-cognatos.json' },
    ],
    maps: [{ map: mindMapSchema.parse(buildMindMap()), file: 'mm-test.json' }],
    plans: [{ plan: studyPlanSchema.parse(buildPlan()), file: 'pl-30d.json' }],
  });

  function counting(files: Record<string, unknown>, calls: string[]) {
    const importers = Object.fromEntries(
      Object.entries(files).map(([path, data]) => [
        path,
        async () => {
          calls.push(path);
          return { default: structuredClone(data) };
        },
      ]),
    );
    return importers;
  }

  function setup(overrides: { map?: unknown; bank?: unknown; collections?: unknown } = {}) {
    const log: string[] = [];
    const units = counting({ './units/t1.json': unit1, './units/t2.json': unit2 }, log);
    const banks = counting(
      {
        './banks/frases.json': overrides.bank ?? buildBank(),
        './banks/falsos-cognatos.json': buildFalseFriendsBank(),
      },
      log,
    );
    const maps = counting({ './mindmaps/mm-test.json': overrides.map ?? buildMindMap() }, log);
    const plans = counting({ './plans/pl-30d.json': buildPlan() }, log);
    const collections = counting(
      overrides.collections === undefined ? {} : { './collections.json': overrides.collections },
      log,
    );
    const loader = createContentLoader(manifest, {
      units,
      banks,
      maps,
      plans,
      collections,
    });
    const calls = () => [...log];
    return { loader, calls };
  }

  it('loadItems imports only the bank and the unit that own the ids, once', async () => {
    const { loader, calls } = setup();
    const index = await loader.loadItems(['fr-001', 't1-sk1-word', 'nao-existe']);
    await loader.loadItems(['fr-002', 't1-sk2-word']);
    expect(calls()).toEqual(['./units/t1.json', './banks/frases.json']);
    expect(index.items.get('fr-001')).toMatchObject({ kind: 'sentence', en: 'Nice to meet you.' });
    expect(index.items.get('t1-sk1-word')).toMatchObject({ kind: 'vocab', en: 'hello' });
    // the rest of the loaded files serves as distractors; lessons come with the unit
    expect(index.items.has('fr-003')).toBe(true);
    expect(index.items.has('fc-001')).toBe(false);
    expect(index.lessons.has('t1-sk1-l1')).toBe(true);
  });

  it('loads a map, a plan and a bank on demand, cached', async () => {
    const { loader, calls } = setup();
    expect((await loader.loadMap('mm-test')).id).toBe('mm-test');
    await loader.loadMap('mm-test');
    expect((await loader.loadPlan('pl-30d')).days).toHaveLength(30);
    expect((await loader.loadBank('falsos-cognatos')).vocab).toHaveLength(1);
    expect(calls()).toEqual([
      './mindmaps/mm-test.json',
      './plans/pl-30d.json',
      './banks/falsos-cognatos.json',
    ]);
  });

  it('rejects an invalid map with ContentLoadError (and does not cache it)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loader, calls } = setup({ map: { ...buildMindMap(), branches: [] } });
    await expect(loader.loadMap('mm-test')).rejects.toMatchObject({
      name: 'ContentLoadError',
      kind: 'map',
      reason: 'invalid',
      id: 'mm-test',
    });
    await expect(loader.loadMap('mm-test')).rejects.toBeInstanceOf(ContentLoadError);
    expect(calls()).toHaveLength(2);
    error.mockRestore();
  });

  it('rejects a map citing an item that is not in the manifest', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = buildMindMap();
    map.branches[1]!.nodes[0]!.lines[3] = { ref: 'xa-404' };
    const { loader } = setup({ map });
    await expect(loader.loadMap('mm-test')).rejects.toThrow(/o item "xa-404" não existe/);
    error.mockRestore();
  });

  it('rejects a bank whose file brings another id, and unknown ids as missing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { loader } = setup({ bank: buildBank({ id: 'phrasal' }) });
    await expect(loader.loadBank('frases')).rejects.toMatchObject({
      kind: 'bank',
      reason: 'invalid',
    });
    await expect(loader.loadMap('mm-nada')).rejects.toMatchObject({
      kind: 'map',
      reason: 'missing',
    });
    await expect(loader.loadPlan('pl-nada')).rejects.toMatchObject({
      kind: 'plan',
      reason: 'missing',
    });
    error.mockRestore();
  });

  it('collections: none without collections.json; validated when present', async () => {
    expect(await setup().loader.loadCollections()).toEqual([]);
    const { loader } = setup({ collections: buildCollections() });
    expect((await loader.loadCollections()).map((c) => c.id)).toEqual([
      'frases',
      'expressoes',
      'phrasal',
      'falsos-cognatos',
      'plano',
    ]);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = setup({ collections: [{ id: 'x' }] });
    await expect(bad.loader.loadCollections()).rejects.toMatchObject({ kind: 'collections' });
    error.mockRestore();
  });
});
