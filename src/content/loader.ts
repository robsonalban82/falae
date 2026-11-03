import type { z } from 'zod';
import { DEMO_UNIT_ID, demoUnit } from '../dev/demoUnit';
import type { CourseManifest, ManifestUnit } from './buildManifest';
import { buildManifest } from './buildManifest';
import {
  indexBanks,
  indexUnits,
  knownWordsOf,
  type Course,
  type LessonRef,
  type StudyItem,
} from './course';
import { courseManifest } from './manifest.generated';
import { formatIssues, unitSchema, type Unit } from './schema';
import type { Collection, StudyPlan } from './schemas/collection';
import { bankSchema, type Bank } from './schemas/course';
import type { MindMap } from './schemas/mindmap';

/**
 * Content loading (ADR-012, MAPAS-E-CARTAS §2.7): the manifest is synchronous and light; the
 * full JSON of a unit, bank, map, plan or the collections is imported (and validated with Zod)
 * only when a screen needs it. One lazy glob per folder, one chunk per file.
 */
const globs: ContentImporters = {
  units: import.meta.glob<{ default: unknown }>('./units/*.json'),
  banks: import.meta.glob<{ default: unknown }>('./banks/*.json'),
  maps: import.meta.glob<{ default: unknown }>('./mindmaps/*.json'),
  plans: import.meta.glob<{ default: unknown }>('./plans/*.json'),
  collections: import.meta.glob<{ default: unknown }>('./collections.json'),
};

export type ItemIndex = Pick<Course, 'items' | 'lessons'>;

export type ContentKind = 'unit' | 'bank' | 'map' | 'plan' | 'collections';
const KIND_LABEL: Record<ContentKind, string> = {
  unit: 'Unidade',
  bank: 'Banco',
  map: 'Mapa',
  plan: 'Plano',
  collections: 'Coleções',
};

/** Content that could not be loaded; invalid content is never returned. */
export class ContentLoadError extends Error {
  constructor(
    readonly id: string,
    readonly reason: 'missing' | 'invalid',
    detail: string,
    readonly kind: ContentKind,
    options?: { cause?: unknown },
  ) {
    super(
      `[falae] ${KIND_LABEL[kind]} "${id}" ${reason === 'missing' ? 'não encontrado(a)' : 'inválido(a)'}: ${detail}`,
      options,
    );
    this.name = 'ContentLoadError';
  }
}

// Literal env check so production builds drop the demo unit entirely.
const demoSource: unknown = import.meta.env.VITE_DEMO === '1' ? demoUnit : null;
const demoEnabled = demoSource !== null;
let manifestCache: CourseManifest | null = null;
let demoCache: { unit: Unit | null } | null = null;

/**
 * Demo unit validated like real content (VITE_DEMO builds only). Invalid → null (logged): the
 * demo then stays out of the manifest and loading it rejects with ContentLoadError.
 */
function demo(): Unit | null {
  if (!demoCache) {
    const parsed = unitSchema.safeParse(demoSource);
    if (!parsed.success) {
      console.error(`[falae] Unidade demo inválida:\n${formatIssues(parsed.error).join('\n')}`);
    }
    demoCache = { unit: parsed.success ? parsed.data : null };
  }
  return demoCache.unit;
}

/** The whole course index (path units + the demo unit in VITE_DEMO builds). */
export function getCourseManifest(): CourseManifest {
  if (manifestCache) return manifestCache;
  const demoUnit = demoEnabled ? demo() : null;
  manifestCache = demoUnit
    ? {
        ...courseManifest,
        units: [
          ...courseManifest.units,
          ...buildManifest({ units: [{ unit: demoUnit, file: '' }] }).units,
        ],
      }
    : courseManifest;
  return manifestCache;
}

/** The demo unit (VITE_DEMO builds only) is not part of the path and its lessons always open. */
export function isDemoUnit(unitId: string): boolean {
  return demoEnabled && unitId === DEMO_UNIT_ID && demo() !== null;
}

/** Units shown on the path (sorted by order). */
export function pathUnits(): readonly ManifestUnit[] {
  return courseManifest.units;
}

export type LessonLocation = { unitId: string; skillId: string | null; index: number };

