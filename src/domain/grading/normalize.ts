/**
 * Answer normalization (docs/ARQUITETURA.md §5). Both the learner's input and every
 * accepted answer go through the same function, so comparisons are like-for-like.
 */

export type Lang = 'en' | 'pt';

// Pronoun/aux contractions expanded to one canonical form. Ambiguous ones ('s, 'd)
// map to the A1-level reading (is / would).
const EN_CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "how's": 'how is',
  "there's": 'there is',
  "here's": 'here is',
  "let's": 'let us',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'can not',
  cannot: 'can not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "couldn't": 'could not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "it'll": 'it will',
  "we'll": 'we will',
  "they'll": 'they will',
  "i'd": 'i would',
  "you'd": 'you would',
  "he'd": 'he would',
  "she'd": 'she would',
  "we'd": 'we would',
  "they'd": 'they would',
  // Apostrophe-less spellings (the apostrophe is hidden on phone keyboards). Only forms that are
  // not themselves English words: its/hes/were/well/ill/id/wont/shell/hell/lets are left alone.
  im: 'i am',
  youre: 'you are',
  theyre: 'they are',
  whats: 'what is',
  thats: 'that is',
  dont: 'do not',
  doesnt: 'does not',
  didnt: 'did not',
  isnt: 'is not',
  arent: 'are not',
  wasnt: 'was not',
  werent: 'were not',
  cant: 'can not',
  wouldnt: 'would not',
  shouldnt: 'should not',
  couldnt: 'could not',
  havent: 'have not',
  hasnt: 'has not',
  hadnt: 'had not',
  ive: 'i have',
  youve: 'you have',
  weve: 'we have',
  theyve: 'they have',
  youll: 'you will',
  theyll: 'they will',
};

const EN_UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

// Accent-free spellings (accents are stripped before number parsing).
const PT_UNITS = [
  'zero',
  'um',
  'dois',
  'tres',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];
const PT_TENS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];
const PT_ALIASES: Record<string, number> = { uma: 1, duas: 2, catorze: 14, cem: 100 };

function numberWords(units: string[], tens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  units.forEach((w, n) => map.set(w, n));
  tens.forEach((w, i) => {
    if (w) map.set(w, i * 10);
  });
  return map;
}

const EN_NUMBERS = numberWords(EN_UNITS, EN_TENS);
EN_NUMBERS.set('hundred', 100);
const PT_NUMBERS = numberWords(PT_UNITS, PT_TENS);
for (const [w, n] of Object.entries(PT_ALIASES)) PT_NUMBERS.set(w, n);

/** Replaces spelled-out numbers 0–100 with digits ("twenty one" / "vinte e um" → "21"). */
function wordsToDigits(words: string[], lang: Lang): string[] {
  const table = lang === 'en' ? EN_NUMBERS : PT_NUMBERS;
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? '';
    let value = table.get(w);
    if (value === undefined) {
      out.push(w);
      continue;
    }
    if (lang === 'en' && w === 'hundred') {
      // "a hundred" / "one hundred" → 100
      const prev = out[out.length - 1];
      if (prev === 'a' || prev === '1') out.pop();
      out.push('100');
      continue;
    }
    // Tens followed by a unit: "twenty one" (EN) or "vinte e um" (PT).
    if (value >= 20 && value % 10 === 0 && value < 100) {
      const next = words[i + 1];
      const afterE = words[i + 2];
      if (lang === 'en' && next !== undefined) {
        const unit = table.get(next);
        if (unit !== undefined && unit > 0 && unit < 10) {
          value += unit;
          i++;
        }
      } else if (lang === 'pt' && next === 'e' && afterE !== undefined) {
        const unit = table.get(afterE);
        if (unit !== undefined && unit > 0 && unit < 10) {
          value += unit;
          i += 2;
        }
      }
    }
    out.push(String(value));
  }
  return out;
}

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '');
}

/** Canonical comparable form of an answer. */
export function normalize(text: string, lang: Lang): string {
  let s = stripAccents(text.normalize('NFC').toLowerCase());
  s = s.replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, ' ');
  s = s.replace(/[-–—:/]/g, ' '); // "twenty-one", "5:30", "e/ou"
  s = s.replace(/[^\p{L}\p{N}'\s]/gu, ' ');

  let words = s.split(/\s+/).filter(Boolean);
  if (lang === 'en') {
    // "lets" is also a verb ("she lets me"); as a sentence opener it is "let's".
    if (words[0] === 'lets') words[0] = "let's";
    words = words.flatMap((w) => (EN_CONTRACTIONS[w] ?? w).split(' '));
  }
  // Remaining apostrophes (possessives, o'clock, quotes) are dropped on both sides.
  words = words.map((w) => w.replace(/'/g, '')).filter(Boolean);
  return wordsToDigits(words, lang).join(' ');
}

/** Words of a normalized string. */
export function words(normalized: string): string[] {
  return normalized ? normalized.split(' ') : [];
}

/** Classic Levenshtein distance, early exit above `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? 0;
}
