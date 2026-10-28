import { buildCourse } from './course';
import { pedagogyIssues } from './pedagogy';

/** The bundled course must load with zero schema or pedagogy problems. */
const modules = import.meta.glob<{ default: unknown }>('./units/*.json', { eager: true });
const raw = Object.keys(modules)
  .sort()
  .map((p) => modules[p]?.default);

describe('real course content', () => {
  const { course, errors } = buildCourse(raw);

  it('passes schema validation', () => {
    expect(errors).toEqual([]);
    expect(course.units).toHaveLength(raw.length);
  });

  it('follows the pedagogy rules', () => {
    expect(course.units.flatMap(pedagogyIssues)).toEqual([]);
  });

  it('has units in order 1..n', () => {
    expect(course.units.map((u) => u.order)).toEqual(course.units.map((_, i) => i + 1));
  });
});
