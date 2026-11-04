/**
 * Compact answer patterns used in content:
 *   (x)    optional        "(Eu) sou Ana"     -> "Eu sou Ana", "sou Ana"
 *   [a|b]  alternatives    "[I'm|I am] tired" -> "I'm tired", "I am tired"
 * Groups may be nested. Whitespace is collapsed after expansion.
 */

export const MAX_PATTERN_EXPANSIONS = 64;

export class PatternError extends Error {}

type Parser = { src: string; pos: number; limit: number };

function cross(a: string[], b: string[], limit: number): string[] {
  const out: string[] = [];
  for (const x of a) {
    for (const y of b) {
      out.push(x + y);
      if (out.length > limit) {
        throw new PatternError(`O padrão gera mais de ${limit} respostas.`);
      }
    }
  }
  return out;
}

function parseSequence(p: Parser, terminators: string): string[] {
  let acc = [''];
  let text = '';
  const flush = () => {
    if (text) {
      acc = acc.map((s) => s + text);
      text = '';
    }
  };
  while (p.pos < p.src.length) {
    const ch = p.src.charAt(p.pos);
    if (terminators.includes(ch)) break;
    if (ch === '(') {
      flush();
      p.pos++;
      const inner = parseSequence(p, ')');
      expect(p, ')');
      acc = cross(acc, [...inner, ''], p.limit);
    } else if (ch === '[') {
      flush();
      p.pos++;
      const options: string[] = [];
      for (;;) {
        options.push(...parseSequence(p, '|]'));
        if (p.src[p.pos] === '|') {
          p.pos++;
          continue;
        }
        expect(p, ']');
        break;
      }
      acc = cross(acc, options, p.limit);
    } else if (ch === ')' || ch === ']' || ch === '|') {
      throw new PatternError(`Caractere "${ch}" inesperado na posição ${p.pos + 1}.`);
    } else {
      text += ch;
      p.pos++;
    }
  }
  flush();
  return acc;
}

function expect(p: Parser, ch: string): void {
  if (p.src[p.pos] !== ch) {
    throw new PatternError(`Faltou fechar com "${ch}" no padrão "${p.src}".`);
  }
  p.pos++;
}

export function expandPattern(pattern: string, limit = MAX_PATTERN_EXPANSIONS): string[] {
  const p: Parser = { src: pattern, pos: 0, limit };
  const result = parseSequence(p, '');
  if (p.pos !== pattern.length) {
    throw new PatternError(`Padrão inválido: "${pattern}".`);
  }
  const cleaned = result
    .map((s) =>
      s
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .trim(),
    )
    .filter((s) => s.length > 0);
  return [...new Set(cleaned)];
}

export function expandPatterns(
  patterns: readonly string[],
  limit = MAX_PATTERN_EXPANSIONS,
): string[] {
  return [...new Set(patterns.flatMap((p) => expandPattern(p, limit)))];
}

/** First concrete text of a pattern (display form); a malformed pattern is returned as is. */
export function displayPattern(pattern: string): string {
  try {
    return expandPattern(pattern)[0] ?? pattern;
  } catch {
    return pattern;
  }
}
