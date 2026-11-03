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
