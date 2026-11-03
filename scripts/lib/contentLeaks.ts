/**
 * Detects lazy content that leaked into the initial JS (ADR-012/013, MAPAS-E-CARTAS §2.7).
 * Pure helpers used by check-prod-bundle (which reads dist/ and src/content).
 */

/** String leaves of a JSON value. */
function* strings(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* strings(v);
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) yield* strings(v);
}

/** Texts the minifier may write differently (quotes, backslashes, line breaks, control chars). */
// eslint-disable-next-line no-control-regex -- control characters are exactly what we reject
const UNSTABLE = /["'`\\\u0000-\u001f\u2028\u2029]/;

/**
 * Up to `count` long texts of a content file that never go to the initial JS on their own:
 * if one shows up there, the file itself was bundled. `exclude` is the text of what *is*
 * initial (the generated manifest, the UI copy in pt-BR.ts), to avoid false positives.
 */
export function contentMarkers(raw: unknown, exclude: string, count = 3): string[] {
  return [...new Set(strings(raw))]
    .filter((s) => s.length >= 20 && !UNSTABLE.test(s) && !exclude.includes(s))
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, count);
}

/** `key:"value"` pairs of a JSON value (how the minifier writes an object literal). */
function* pairs(value: unknown): Generator<[string, string]> {
  if (Array.isArray(value)) for (const v of value) yield* pairs(v);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') yield [k, v];
      else yield* pairs(v);
    }
  }
}

/**
 * Fallback for files with only short texts: up to `count` `key:"value"` needles whose value
 * is in no initial text. Longer values first. Empty = the file cannot be checked.
 */
export function pairMarkers(raw: unknown, exclude: string, count = 3): string[] {
  return [
    ...new Set(
      [...pairs(raw)]
        .filter(([k, v]) => /^[A-Za-z_$][\w$]*$/.test(k) && v.length >= 3)
        .filter(([, v]) => !UNSTABLE.test(v) && !exclude.includes(v))
        .sort(
          ([ka, a], [kb, b]) => b.length - a.length || a.localeCompare(b) || ka.localeCompare(kb),
        )
        .map(([k, v]) => `${k}:"${v}"`),
    ),
  ].slice(0, count);
}

/**
 * Whether the code contains a marker. A `key:"value"` marker also matches the other quote
 * styles the minifier may pick (it writes most strings as template literals).
 */
export function containsMarker(code: string, marker: string): boolean {
  const pair = /^([A-Za-z_$][\w$]*):"(.*)"$/.exec(marker);
  if (!pair) return code.includes(marker);
  const [, key, value] = pair;
  return ['"', "'", '`'].some((q) => code.includes(`${key}:${q}${value}${q}`));
}

/**
 * Scenes referenced by the initial JS: SVG markup, data URLs, the art map, or the hashed file
 * of one of `sceneNames` (the files of src/content/art, without ".svg").
 */
export function sceneLeaks(initialCode: string, sceneNames: readonly string[] = []): string[] {
  const leaks: string[] = [];
  if (/<svg[\s>]/i.test(initialCode)) leaks.push('SVG embutido (<svg) no JS inicial');
  if (initialCode.includes('data:image/svg+xml')) leaks.push('data:image/svg+xml no JS inicial');
  if (initialCode.includes('content/art/')) leaks.push('mapa de cenas (art.ts) no JS inicial');
  for (const name of sceneNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?<![\\w-])${escaped}-[\\w-]{8}\\.svg`).exec(initialCode)?.[0];
    if (found) leaks.push(`cena ${found} no JS inicial`);
  }
  return leaks;
}
