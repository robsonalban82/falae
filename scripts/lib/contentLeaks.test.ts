import { describe, expect, it } from 'vitest';
import {
  containsMarker,
  contentMarkers,
  inlinedSvgFiles,
  missingSceneFiles,
  notebookInHtml,
  pairMarkers,
  sceneLeaks,
} from './contentLeaks';

describe('contentMarkers', () => {
  const map = {
    id: 'mm-to-be',
    title: 'Verbo to be',
    intro: 'O verbo mais usado do inglês. Comece pela afirmativa.',
    branches: [
      {
        label: 'Afirmativa',
        nodes: [{ lines: [{ note: 'Na conversa, quase sempre contraído.' }] }],
      },
    ],
    quiz: { instruction: 'Complete com a forma "certa" do to be.' },
  };

  it('picks the longest texts that are not in the manifest, without quotes', () => {
    const manifest = '{"title":"Verbo to be"}';
    expect(contentMarkers(map, manifest)).toEqual([
      'O verbo mais usado do inglês. Comece pela afirmativa.',
      'Na conversa, quase sempre contraído.',
    ]);
    expect(contentMarkers(map, manifest, 1)).toHaveLength(1);
  });

  it('skips texts already in the manifest', () => {
    expect(
      contentMarkers(
        map,
        'Na conversa, quase sempre contraído. O verbo mais usado do inglês. Comece pela afirmativa.',
      ),
    ).toEqual([]);
  });
});

describe('pairMarkers (fallback for files with only short texts)', () => {
  const bank = {
    id: 'frases',
    sentences: [
      { id: 'fr-001', en: 'Hi, Ana.', pt: 'Oi, Ana.' },
      { id: 'fr-002', en: 'Bye!', pt: 'Tchau!' },
    ],
  };

  it('builds key:"value" needles from values that are in no initial text', () => {
    const manifest = '{ id: "frases", itemIds: ["fr-001", "fr-002"] }';
    expect(pairMarkers(bank, manifest)).toEqual(['en:"Hi, Ana."', 'pt:"Oi, Ana."', 'pt:"Tchau!"']);
  });

  it('prefers nested pairs over top-level ones and also uses strings inside arrays', () => {
    const file = {
      id: 'banco-longo-demais',
      items: [{ en: 'Hi, Ana', accepted: ['Hello there', 'Hey you'] }],
    };
    expect(pairMarkers(file, '')).toEqual(['Hello there', 'Hey you', 'en:"Hi, Ana"']);
    expect(pairMarkers(file, '', 4)).toContain('id:"banco-longo-demais"');
    expect(pairMarkers(file, '', 4).at(-1)).toBe('id:"banco-longo-demais"');
  });

  it('skips values found in the UI copy and returns nothing when no value is safe', () => {
    expect(pairMarkers(bank, 'fr-001 fr-002 frases Hi, Ana. Oi, Ana. Tchau! Bye!')).toEqual([]);
  });
});

describe('containsMarker', () => {
  it('matches pair markers in any quote style the minifier uses', () => {
    const code = 'oe=[{id:`fr-001`,en:`Hi, Ana.`,pt:`Oi, Ana.`}]';
    expect(containsMarker(code, 'en:"Hi, Ana."')).toBe(true);
    expect(containsMarker("x={en:'Hi, Ana.'}", 'en:"Hi, Ana."')).toBe(true);
    expect(containsMarker(code, 'pt:"Hi, Ana."')).toBe(false);
    expect(containsMarker('a long plain text marker', 'plain text')).toBe(true);
  });
});

describe('sceneLeaks', () => {
  it('passes code without scenes', () => {
    expect(sceneLeaks('const a="favicon";function b(){return"svg"}')).toEqual([]);
  });

  it('flags inline SVG, data URLs, the art map and hashed scene files', () => {
    expect(
      sceneLeaks(
        'x="<svg viewBox=..."; y="data:image/svg+xml,%3C"; z={"../../content/art/escola.svg":"/assets/escola-AbC123_x.svg"}',
        ['escola', 'casa'],
      ),
    ).toEqual([
      'SVG embutido (<svg) no JS inicial',
      'data:image/svg+xml no JS inicial',
      'mapa de cenas (art.ts) no JS inicial',
      'cena escola-AbC123_x.svg no JS inicial',
    ]);
  });

  it('only matches the hashed files of real scene names', () => {
    const code = '"/assets/icon-settings.svg";"/assets/minha-escola-AbC123_x.svg"';
    expect(sceneLeaks(code, ['escola'])).toEqual([]);
    expect(sceneLeaks('"/assets/escola-AbC123_x.svg"', ['escola'])).toEqual([
      'cena escola-AbC123_x.svg no JS inicial',
    ]);
  });
});

describe('scene files and notebook leaks', () => {
  it('reports scenes with no hashed .svg of their own', () => {
    const files = ['casa-AbCd1234.svg', 'index-x.js'];
    expect(missingSceneFiles(files, ['casa', 'escola'])).toEqual(['escola']);
    // a scene whose name is a prefix of another must not match the longer file
    expect(missingSceneFiles(['casa-grande-AbCd1234.svg'], ['casa'])).toEqual(['casa']);
  });

  it('lists JS/CSS files that inline an SVG data URL', () => {
    expect(
      inlinedSvgFiles([
        { name: 'a.js', code: 'x="data:image/svg+xml;base64,AAA"' },
        { name: 'b.css', code: 'a{b:url(x.svg)}' },
      ]),
    ).toEqual(['a.js']);
  });

  it('flags a Patrick Hand preload and a notebook stylesheet in index.html', () => {
    const css: Record<string, string> = {
      '/assets/index.css': 'body{color:red}',
      '/assets/nb.css': '.nb-tag{color:red}',
    };
    const read = (href: string) => css[href];
    expect(
      notebookInHtml(
        '<link rel="stylesheet" href="/assets/index.css"><link rel="modulepreload" href="/assets/x.js">',
        read,
      ),
    ).toEqual([]);
    expect(
      notebookInHtml(
        '<link rel="preload" as="font" href="/assets/patrick-hand-latin-400.woff2">',
        read,
      ),
    ).toHaveLength(1);
    expect(notebookInHtml('<link rel="stylesheet" href="/assets/nb.css">', read)).toHaveLength(1);
  });
});
