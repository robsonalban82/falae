import { z } from 'zod';

/** A path read by an object-level check; `'*'` matches any array index. */
export type ReadPath = readonly (string | number)[];

type Issue = { code?: string; path?: readonly PropertyKey[] };

/**
 * Issues that leave a value malformed (wrong type, unknown enum value, no union option).
 * Other issues (length, format, custom refinements, unknown keys) keep a well-typed value.
 */
const MALFORMED = new Set([
  'invalid_type',
  'invalid_union',
  'invalid_value',
  'invalid_key',
  'invalid_element',
]);

const covers = (issuePath: readonly PropertyKey[], read: ReadPath) =>
  issuePath.length <= read.length &&
  issuePath.every((key, i) => read[i] === '*' || read[i] === key);

/** True when a value at one of `reads` (or one of its parents) is malformed. */
export function malformedAt(issues: readonly Issue[], ...reads: readonly ReadPath[]): boolean {
  return issues.some(
    (issue) =>
      MALFORMED.has(issue.code ?? '') && reads.some((read) => covers(issue.path ?? [], read)),
  );
}

/**
 * `when` option for object-level refinements (Zod 4 skips them after any error by default).
 * The check runs even if other fields failed, so authors see every problem at once, and is
 * skipped only when a value it reads (or one of its parents) is malformed.
 */
export function whenParsed(...reads: readonly ReadPath[]) {
  return (payload: z.core.ParsePayload) => !malformedAt(payload.issues, ...reads);
}

/**
 * Array with a size range checked as a refinement. Zod's own `.max()`/`.length()` stop
 * parsing an oversized array, which would hide the other errors of the same list
 * (e.g. "61 cards" and "repeated card"); content files are small, so we parse them whole.
 */
export function sizedArray<T extends z.ZodType>(
  element: T,
  { min = 0, max = Infinity, message }: { min?: number; max?: number; message: string },
) {
  return z.array(element).superRefine(
    (list, ctx) => {
      if (list.length < min || list.length > max) ctx.addIssue({ code: 'custom', message });
    },
    { when: whenParsed([]) },
  );
}

/** Reports repeated keys at `[index, ...field]`; skips entries whose key is malformed. */
export function uniqueBy<T>(
  key: (item: T) => string | number,
  message: (value: string | number) => string,
  field: readonly (string | number)[] = [],
) {
  return {
    check: (list: readonly T[], ctx: z.RefinementCtx) => {
      const seen = new Set<string | number>();
      list.forEach((item, i) => {
        if (malformedAt(ctx.issues, [i, ...field])) return;
        const value = key(item);
        if (seen.has(value)) {
          ctx.addIssue({ code: 'custom', path: [i, ...field], message: message(value) });
        }
        seen.add(value);
      });
    },
    // the list itself must be an array; each element is checked on its own
    options: { when: whenParsed([]) },
  };
}
