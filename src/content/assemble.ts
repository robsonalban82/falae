import { buildManifest, crossUnitReferences, type CourseManifest } from './buildManifest';
import { buildCourse, knownWordsOf } from './course';
import {
  buildItemFacts,
  collectionIssues,
  deckIssues,
  lessonOrderOf,
  planIssues,
} from './collectionIssues';
import { buildMindMapContext, mindMapIssues, mindMapSetIssues, unusedArt } from './mindmapIssues';
import { pedagogyIssues } from './pedagogy';
import { formatIssues } from './schema';
import {
  collectionsFileSchema,
  decksFileSchema,
  studyPlanSchema,
  type Collection,
  type Deck,
} from './schemas/collection';
import { bankSchema, courseIssues } from './schemas/course';
import { mindMapSchema } from './schemas/mindmap';

/** A content file already read from disk (or from an eager glob in tests). */
export type RawFile = { file: string; raw: unknown };

export type RawContent = {
  units: readonly RawFile[];
  banks?: readonly RawFile[];
  maps?: readonly RawFile[];
  plans?: readonly RawFile[];
  /** collections.json (absent = no collections yet). */
  collections?: unknown;
  /** decks.json (absent = no themed decks yet). */
  decks?: unknown;
  /** Scene names in src/content/art (without ".svg"). */
  art?: readonly string[];
};

export type AssembledContent = {
  manifest: CourseManifest;
  knownWords: string[];
  errors: string[];
  warnings: string[];
  counts: { units: number; items: number; lessons: number; exercises: number };
};

/**
 * Validates every content folder and builds the manifest (pure: no file system).
 * Used by validate:content, which writes the generated files, and by manifest.test.ts,
 * which fails when they drift. Invalid files are reported and left out of the manifest.
 */
export function assembleContent(input: RawContent): AssembledContent {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { course, errors: unitErrors } = buildCourse(input.units.map((u) => u.raw));
  errors.push(
    ...unitErrors,
    ...course.units.flatMap(pedagogyIssues),
    ...course.units.flatMap((u) => crossUnitReferences(u).map((line) => `[${u.id}] ${line}`)),
  );
  const fileOfUnit = (id: string) =>
    input.units.find(({ raw }) => isRecord(raw) && raw.id === id)?.file ?? `${id}.json`;

  const banks = parseEach(input.banks ?? [], 'banks', (raw) => bankSchema.safeParse(raw), errors);
  errors.push(...courseIssues({ units: course.units, banks: banks.map((b) => b.data) }));

  const art = input.art ?? [];
  const maps = parseEach(
    input.maps ?? [],
    'mindmaps',
    (raw) => mindMapSchema.safeParse(raw),
    errors,
  );
  const mapCtx = buildMindMapContext({ units: course.units, banks: banks.map((b) => b.data), art });
  for (const { file, data } of maps) {
    const found = mindMapIssues(data, mapCtx);
    errors.push(...found.errors.map((line) => `[mindmaps/${file}] ${line}`));
    warnings.push(...found.warnings.map((line) => `[mindmaps/${file}] ${line}`));
  }
  errors.push(...mindMapSetIssues(maps.map(({ file, data }) => ({ file, map: data }))));
  warnings.push(
    ...unusedArt(
      maps.map((m) => m.data),
      art,
    ),
  );

  const items = buildItemFacts({ units: course.units, banks: banks.map((b) => b.data) });
  const mapIds = new Set(maps.map((m) => m.data.id));
  const plans = parseEach(
    input.plans ?? [],
    'plans',
    (raw) => studyPlanSchema.safeParse(raw),
    errors,
  );
  const lessonOrder = lessonOrderOf(course.units);
  for (const { data } of plans) errors.push(...planIssues(data, { items, mapIds, lessonOrder }));

  const collections = parseFile<Collection[]>(
    input.collections,
    'collections.json',
    (raw) => collectionsFileSchema.safeParse(raw),
    errors,
  );
  const planIds = new Set(plans.map((p) => p.data.id));
  for (const c of collections) errors.push(...collectionIssues(c, { items, mapIds, planIds }));

  const decks = parseFile<Deck[]>(
    input.decks,
    'decks.json',
    (raw) => decksFileSchema.safeParse(raw),
    errors,
  );
  for (const d of decks) errors.push(...deckIssues(d, { items }));

  const bankList = banks.map((b) => b.data);
  const lessons = [...course.lessons.values()];
  return {
    manifest: buildManifest({
      units: course.units.map((unit) => ({ unit, file: fileOfUnit(unit.id) })),
      banks: banks.map(({ file, data }) => ({ bank: data, file })),
      maps: maps.map(({ file, data }) => ({ map: data, file })),
      collections,
      decks,
      plans: plans.map(({ file, data }) => ({ plan: data, file })),
    }),
    knownWords: knownWordsOf(course.units, bankList),
    errors,
    warnings,
    counts: {
      units: course.units.length,
      items:
        course.items.size + bankList.reduce((n, b) => n + b.vocab.length + b.sentences.length, 0),
      lessons: lessons.length,
      exercises: lessons.reduce((n, l) => n + l.lesson.exercises.length, 0),
    },
  };
}

type Parsed<T> =
  { success: true; data: T } | { success: false; error: Parameters<typeof formatIssues>[0] };

function parseEach<T extends { id: string }>(
  files: readonly RawFile[],
  folder: string,
  parse: (raw: unknown) => Parsed<T>,
  errors: string[],
): { file: string; data: T }[] {
  const out: { file: string; data: T }[] = [];
  for (const { file, raw } of [...files].sort((a, b) => a.file.localeCompare(b.file))) {
    const parsed = parse(raw);
    if (!parsed.success) {
      errors.push(...formatIssues(parsed.error).map((line) => `[${folder}/${file}] ${line}`));
      continue;
    }
    if (file !== `${parsed.data.id}.json`) {
      errors.push(
        `[${folder}/${file}] O id "${parsed.data.id}" precisa ser igual ao nome do arquivo.`,
      );
      continue;
    }
    out.push({ file, data: parsed.data });
  }
  return out;
}

function parseFile<T>(
  raw: unknown,
  file: string,
  parse: (raw: unknown) => Parsed<T>,
  errors: string[],
): T | [] {
  if (raw === undefined) return [];
  const parsed = parse(raw);
  if (parsed.success) return parsed.data;
  errors.push(...formatIssues(parsed.error).map((line) => `[${file}] ${line}`));
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
