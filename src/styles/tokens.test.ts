/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** Checks WCAG AA contrast for the token pairs actually used together in the UI. */

function block(selector: string): Record<string, string> {
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g');
  const vars: Record<string, string> = {};
  for (const m of css.matchAll(re)) {
    for (const [, name, value] of (m[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
      vars[name!] = value!;
    }
  }
  return vars;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(':root');
const dark = { ...light, ...block('.dark') };

// [foreground, background, minimum ratio, where it is used]
// 4.5 = normal text · 3 = large text (≥24px or bold ≥19px) and graphical objects.
const pairs: [string, string, number, string][] = [
  ['ink', 'bg', 4.5, 'body text'],
  ['ink', 'surface', 4.5, 'text on cards'],
  ['ink', 'surface-2', 4.5, 'text on tinted chips'],
  ['ink-muted', 'bg', 4.5, 'secondary text'],
  ['ink-muted', 'surface', 4.5, 'captions on cards'],
  ['ink-muted', 'surface-2', 4.5, 'disabled button label'],
  ['on-primary', 'primary', 4.5, 'primary button'],
  ['on-secondary', 'secondary', 4.5, 'secondary button, selected theme radio'],
  ['on-success', 'success', 4.5, 'success button'],
  ['on-danger', 'danger', 4.5, 'danger button'],
  ['on-xp', 'xp', 4.5, 'XP chip'],
  ['success', 'success-soft', 4.5, 'correct feedback banner'],
  ['danger', 'danger-soft', 4.5, 'wrong feedback banner'],
  ['secondary', 'bg', 4.5, 'links'],
  ['secondary', 'surface', 4.5, 'active nav item'],
  ['secondary', 'surface-2', 4.5, 'active nav item on its pill'],
  ['primary-shade', 'surface', 3, 'logo in side nav (large text)'],
  ['progress-fill', 'progress-track', 3, 'progress bar'],
  ['line-strong', 'bg', 3, 'ghost button / radio borders'],
  ['line-strong', 'surface', 3, 'ghost button / radio borders on cards'],
  ['tuca-body', 'surface', 3, 'mascot on cards'],
  ['tuca-body', 'bg', 3, 'mascot on page'],
  ['focus', 'bg', 3, 'focus ring'],
  ['focus', 'surface', 3, 'focus ring on cards'],
  ['focus', 'surface-2', 3, 'focus ring on active nav pill'],
];

describe.each([
  ['claro', light],
  ['escuro', dark],
])('contraste AA — tema %s', (_name, theme) => {
  it.each(pairs)('%s sobre %s', (fg, bg, min, _usage) => {
    const a = theme[fg];
    const b = theme[bg];
    expect(a, `token --${fg}`).toBeDefined();
    expect(b, `token --${bg}`).toBeDefined();
    expect(contrast(a!, b!)).toBeGreaterThanOrEqual(min);
  });
});
