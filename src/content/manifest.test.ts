import { buildManifest, crossUnitReferences } from './buildManifest';
import { buildCourse, knownWordsOf } from './course';
import { knownWords } from './knownWords.generated';
import { courseManifest } from './manifest.generated';

// Eager glob is fine here: tests compare the generated index with the real JSON.
const files = import.meta.glob<{ default: unknown }>('./units/*.json', { eager: true });
const entries = Object.entries(files).map(([path, mod]) => ({
  file: path.replace('./units/', ''),
  raw: mod.default,
}));
const { course, errors } = buildCourse(entries.map((e) => e.raw));
const fileOf = (id: string) =>
  entries.find((e) => (e.raw as { id?: unknown }).id === id)?.file ?? ''; // raw JSON, id checked by buildCourse

describe('course manifest (ADR-012)', () => {
  it('content is valid', () => {
    expect(errors).toEqual([]);
  });

  it('matches the real content (run `npm run validate:content` to regenerate)', () => {
    const expected = buildManifest(course.units.map((unit) => ({ unit, file: fileOf(unit.id) })));
    expect(courseManifest).toEqual(expected);
  });

  it('lists every unit file exactly once, in order', () => {
    expect(courseManifest.units.map((u) => u.file).sort()).toEqual(
      entries.map((e) => e.file).sort(),
    );
    const orders = courseManifest.units.map((u) => u.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('known words list matches the content', () => {
    expect(knownWords).toEqual(knownWordsOf(course.units));
  });

  it('units are self-contained (a lesson only cites items of its own unit)', () => {
    expect(course.units.flatMap(crossUnitReferences)).toEqual([]);
  });

  it('counts match the content', () => {
    for (const unit of course.units) {
      const m = courseManifest.units.find((u) => u.id === unit.id);
      expect(m?.skills.map((s) => s.lessons.map((l) => l.exerciseCount))).toEqual(
        unit.skills.map((s) => s.lessons.map((l) => l.exercises.length)),
      );
      expect(m?.skills.flatMap((s) => s.itemIds).length).toBe(
        unit.skills.reduce((n, s) => n + s.vocab.length + s.sentences.length, 0),
      );
    }
  });
});
