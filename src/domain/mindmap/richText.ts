/** A run of map text; `bold` comes from a `**…**` pair. */
export type RichSegment = { text: string; bold: boolean };

export type ParsedRichText = {
  segments: RichSegment[];
  /**
   * False when a `**` has no pair, or a bold run is empty, starts/ends with a space or with
   * a stray `*` (as in `***x***` or `a ** b ** c`). Stray markers stay as plain text.
   */
  balanced: boolean;
};

const MARK = '**';

/**
 * Splits map text on `**bold**` pairs (no nesting, no other markup).
 * Unbalanced input still renders: the unpaired `**` is kept as literal text.
 */
export function parseBold(text: string): ParsedRichText {
  const parts = text.split(MARK);
  const pairs = Math.floor((parts.length - 1) / 2);
  const segments: RichSegment[] = [];
  let balanced = (parts.length - 1) % 2 === 0;

  const push = (value: string, bold: boolean) => {
    if (!value) return;
    const last = segments.at(-1);
    if (last && last.bold === bold) last.text += value;
    else segments.push({ text: value, bold });
  };

  parts.forEach((part, i) => {
    const bold = i % 2 === 1 && i <= pairs * 2;
    if (bold && !/^[^\s*](?:.*[^\s*])?$/su.test(part)) balanced = false;
    if (i > pairs * 2)
      push(MARK + part, false); // the unpaired marker and what follows
    else push(part, bold);
  });
  return { segments, balanced };
}

/** Plain text without the bold markers (for search and comparisons). */
export function stripBold(text: string): string {
  return parseBold(text)
    .segments.map((s) => s.text)
    .join('');
}