/** Where a lesson lives, from the manifest only (null = unknown id). */
export function findLesson(lessonId: string): LessonLocation | null {
  for (const unit of getCourseManifest().units) {
    if (unit.reviewLesson.id === lessonId) return { unitId: unit.id, skillId: null, index: -1 };
    for (const skill of unit.skills) {
      const index = skill.lessons.findIndex((l) => l.id === lessonId);
      if (index >= 0) return { unitId: unit.id, skillId: skill.id, index };
    }
  }
  return null;
}

/** Unit of a skill, from the manifest only (null = unknown id). */
export function findSkillUnit(skillId: string): string | null {
  return getCourseManifest().units.find((u) => u.skills.some((s) => s.id === skillId))?.id ?? null;
}

/**
 * Ids of every item of the given units; with no argument, of every unit and bank
 * (what Practice and the due counter may show). Pure over a manifest (exported for tests).
 */
export function itemIdsOf(manifest: CourseManifest, unitIds?: readonly string[]): Set<string> {
  const wanted = unitIds ? new Set(unitIds) : null;
  const ids = manifest.units
    .filter((u) => !wanted || wanted.has(u.id))
    .flatMap((u) => u.skills.flatMap((s) => s.itemIds));
  if (!wanted) ids.push(...manifest.banks.flatMap((b) => b.itemIds));
  return new Set(ids);
}

/** `itemIdsOf` over the app manifest. */
export function manifestItemIds(unitIds?: readonly string[]): Set<string> {
  return itemIdsOf(getCourseManifest(), unitIds);
}

/** Review lesson ids (commit rules need them without loading units). */
export function isReviewLesson(lessonId: string): boolean {
  return getCourseManifest().units.some((u) => u.reviewLesson.id === lessonId);
}

type Importers = Record<string, () => Promise<{ default: unknown }>>;
type Validator<T> = { schema: z.ZodType<T>; issues?: (data: T, id: string) => string[] };
export type ContentImporters = {
  units: Importers;
  banks: Importers;
  maps: Importers;
  plans: Importers;
  collections: Importers;
};

/**
 * Generic importer over a lazy glob: imports and validates one file on demand, cached in memory.
 * Rejects with `ContentLoadError`; invalid content is never returned. Exported for tests.
 */
export function createJsonLoader<T>(options: {
  kind: ContentKind;
  importers: Importers;
  /** Glob key of an id (undefined = not in the manifest). */
  pathOf: (id: string) => string | undefined;
  /**
   * Schema and runtime checks (a light subset of validate:content). A function so the
   * schemas of maps, plans and collections stay out of the initial JS (ADR-013).
   */
  validator: Validator<T> | (() => Promise<Validator<T>>);
}) {
  const { kind, importers, pathOf } = options;
  let validator: Promise<Validator<T>> | null = null;
  const getValidator = (): Promise<Validator<T>> => {
    if (!validator) {
      const pending = Promise.resolve(
        typeof options.validator === 'function' ? options.validator() : options.validator,
      );
      // A schema chunk that failed to download (offline) is fetched again next time.
      pending.catch(() => {
        if (validator === pending) validator = null;
      });
      validator = pending;
    }
    return validator;
  };
  /** Download failures (file or schema chunk) become "missing", with the cause kept. */
  const fetched = async <R>(id: string, task: () => Promise<R>): Promise<R> => {
    try {
      return await task();
    } catch (err) {
      const detail = `não foi possível baixar (${err instanceof Error ? err.message : String(err)})`;
      throw new ContentLoadError(id, 'missing', detail, kind, { cause: err });
    }
  };
  const cache = new Map<string, Promise<T>>();

  async function importOne(id: string): Promise<T> {
    const path = pathOf(id);
    const importer = path === undefined ? undefined : importers[path];
    if (!importer) throw new ContentLoadError(id, 'missing', 'fora do manifesto', kind);
    const [{ schema, issues }, raw] = await Promise.all([
      fetched(id, getValidator),
      fetched(id, importer),
    ]);
    const parsed = schema.safeParse(raw.default);
    const problems = parsed.success
      ? (issues?.(parsed.data, id) ?? [])
      : formatIssues(parsed.error);
    if (!parsed.success || problems.length > 0) {
      const detail = problems.join('\n');
      console.error(`[falae] Conteúdo inválido não foi carregado (${id}):\n${detail}`);
      throw new ContentLoadError(id, 'invalid', detail, kind);
    }
    return parsed.data;
  }

  return {
    load(id: string): Promise<T> {
      const cached = cache.get(id);
      if (cached) return cached;
      const promise = importOne(id);
      cache.set(id, promise);
      // A failed import may succeed later (e.g. back online): do not cache the rejection.
      promise.catch(() => {
        if (cache.get(id) === promise) cache.delete(id);
      });
      return promise;
    },
    clear: () => cache.clear(),
  };
}

