import { buildManifest } from './buildManifest';
import { ContentLoadError, createContentLoader, createJsonLoader } from './loader';
import { unitSchema } from './schema';
import { studyPlanSchema } from './schemas/collection';
import { bankSchema } from './schemas/course';
import { mindMapSchema } from './schemas/mindmap';
import { buildUnit } from '../test/fixtures/buildUnit';
import { buildBank, buildFalseFriendsBank } from '../test/fixtures/content/buildBank';
import { buildPlan } from '../test/fixtures/content/buildCollections';
import { buildMindMap } from '../test/fixtures/content/buildMindMap';
import { z } from 'zod';

// QA: try to break the loaders (cache, failures, concurrency, odd id lists).

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

type Behaviour = 'ok' | 'offline-once' | 'slow';

function setup(behaviour: Partial<Record<string, Behaviour>> = {}) {
  const calls: string[] = [];
  const failed = new Set<string>();
  const make = (files: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [
        path,
        async () => {
          calls.push(path);
          await Promise.resolve();
          if (behaviour[path] === 'offline-once' && !failed.has(path)) {
            failed.add(path);
            throw new TypeError('Failed to fetch dynamically imported module');
          }
          return { default: structuredClone(data) };
        },
      ]),
    );
  const loader = createContentLoader(manifest, {
    units: make({ './units/t1.json': unit1, './units/t2.json': unit2 }),
    banks: make({
      './banks/frases.json': buildBank(),
      './banks/falsos-cognatos.json': buildFalseFriendsBank(),
    }),
    maps: make({ './mindmaps/mm-test.json': buildMindMap() }),
    plans: make({ './plans/pl-30d.json': buildPlan() }),
    collections: {},
  });
  return { loader, calls };
}

describe('loadItems (QA)', () => {
  it('two identical calls at the same time import each file once', async () => {
    const { loader, calls } = setup();
    const ids = ['fr-001', 't1-sk1-word'];
    const [a, b] = await Promise.all([loader.loadItems(ids), loader.loadItems(ids)]);
    expect([...a.items.keys()].sort()).toEqual([...b.items.keys()].sort());
    expect(calls.sort()).toEqual(['./banks/frases.json', './units/t1.json']);
  });

  it('empty list, only unknown ids, or a one-shot iterator', async () => {
    const { loader, calls } = setup();
    expect((await loader.loadItems([])).items.size).toBe(0);
    expect((await loader.loadItems(['ghost', '', 'FR-001'])).items.size).toBe(0);
    expect(calls).toEqual([]);
    // a generator can only be read once
    function* gen() {
      yield 'fc-001';
      yield 'fc-001';
    }
    const index = await loader.loadItems(gen());
    expect(index.items.get('fc-001')).toMatchObject({ kind: 'vocab', en: 'pretend' });
    expect(calls).toEqual(['./banks/falsos-cognatos.json']);
  });

  it('repeated and mixed ids of two units and two banks load each owner once', async () => {
    const { loader, calls } = setup();
    const index = await loader.loadItems([
      'fr-001',
      't2-sk3-word',
      'fc-001',
      't1-sk1-word',
      'fr-001',
      't2-sk3-word',
    ]);
    expect(calls.sort()).toEqual([
      './banks/falsos-cognatos.json',
      './banks/frases.json',
      './units/t1.json',
      './units/t2.json',
    ]);
    // lessons of both units, items of both banks
    expect(index.lessons.has('t1-sk1-l1')).toBe(true);
    expect(index.lessons.has('t2-sk1-l1')).toBe(true);
    expect(index.items.has('fr-003')).toBe(true);
    expect(index.items.has('fc-001')).toBe(true);
    // bank items keep their own level; unit items have none
    expect(index.items.get('fr-003')).toMatchObject({ level: 'B1' });
    expect(index.items.get('t1-sk1-word')).not.toHaveProperty('level');
  });

  it('offline once: the failure is not cached and the next call loads', async () => {
    const { loader, calls } = setup({ './banks/frases.json': 'offline-once' });
    await expect(loader.loadItems(['fr-001', 't1-sk1-word'])).rejects.toThrow(/Failed to fetch/);
    const index = await loader.loadItems(['fr-001', 't1-sk1-word']);
    expect(index.items.has('fr-001')).toBe(true);
    // the unit that loaded fine stays cached; only the bank is retried
    expect(calls.filter((c) => c === './units/t1.json')).toHaveLength(1);
    expect(calls.filter((c) => c === './banks/frases.json')).toHaveLength(2);
  });

  it('an offline map import is retried later', async () => {
    const { loader } = setup({ './mindmaps/mm-test.json': 'offline-once' });
    // download failures are wrapped as ContentLoadError "missing" (cause: the TypeError)
    await expect(loader.loadMap('mm-test')).rejects.toMatchObject({
      kind: 'map',
      reason: 'missing',
    });
    expect((await loader.loadMap('mm-test')).id).toBe('mm-test');
  });

  it('bank and unit ids are not interchangeable in the single loaders', async () => {
    const { loader } = setup();
    await expect(loader.loadBank('t1-unit')).rejects.toMatchObject({
      kind: 'bank',
      reason: 'missing',
    });
    await expect(loader.loadUnit('frases')).rejects.toMatchObject({
      kind: 'unit',
      reason: 'missing',
    });
    await expect(loader.loadMap('frases')).rejects.toMatchObject({
      kind: 'map',
      reason: 'missing',
    });
    await expect(loader.loadPlan('mm-test')).rejects.toMatchObject({
      kind: 'plan',
      reason: 'missing',
    });
  });

  it('ContentLoadError is an Error with a readable PT-BR message', () => {
    const err = new ContentLoadError('mm-x', 'missing', 'fora do manifesto', 'map');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('[falae] Mapa "mm-x" não encontrado(a): fora do manifesto');
    expect(new ContentLoadError('u1', 'invalid', 'x', 'unit').kind).toBe('unit');
  });
});

