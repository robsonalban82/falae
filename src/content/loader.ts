import { buildCourse, type BuildResult } from './course';

const modules = import.meta.glob<{ default: unknown }>('./units/*.json', { eager: true });

let cached: BuildResult | null = null;

/** Loads and validates all bundled units once. Invalid units are skipped and logged. */
export function loadCourse(): BuildResult {
  if (cached) return cached;
  const raw = Object.keys(modules)
    .sort()
    .map((path) => modules[path]?.default);
  cached = buildCourse(raw);
  if (cached.errors.length > 0) {
    console.error('[falae] Conteúdo inválido foi ignorado:\n' + cached.errors.join('\n'));
  }
  return cached;
}