const sameId =
  (label: string) =>
  (data: { id: string }, id: string): string[] =>
    data.id === id ? [] : [`arquivo traz o ${label} "${data.id}"`];

/** Unit importer (kept for the existing tests and callers). */
export function createUnitLoader(units: readonly ManifestUnit[], importers: Importers) {
  return createJsonLoader<Unit>({
    kind: 'unit',
    importers,
    pathOf: (id) => {
      const file = units.find((u) => u.id === id)?.file;
      return file === undefined ? undefined : `./units/${file}`;
    },
    validator: {
      schema: unitSchema,
      issues: (unit, id) => (unit.id === id ? [] : [`arquivo traz "${unit.id}"`]),
    },
  });
}

/** Which unit or bank owns each item id (from the manifest). */
function itemOwners(manifest: CourseManifest) {
  const owners = new Map<string, { kind: 'unit' | 'bank'; id: string }>();
  for (const u of manifest.units) {
    for (const s of u.skills)
      for (const id of s.itemIds) owners.set(id, { kind: 'unit', id: u.id });
  }
  for (const b of manifest.banks)
    for (const id of b.itemIds) owners.set(id, { kind: 'bank', id: b.id });
  return owners;
}

/**
 * All content loaders over one manifest and one set of lazy globs. Exported for tests
 * (fake manifest + counting importers); the app uses the instance below.
 */
export function createContentLoader(
  manifest: CourseManifest,
  importers: ContentImporters,
  extraUnit: (unitId: string) => Unit | null = () => null,
) {
  const units = createUnitLoader(manifest.units, importers.units);
  const banks = createJsonLoader<Bank>({
    kind: 'bank',
    importers: importers.banks,
    pathOf: (id) => {
      const file = manifest.banks.find((b) => b.id === id)?.file;
      return file === undefined ? undefined : `./banks/${file}`;
    },
    validator: { schema: bankSchema, issues: sameId('banco') },
  });
  const known = new Set([
    ...manifest.units.flatMap((u) => u.skills.flatMap((s) => s.itemIds)),
    ...manifest.banks.flatMap((b) => b.itemIds),
  ]);
  const maps = createJsonLoader<MindMap>({
    kind: 'map',
    importers: importers.maps,
    pathOf: (id) => {
      const file = manifest.maps.find((m) => m.id === id)?.file;
      return file === undefined ? undefined : `./mindmaps/${file}`;
    },
    // validate:content runs every map rule; at runtime, only what would break the screen.
    validator: async () => {
      const { mapRefs, mindMapSchema } = await import('./schemas/mindmap');
      return {
        schema: mindMapSchema,
        issues: (map: MindMap, id: string) => [
          ...sameId('mapa')(map, id),
          ...mapRefs(map)
            .filter((ref) => !known.has(ref))
            .map((ref) => `o item "${ref}" não existe`),
        ],
      };
    },
  });
  const plans = createJsonLoader<StudyPlan>({
    kind: 'plan',
    importers: importers.plans,
    pathOf: (id) => {
      const file = manifest.plans.find((p) => p.id === id)?.file;
      return file === undefined ? undefined : `./plans/${file}`;
    },
    validator: async () => ({
      schema: (await import('./schemas/collection')).studyPlanSchema,
      issues: sameId('plano'),
    }),
  });
  const collections = createJsonLoader<Collection[]>({
    kind: 'collections',
    importers: importers.collections,
    pathOf: () => './collections.json',
    validator: async () => ({
      schema: (await import('./schemas/collection')).collectionsFileSchema,
    }),
  });
  let owners: ReturnType<typeof itemOwners> | null = null;

  const loadUnit = (unitId: string): Promise<Unit> => {
    const extra = extraUnit(unitId);
    return extra ? Promise.resolve(extra) : units.load(unitId);
  };

  return {
    loadUnit,
    loadBank: (bankId: string) => banks.load(bankId),
    loadMap: (mapId: string) => maps.load(mapId),
    loadPlan: (planId: string) => plans.load(planId),
    /** The shelf of the Maps tab; no collections.json yet = no collections. */
    loadCollections: (): Promise<Collection[]> =>
      './collections.json' in importers.collections
        ? collections.load('collections')
        : Promise.resolve([]),
    /**
     * Loads only the units and banks that own the given items, and indexes everything in them
     * (items of the same files serve as distractors). Unknown ids are skipped.
     */
    async loadItems(itemIds: Iterable<string>): Promise<ItemIndex> {
      owners ??= itemOwners(manifest);
      const unitIds = new Set<string>();
      const bankIds = new Set<string>();
      for (const id of itemIds) {
        const owner = owners.get(id);
        if (owner?.kind === 'unit') unitIds.add(owner.id);
        else if (owner?.kind === 'bank') bankIds.add(owner.id);
      }
      const [loadedUnits, loadedBanks] = await Promise.all([
        Promise.all([...unitIds].map(loadUnit)),
        Promise.all([...bankIds].map((id) => banks.load(id))),
      ]);
      const index = indexUnits(loadedUnits);
      for (const [id, item] of indexBanks(loadedBanks)) index.items.set(id, item);
      return index;
    },
    clear() {
      for (const l of [units, banks, maps, plans, collections]) l.clear();
      owners = null;
    },
  };
}

