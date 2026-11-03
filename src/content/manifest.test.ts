import { assembleContent, type RawFile } from './assemble';
import { crossUnitReferences } from './buildManifest';
import { buildCourse } from './course';
import { knownWords } from './knownWords.generated';
import { courseManifest } from './manifest.generated';

// Eager globs are fine here: tests compare the generated index with the real JSON.
type Mod = { default: unknown };
const read = (mods: Record<string, Mod>, folder: string): RawFile[] =>
  Object.entries(mods).map(([path, mod]) => ({
    file: path.replace(`./${folder}/`, ''),
    raw: mod.default,
  }));
const units = read(import.meta.glob<Mod>('./units/*.json', { eager: true }), 'units');
const banks = read(import.meta.glob<Mod>('./banks/*.json', { eager: true }), 'banks');
const maps = read(import.meta.glob<Mod>('./mindmaps/*.json', { eager: true }), 'mindmaps');
const plans = read(import.meta.glob<Mod>('./plans/*.json', { eager: true }), 'plans');
const single = (mods: Record<string, Mod>) => Object.values(mods)[0]?.default;
const collections = single(import.meta.glob<Mod>('./collections.json', { eager: true }));
const decks = single(import.meta.glob<Mod>('./decks.json', { eager: true }));
const art = Object.keys(import.meta.glob('./art/*.svg')).map((p) =>
  p.replace('./art/', '').replace(/\.svg$/, ''),
);

const assembled = assembleContent({ units, banks, maps, plans, collections, decks, art });
const { course } = buildCourse(units.map((u) => u.raw));

describe('course manifest (ADR-012, MAPAS-E-CARTAS §2.7)', () => {
  it('content is valid', () => {
    expect(assembled.errors).toEqual([]);
  });

  it('matches the real content (run `npm run validate:content` to regenerate)', () => {
    expect(courseManifest).toEqual(assembled.manifest);
  });

  it('lists every unit, bank, map and plan file exactly once, units in order', () => {
    const files = (list: readonly { file: string }[]) => list.map((x) => x.file).sort();
    expect(files(courseManifest.units)).toEqual(files(units));
    expect(files(courseManifest.banks)).toEqual(files(banks));
    expect(files(courseManifest.maps)).toEqual(files(maps));
    expect(files(courseManifest.plans)).toEqual(files(plans));
    const orders = courseManifest.units.map((u) => u.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('known words list matches the content (units and banks)', () => {
    expect(knownWords).toEqual(assembled.knownWords);
  });

  it('units are self-contained (a lesson only cites items of its own unit)', () => {
    expect(course.units.flatMap(crossUnitReferences)).toEqual([]);
  });

  it('counts match the content', () => {
    for (const unit of course.units) {
      const m = courseManifest.units.find((u) => u.id === unit.id);
      expect(m?.level).toBe(unit.level);
      expect(m?.skills.map((s) => s.lessons.map((l) => l.exerciseCount))).toEqual(
        unit.skills.map((s) => s.lessons.map((l) => l.exercises.length)),
      );
      expect(m?.skills.flatMap((s) => s.itemIds).length).toBe(
        unit.skills.reduce((n, s) => n + s.vocab.length + s.sentences.length, 0),
      );
    }
  });
});
