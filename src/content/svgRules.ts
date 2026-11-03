/**
 * Rules of the scene style guide (ESTILO.md, MAPAS-E-CARTAS §12.3) that a text check can
 * verify. Scenes are shown on the site and inlined in print, so anything that could run code,
 * clash when repeated on a page or break the dark theme is rejected. Pure: no file system.
 */
export const SCENE_VIEWBOX = '0 0 160 160';
/** Organic background patch that keeps the drawing readable on the dark theme. */
export const SCENE_BACKGROUND = '#FFF1D6';

/** Element name with an optional namespace prefix (`<svg:script>` is still a script). */
const el = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}\\b`, 'i');

const FORBIDDEN: readonly [RegExp, string][] = [
  [/<!DOCTYPE|<!ENTITY/i, 'tem <!DOCTYPE>/<!ENTITY>'],
  [el('script'), 'tem <script>'],
  [/\son[a-z]+\s*=/i, 'tem atributo de evento (on…)'],
  [/javascript:/i, 'tem javascript:'],
  [el('(?:animate\\w*|set)'), 'tem animação SMIL (<animate>/<set>)'],
  [el('text'), 'tem <text> (a cena não leva texto)'],
  [el('defs'), 'tem <defs>'],
  [/<(?:[\w-]+:)?filter\b|\sfilter\s*=|filter\s*:/i, 'usa filtro'],
  [/\sid\s*=/i, 'tem id= (a cena pode aparecer várias vezes na página)'],
  [el('foreignObject'), 'tem <foreignObject>'],
  [/<(?:[\w-]+:)?image\b|\s(xlink:)?href\s*=/i, 'referencia imagem ou link externo'],
  [/<(?:[\w-]+:)?style\b|\sstyle\s*=/i, 'tem CSS embutido'],
];

/** Problems of one scene file, as readable PT-BR lines (empty = follows the guide). */
export function svgIssues(name: string, svg: string): string[] {
  const issues: string[] = [];
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) return [`${name}: não é um SVG.`];
  // SVG attributes are case-sensitive: browsers ignore "viewbox" in an <img>.
  const viewBox = /\sviewBox\s*=\s*(["'])([\s\S]*?)\1/.exec(root)?.[2];
  if (viewBox?.trim().replace(/\s+/g, ' ') !== SCENE_VIEWBOX) {
    issues.push(`${name}: viewBox precisa ser "${SCENE_VIEWBOX}".`);
  }
  const title = /<title(?:\s[^>]*)?>([^<]*)<\/title>/i.exec(svg)?.[1]?.trim();
  if (!title) issues.push(`${name}: falta <title> em português.`);
  for (const [pattern, problem] of FORBIDDEN)
    if (pattern.test(svg)) issues.push(`${name}: ${problem}.`);
  // The background must be painted (a fill), not just mentioned in a comment or the title.
  const drawing = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title[\s\S]*?<\/title>/gi, '');
  const background = new RegExp(`\\sfill\\s*=\\s*["']${SCENE_BACKGROUND}["']`, 'i');
  if (!background.test(drawing))
    issues.push(`${name}: falta a mancha de fundo ${SCENE_BACKGROUND}.`);
  return issues;
}