// Created on first use, so a content problem surfaces as a rejected load (ContentLoadError),
// never as an exception while the app module graph is being evaluated.
let content: ReturnType<typeof createContentLoader> | null = null;
const loader = () =>
  (content ??= createContentLoader(getCourseManifest(), globs, (unitId) =>
    isDemoUnit(unitId) ? demo() : null,
  ));

/** Imports and validates one unit (cached). Rejects with `ContentLoadError`. */
export const loadUnit = (unitId: string) => loader().loadUnit(unitId);
/** Imports and validates one item bank (cached). Rejects with `ContentLoadError`. */
export const loadBank = (bankId: string) => loader().loadBank(bankId);
/** Imports and validates one mind map (cached). Rejects with `ContentLoadError`. */
export const loadMap = (mapId: string) => loader().loadMap(mapId);
/** Imports and validates one study plan (cached). Rejects with `ContentLoadError`. */
export const loadPlan = (planId: string) => loader().loadPlan(planId);
/** Imports and validates collections.json (cached). Rejects with `ContentLoadError`. */
export const loadCollections = () => loader().loadCollections();
/** Loads the units and banks that own the given items and indexes them. */
export const loadItems = (itemIds: Iterable<string>) => loader().loadItems(itemIds);

/** Loads the unit of a lesson and resolves it (null = unknown lesson id). */
export async function loadLesson(lessonId: string): Promise<LessonRef | null> {
  const where = findLesson(lessonId);
  if (!where) return null;
  const unit = await loadUnit(where.unitId);
  return indexUnits([unit]).lessons.get(lessonId) ?? null;
}

let knownWordsCache: Promise<ReadonlySet<string>> | null = null;

/** Normalized words of the whole course (blocks false "almost right"); generated list, lazy chunk. */
export function loadKnownWords(): Promise<ReadonlySet<string>> {
  knownWordsCache ??= import('./knownWords.generated').then(({ knownWords }) => {
    const words = new Set(knownWords);
    const demoUnit = demoEnabled ? demo() : null;
    if (demoUnit) for (const w of knownWordsOf([demoUnit])) words.add(w);
    return words;
  });
  // A failed chunk load must not stay cached: the next call retries.
  knownWordsCache.catch(() => {
    knownWordsCache = null;
  });
  return knownWordsCache;
}

export type { StudyItem };

/** Test-only: forget cached content. */
export function resetContentCache(): void {
  content?.clear();
  knownWordsCache = null;
}
