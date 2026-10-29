/**
 * Initial JS of a built index.html: the module entry and its modulepreloads, as file names
 * inside assets/. Works with any base path ('/', '/falae/', './').
 */
export function initialScripts(html: string): { entry: string | null; preloads: string[] } {
  const asset = (href: string) => /(?:^|\/)assets\/([^"/?#]+\.js)$/.exec(href)?.[1] ?? null;
  const entryHref = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
  const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)]
    .map((m) => asset(m[1] ?? ''))
    .filter((f): f is string => f !== null);
  return { entry: entryHref ? asset(entryHref) : null, preloads };
}
