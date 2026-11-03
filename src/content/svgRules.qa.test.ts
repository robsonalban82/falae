import { svgIssues } from './svgRules';

// QA: edge cases of the scene style checks (ESTILO.md, MAPAS-E-CARTAS §12.3).

const valid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <title>Escola</title>
  <path d="M20 120c30-40 90-40 120 0z" fill="#FFF1D6"/>
  <path d="M40 60h80v60H40z" fill="#3B3FB6" stroke="#1B1C33" stroke-width="3.5"/>
</svg>`;
const withPath = (attrs: string) => valid.replace('<path d="M40', `<path ${attrs} d="M40`);
const inside = (markup: string) => valid.replace('</svg>', `${markup}</svg>`);

describe('svgIssues edge cases (QA)', () => {
  it.each([
    ['empty <title></title>', valid.replace('<title>Escola</title>', '<title></title>')],
    ['self-closing <title/>', valid.replace('<title>Escola</title>', '<title/>')],
    ['title with only spaces and newlines', valid.replace('Escola', '\n   \t ')],
  ])('%s counts as missing title', (_case, svg) => {
    expect(svgIssues('a', svg)).toContain('a: falta <title> em português.');
  });

  it('accepts upper-case tags for title and background colour in lower case', () => {
    const svg = valid
      .replace('<title>Escola</title>', '<TITLE>Escola</TITLE>')
      .replace('#FFF1D6', '#fff1d6');
    expect(svgIssues('a', svg)).toEqual([]);
  });

  it.each([
    ['<SCRIPT>', inside('<SCRIPT>alert(1)</SCRIPT>'), 'tem <script>.'],
    ['ONLOAD=', withPath('ONLOAD="x()"'), 'tem atributo de evento (on…).'],
    ['onclick on a new line', withPath('\n  onclick = "x()"'), 'tem atributo de evento (on…).'],
    [
      'onload on the root',
      valid.replace('<svg ', '<svg onload="x()" '),
      'tem atributo de evento (on…).',
    ],
    ['xlink:href', inside('<use xlink:href="#a"/>'), 'referencia imagem ou link externo.'],
    ['XLINK:HREF', inside('<use XLINK:HREF="#a"/>'), 'referencia imagem ou link externo.'],
    [
      'plain href on <a>',
      inside('<a href="javascript:x()"></a>'),
      'referencia imagem ou link externo.',
    ],
    ['STYLE attribute', withPath('STYLE="fill:red"'), 'tem CSS embutido.'],
    [
      '<style> with CDATA',
      inside('<style><![CDATA[path{fill:red}]]></style>'),
      'tem CSS embutido.',
    ],
    ['ID=', withPath('ID="p"'), 'tem id= (a cena pode aparecer várias vezes na página).'],
    ['filter in style', withPath('style="filter: blur(2px)"'), 'usa filtro.'],
  ])('rejects %s', (_case, svg, problem) => {
    expect(svgIssues('a', svg)).toContain(`a: ${problem}`);
  });

  it('script hidden in CDATA is still a <script>', () => {
    expect(svgIssues('a', inside('<script><![CDATA[alert(1)]]></script>'))).toContain(
      'a: tem <script>.',
    );
  });

  it('does not flag common attributes that contain forbidden words', () => {
    const svg = withPath('data-id="x" stroke-linejoin="round" font-style="normal" class="on"');
    expect(svgIssues('a', svg)).toEqual([]);
  });

  it('accepts a viewBox with extra spaces', () => {
    expect(svgIssues('a', valid.replace('0 0 160 160', ' 0  0 160\n160 '))).toEqual([]);
  });

  // ---- Findings fixed after the QA round (were it.fails) ----

  // SVG is case-sensitive: `viewbox` is ignored by browsers when the file is used in <img>.
  it('rejects a lower-case viewbox attribute', () => {
    expect(svgIssues('a', valid.replace('viewBox', 'viewbox'))).toContain(
      'a: viewBox precisa ser "0 0 160 160".',
    );
  });

  it('accepts a viewBox in single quotes', () => {
    expect(svgIssues('a', valid.replace('viewBox="0 0 160 160"', "viewBox='0 0 160 160'"))).toEqual(
      [],
    );
  });

  it('accepts <title> with attributes (lang="pt-BR")', () => {
    expect(svgIssues('a', valid.replace('<title>', '<title lang="pt-BR">'))).toEqual([]);
  });

  it('rejects the background colour only present in the title/comment', () => {
    const svg = valid
      .replace('fill="#FFF1D6"', 'fill="#FFFFFF"')
      .replace('</svg>', '<!-- fundo #FFF1D6 --></svg>');
    expect(svgIssues('a', svg)).toContain('a: falta a mancha de fundo #FFF1D6.');
  });

  it('rejects SMIL that sets href/on* (runs code when inlined in print)', () => {
    const svg = inside('<a><animate attributeName="href" values="javascript:alert(1)"/></a>');
    expect(svgIssues('a', svg).length).toBeGreaterThan(0);
  });

  it('rejects namespaced <svg:script>', () => {
    expect(svgIssues('a', inside('<svg:script>alert(1)</svg:script>'))).toContain(
      'a: tem <script>.',
    );
  });

  it('rejects <!DOCTYPE>/<!ENTITY> declarations', () => {
    const svg = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]>${valid}`;
    expect(svgIssues('a', svg).length).toBeGreaterThan(0);
  });
});
