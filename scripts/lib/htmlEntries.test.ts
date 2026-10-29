import { describe, expect, it } from 'vitest';
import { initialScripts } from './htmlEntries';

const html = (base: string) => `<head>
<script type="module" crossorigin src="${base}assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="${base}assets/react-1.js">
<link rel="modulepreload" crossorigin href="${base}assets/zod-2.js">
<link rel="stylesheet" href="${base}assets/index.css">
</head>`;

describe('initialScripts', () => {
  it.each(['/', '/falae/', '/a/b/', './'])('base %s', (base) => {
    expect(initialScripts(html(base))).toEqual({
      entry: 'index-abc.js',
      preloads: ['react-1.js', 'zod-2.js'],
    });
  });

  it('no module script → null entry', () => {
    expect(initialScripts('<html></html>')).toEqual({ entry: null, preloads: [] });
  });
});
