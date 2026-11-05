import { artNames, artUrl } from './art';

// Scenes arrive with the prototype port (FASE-2 step 10); until then the map is empty.
describe('art (scene name → URL)', () => {
  it('lists the scenes in src/content/art and resolves only known names', () => {
    const names = artNames();
    expect(names).toEqual([...names].sort());
    for (const name of names) expect(artUrl(name)).toMatch(new RegExp(`${name}.*\\.svg`));
    expect(artUrl('cena-que-nao-existe')).toBeUndefined();
  });
});

describe('art.ts importers', () => {
  it('is imported only by MapScene (a lazy route), never by eager app code', () => {
    const sources = import.meta.glob<string>(['../../**/*.{ts,tsx}', '!../../**/*.test.*'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const importers = Object.entries(sources)
      .filter(([, code]) => /(?:from\s*|import\s*\(?\s*)['"][^'"]*\/art(?:\.ts)?['"]/.test(code))
      .map(([path]) => path);
    expect(importers.map((p) => p.slice(p.lastIndexOf('/') + 1))).toEqual(['MapScene.tsx']);
    expect(Object.keys(sources).length).toBeGreaterThan(100); // the glob really covers src
  });
});
