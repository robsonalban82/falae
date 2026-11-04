import { joinSenses, type MapItemShape } from '../items';
import { displayPattern } from '../grading/patterns';
import { parseBold, stripBold, type RichSegment } from './richText';

/** Structural input types: the `MindMap` inferred from Zod is assignable to these. */
export type MapLineShape =
  | { ref: string; hint?: string }
  | { en: string; pt?: string }
  | { wrong: string; right: string; note?: string }
  | { note: string };

export type MapTagShape = string;

export type { MapItemShape };
export type ItemLookup = (itemId: string) => MapItemShape | undefined;

export type LineView =
  | { kind: 'item'; itemId: string; en: string; pt: string; hint?: string; strong: boolean }
  | { kind: 'text'; en: RichSegment[]; speakText: string; pt?: string }
  | { kind: 'fix'; wrong: string; right: string; note?: string }
  | { kind: 'note'; text: string };

/** Vocabulary cards show the English in bold (MAPAS-E-CARTAS §2.5). */
export const STRONG_TAG = 'vocabulario';

/** Display model of one line; a `ref` missing from the lookup gives null (the screen skips it). */
export function lineView(
  line: MapLineShape,
  tag: MapTagShape,
  lookup: ItemLookup,
): LineView | null {
  if ('ref' in line) {
    const item = lookup(line.ref);
    if (!item) return null;
    return {
      kind: 'item',
      itemId: item.id,
      en: displayPattern(item.en),
      pt: joinSenses(item.pt),
      ...(line.hint !== undefined ? { hint: line.hint } : {}),
      strong: tag === STRONG_TAG,
    };
  }
  if ('wrong' in line) {
    return {
      kind: 'fix',
      wrong: line.wrong,
      right: line.right,
      ...(line.note !== undefined ? { note: line.note } : {}),
    };
  }
  if ('en' in line) {
    return {
      kind: 'text',
      en: parseBold(line.en).segments,
      speakText: stripBold(line.en),
      ...(line.pt !== undefined ? { pt: line.pt } : {}),
    };
  }
  return { kind: 'note', text: line.note };
}
