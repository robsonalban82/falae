import { DEMO_UNIT_ID, demoUnit } from '../dev/demoUnit';
import type { CourseManifest, ManifestUnit } from './buildManifest';
import { buildManifest } from './buildManifest';
import { indexUnits, knownWordsOf, type Course, type LessonRef, type StudyItem } from './course';
import { courseManifest } from './manifest.generated';
import { formatIssues, unitSchema, type Unit } from './schema';

/**
 * Content loading (ADR-012): the manifest is synchronous and light; the full JSON of a unit is
 * imported (and validated with Zod) only when a lesson, tip, practice or placement needs it.
 */
const modules = import.meta.glob<{ default: unknown }>('./units/*.json');

export type ItemIndex = Pick<Course, 'items' | 'lessons'>;

export class ContentLoadError extends Error {
  constructor(
    readonly unitId: string,
    readonly reason: 'missing' | 'invalid',
    detail: string,
  ) {
    super(
      `[falae] Unidade "${unitId}" ${reason === 'missing' ? 'não encontrada' : 'inválida'}: ${detail}`,
    );
    this.name = 'ContentLoadError';
  }
}

// Literal env check so production builds drop the demo unit entirely.
const demoSource: unknown = import.meta.env.VITE_DEMO === '1' ? demoUnit : null;
const demoEnabled = demoSource !== null;
let manifestCache: CourseManifest | null = null;
let demoCache: Unit | null = null;

/** Demo unit validated like real content (VITE_DEMO builds only). */
function demo(): Unit {
  demoCache ??= unitSchema.parse(demoSource);
  return demoCache;
}

/** The whole course index (path units + the demo unit in VITE_DEMO builds). */
export function getCourseManifest(): CourseManifest {
  if (manifestCache) return manifestCache;
  manifestCache = demoEnabled
    ? {
        units: [...courseManifest.units, ...buildManifest([{ unit: demo(), file: '' }]).units],
      }
    : courseManifest;
  return manifestCache;
}

/** The demo unit (VITE_DEMO builds only) is not part of the path and its lessons always open. */
export function isDemoUnit(unitId: string): boolean {
  return demoEnabled && unitId === DEMO_UNIT_ID;
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

/** Ids of every item of the given units (all units when omitted). */
export function manifestItemIds(unitIds?: readonly string[]): Set<string> {
  const wanted = unitIds ? new Set(unitIds) : null;
  return new Set(
    getCourseManifest()
      .units.filter((u) => !wanted || wanted.has(u.id))
      .flatMap((u) => u.skills.flatMap((s) => s.itemIds)),
  );
}

/** Review lesson ids (commit rules need them without loading units). */
export function isReviewLesson(lessonId: string): boolean {
  return getCourseManifest().units.some((u) => u.reviewLesson.id === lessonId);
}

type UnitModules = Record<string, () => Promise<{ default: unknown }>>;

/**
 * Unit importer over a lazy glob: imports and validates one unit on demand, cached in memory.
 * Rejects with `ContentLoadError`; invalid content is never returned. Exported for tests.
 */
export function createUnitLoader(units: readonly ManifestUnit[], importers: UnitModules) {
  const cache = new Map<string, Promise<Unit>>();

  async function importUnit(unitId: string): Promise<Unit> {
    const entry = units.find((u) => u.id === unitId);
    const importer = entry ? importers[`./units/${entry.file}`] : undefined;
    if (!entry || !importer) throw new ContentLoadError(unitId, 'missing', 'fora do manifesto');
    const raw = (await importer()).default;
    const parsed = unitSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = formatIssues(parsed.error).join('\n');
      console.error(`[falae] Conteúdo inválido não foi carregado (${unitId}):\n${detail}`);
      throw new ContentLoadError(unitId, 'invalid', detail);
    }
    if (parsed.data.id !== unitId) {
      throw new ContentLoadError(unitId, 'invalid', `arquivo traz "${parsed.data.id}"`);
    }
    return parsed.data;
  }

  return {
    load(unitId: string): Promise<Unit> {
      const cached = cache.get(unitId);
      if (cached) return cached;
      const promise = importUnit(unitId);
      cache.set(unitId, promise);
      // A failed import may succeed later (e.g. back online): do not cache the rejection.
      promise.catch(() => cache.delete(unitId));
      return promise;
    },
    clear: () => cache.clear(),
  };
}

const unitLoader = createUnitLoader(courseManifest.units, modules);

/** Imports and validates one unit (cached). Rejects with `ContentLoadError`. */
export function loadUnit(unitId: string): Promise<Unit> {
  return isDemoUnit(unitId) ? Promise.resolve(demo()) : unitLoader.load(unitId);
}

/** Loads the given units and indexes their items and lessons (Practice, distractors). */
export async function loadItemIndex(unitIds: readonly string[]): Promise<ItemIndex> {
  const units = await Promise.all(unitIds.map(loadUnit));
  return indexUnits(units);
}

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
    if (demoEnabled) for (const w of knownWordsOf([demo()])) words.add(w);
    return words;
  });
  return knownWordsCache;
}

export type { StudyItem };

/** Test-only: forget cached units. */
export function resetContentCache(): void {
  unitLoader.clear();
  knownWordsCache = null;
}
