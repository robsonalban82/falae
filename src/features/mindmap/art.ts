/**
 * Scene name → hashed asset URL (MAPAS-E-CARTAS §12.3). `?no-inline` keeps every SVG as a
 * separate file (precached by the service worker), so this chunk only holds short strings.
 * Import it only from lazy routes: check-prod-bundle fails if a scene reaches the initial JS.
 */
const urls = import.meta.glob<string>('../../content/art/*.svg', {
  query: '?no-inline',
  import: 'default',
  eager: true,
});

const byName = new Map(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/** URL of a scene (`art`/`centerArt` of a map), or undefined if it does not exist. */
export function artUrl(name: string): string | undefined {
  return byName.get(name);
}

/** Every scene name, sorted. */
export function artNames(): string[] {
  return [...byName.keys()].sort();
}