describe('createJsonLoader (QA)', () => {
  const schema = z.object({ id: z.string() });

  it('a validator that fails to load once (offline) is retried, not cached', async () => {
    let attempts = 0;
    const loader = createJsonLoader({
      kind: 'map',
      importers: { './a.json': async () => ({ default: { id: 'a' } }) },
      pathOf: () => './a.json',
      validator: async () => {
        attempts++;
        if (attempts === 1) throw new TypeError('Failed to fetch dynamically imported module');
        return { schema };
      },
    });
    // Wrapped as "missing" (download failure), with the original error kept as the cause.
    const first = loader.load('a');
    await expect(first).rejects.toMatchObject({ name: 'ContentLoadError', reason: 'missing' });
    await expect(first.catch((e: Error) => e.cause)).resolves.toBeInstanceOf(TypeError);
    // Back online: the map schema chunk should be fetched again.
    await expect(loader.load('a')).resolves.toEqual({ id: 'a' });
    expect(attempts).toBe(2);
  });

  it('clear() during a pending failed import does not evict the newer cached entry', async () => {
    let calls = 0;
    let rejectFirst: (e: Error) => void = () => {};
    const loader = createJsonLoader({
      kind: 'bank',
      importers: {
        './a.json': () => {
          calls++;
          if (calls === 1)
            return new Promise((_, reject) => {
              rejectFirst = reject;
            });
          return Promise.resolve({ default: { id: 'a' } });
        },
      },
      pathOf: () => './a.json',
      validator: { schema },
    });
    const first = loader.load('a');
    first.catch(() => {});
    loader.clear();
    await loader.load('a');
    rejectFirst(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await loader.load('a');
    expect(calls).toBe(2);
  });

  it('the importer of a known path that is missing from the glob is "missing", not a crash', async () => {
    const loader = createJsonLoader({
      kind: 'plan',
      importers: {},
      pathOf: () => './plans/ghost.json',
      validator: { schema },
    });
    await expect(loader.load('ghost')).rejects.toMatchObject({ reason: 'missing', kind: 'plan' });
  });

  it('content with the wrong shape never resolves, even when the importer returns null', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loader = createJsonLoader({
      kind: 'bank',
      importers: { './a.json': async () => ({ default: null }) },
      pathOf: () => './a.json',
      validator: { schema },
    });
    await expect(loader.load('a')).rejects.toMatchObject({ reason: 'invalid' });
    error.mockRestore();
  });
});
