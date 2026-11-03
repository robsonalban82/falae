import { svgIssues } from './svgRules';

/** Every scene bundled with the app (empty until the prototype port, FASE-2 step 10). */
const scenes = import.meta.glob<string>('./art/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const valid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <title>Escola</title>
  <path d="M20 120c30-40 90-40 120 0z" fill="#FFF1D6"/>
  <path d="M40 60h80v60H40z" fill="#3B3FB6" stroke="#1B1C33" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

describe('svgIssues (ESTILO.md)', () => {
  it('accepts a scene that follows the guide', () => {
    expect(svgIssues('escola', valid)).toEqual([]);
  });

  it.each([
    ['viewBox', valid.replace('0 0 160 160', '0 0 64 64'), 'viewBox precisa ser "0 0 160 160".'],
    ['title', valid.replace('<title>Escola</title>', ''), 'falta <title> em português.'],
    ['empty title', valid.replace('Escola', ' '), 'falta <title> em português.'],
    ['script', valid.replace('</svg>', '<script>alert(1)</script></svg>'), 'tem <script>.'],
    [
      'on*',
      valid.replace('<path d="M40', '<path onclick="x()" d="M40'),
      'tem atributo de evento (on…).',
    ],
    [
      'SMIL',
      valid.replace('</svg>', '<set attributeName="fill" to="red"/></svg>'),
      'tem animação SMIL (<animate>/<set>).',
    ],
    [
      'javascript:',
      valid.replace('<title>Escola</title>', '<title>javascript:x</title>'),
      'tem javascript:.',
    ],
    ['DOCTYPE', `<!DOCTYPE svg>${valid}`, 'tem <!DOCTYPE>/<!ENTITY>.'],
    [
      'text',
      valid.replace('</svg>', '<text x="1">oi</text></svg>'),
      'tem <text> (a cena não leva texto).',
    ],
    ['defs', valid.replace('</svg>', '<defs></defs></svg>'), 'tem <defs>.'],
    ['filter', valid.replace('<path d="M40', '<path filter="url(#f)" d="M40'), 'usa filtro.'],
    [
      'id',
      valid.replace('<path d="M40', '<path id="porta" d="M40'),
      'tem id= (a cena pode aparecer várias vezes na página).',
    ],
    [
      'foreignObject',
      valid.replace('</svg>', '<foreignObject></foreignObject></svg>'),
      'tem <foreignObject>.',
    ],
    [
      'image',
      valid.replace('</svg>', '<image href="https://x.y/a.png"/></svg>'),
      'referencia imagem ou link externo.',
    ],
    ['style', valid.replace('<path d="M40', '<path style="fill:red" d="M40'), 'tem CSS embutido.'],
    ['background', valid.replace('#FFF1D6', '#FFFFFF'), 'falta a mancha de fundo #FFF1D6.'],
  ])('rejects a scene breaking the %s rule', (_rule, svg, problem) => {
    expect(svgIssues('escola', svg)).toEqual([`escola: ${problem}`]);
  });

  it('rejects something that is not an SVG', () => {
    expect(svgIssues('x', '<html></html>')).toEqual(['x: não é um SVG.']);
  });

  it('does not mistake data-* or stroke-width for forbidden attributes', () => {
    expect(svgIssues('a', valid.replace('<path d="M40', '<path data-part="porta" d="M40'))).toEqual(
      [],
    );
  });
});

describe('scenes in src/content/art', () => {
  it('every scene follows ESTILO.md (passes empty before the port)', () => {
    const issues = Object.entries(scenes).flatMap(([path, svg]) =>
      svgIssues(path.replace('./art/', ''), svg),
    );
    expect(issues).toEqual([]);
  });
});
