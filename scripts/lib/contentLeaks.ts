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

type Leaf = { marker: string; value: string; depth: number };

/**
 * Candidate needles of a JSON value: `key:"value"` for object string values (how the minifier
 * writes an object literal) and the bare text for strings inside arrays. `depth` is the object
 * nesting level (0 = top-level fields such as id/title; array items count one level deeper, which are the most likely to repeat).
 */
function* leaves(value: unknown, depth = 0): Generator<Leaf> {
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string') yield { marker: v, value: v, depth: depth + 1 };
      else yield* leaves(v, depth + 1);
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') {
        if (/^[A-Za-z_$][\w$]*$/.test(k)) yield { marker: `${k}:"${v}"`, value: v, depth };
      } else yield* leaves(v, depth + 1);
    }
  }
}

/**
 * Fallback for files with only short texts: up to `count` needles whose value is in no initial
 * text. Nested values come first (top-level ones tend to repeat in initial code), then longer
 * ones. Empty = the file cannot be checked.
 */
export function pairMarkers(raw: unknown, exclude: string, count = 3): string[] {
  const seen = new Set<string>();
  return [...leaves(raw)]
    .filter((l) => l.value.length >= 3 && !UNSTABLE.test(l.value) && !exclude.includes(l.value))
    .sort(
      (a, b) =>
        Number(b.depth >= 1) - Number(a.depth >= 1) ||
        b.value.length - a.value.length ||
        a.value.localeCompare(b.value) ||
        a.marker.localeCompare(b.marker),
    )
    .map((l) => l.marker)
    .filter((m) => !seen.has(m) && seen.add(m))
    .slice(0, count);
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

/** Scenes that did not become their own hashed `.svg` in dist/assets (`?no-inline` not applied). */
export function missingSceneFiles(assetFiles: readonly string[], sceneNames: readonly string[]) {
  return sceneNames.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const file = new RegExp(`^${escaped}-[\\w-]{8}\\.svg$`);
    return !assetFiles.some((f) => file.test(f));
  });
}

/** Build files (JS or CSS, any chunk) that inline an SVG as a data URL. */
export function inlinedSvgFiles(files: readonly { name: string; code: string }[]): string[] {
  return files.filter((f) => f.code.includes('data:image/svg+xml')).map((f) => f.name);
}

/**
 * Notebook layer (Patrick Hand font, `.nb-*` CSS) referenced by index.html: any preload/prefetch/
 * stylesheet link to the font, or to a stylesheet whose text `readCss(href)` has the notebook.
 */
export function notebookInHtml(
  html: string,
  readCss: (href: string) => string | undefined,
): string[] {
  const problems: string[] = [];
  for (const link of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = link[0];
    const href = /href="([^"]+)"/.exec(tag)?.[1];
    if (!href) continue;
    if (/patrick/i.test(href))
      problems.push(`index.html pré-carrega a fonte Patrick Hand (${href})`);
    else if (/rel="(?:stylesheet|preload|modulepreload|prefetch)"/i.test(tag)) {
      const css = readCss(href);
      if (css && (css.includes('Patrick Hand') || css.includes('.nb-')))
        problems.push(`index.html carrega o CSS do caderno (${href})`);
    }
  }
  return problems;
}
