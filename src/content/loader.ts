import { buildCourse, type BuildResult } from './course';
import { DEMO_UNIT_ID, demoUnit } from '../dev/demoUnit';

const modules = import.meta.glob<{ default: unknown }>('./units/*.json', { eager: true });

let cached: BuildResult | null = null;

/** Loads and validates all bundled units once. Invalid units are skipped and logged. */
export function loadCourse(): BuildResult {
  if (cached) return cached;
  const raw = Object.keys(modules)
    .sort()
    .map((path) => modules[path]?.default);
  if (import.meta.env.VITE_DEMO === '1') raw.push(demoUnit);
  cached = buildCourse(raw);
  if (cached.errors.length > 0) {
    console.error('[falae] Conteúdo inválido foi ignorado:\n' + cached.errors.join('\n'));
  }
  return cached;
}

/** The demo unit (VITE_DEMO builds only) is not part of the path and its lessons always open. */
export function isDemoUnit(unitId: string): boolean {
  return import.meta.env.VITE_DEMO === '1' && unitId === DEMO_UNIT_ID;
}

/** Units shown on the path (sorted by order). */
export function pathUnits(): BuildResult['course']['units'] {
  return loadCourse().course.units.filter((u) => !isDemoUnit(u.id));
}
