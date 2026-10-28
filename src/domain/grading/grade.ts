import type { Exercise } from '../../content/schema';
import { BLANK } from './blank';
import { levenshtein, normalize, words, type Lang } from './normalize';
import { expandPatterns } from './patterns';

export type ExerciseResponse =
  | { kind: 'text'; value: string } // word-bank (joined tiles), translate-typing, listen-type
  | { kind: 'choice'; value: string } // multiple-choice, fill-blank
  | { kind: 'speech'; transcripts: string[] }
  | { kind: 'pairs'; mistakes: number };

export type Verdict = 'correct' | 'almost' | 'wrong';
export type GradeNote = 'typo';
export type GradeResult = { verdict: Verdict; correctAnswer: string; note?: GradeNote };

export type GradeContext = {
  /** Normalized words that appear anywhere in the course (both languages). */
  knownWords: ReadonlySet<string>;
};

export const SPEECH_THRESHOLD = 0.8;
const MIN_TYPO_WORD_LENGTH = 5;

type Accepted = { lang: Lang; displays: string[]; byNormalized: Map<string, string> };
const cache = new WeakMap<Exercise, Accepted>();

/** Accepted answers for free-text exercises, expanded and normalized once per exercise. */
export function acceptedFor(exercise: Exercise): Accepted | null {
  const cached = cache.get(exercise);
  if (cached) return cached;
  let lang: Lang;
  let patterns: string[];
  switch (exercise.type) {
    case 'word-bank':
      lang = 'en';
      patterns = [exercise.answer, ...(exercise.accepted ?? [])];
      break;
    case 'translate-typing':
      lang = 'pt';
      patterns = exercise.accepted;
      break;
    case 'listen-type':
      lang = 'en';
      patterns = [exercise.textEn, ...(exercise.accepted ?? [])];
      break;
    case 'speak':
      lang = 'en';
      patterns = [exercise.textEn];
      break;
    default:
      return null;
  }
  const displays = expandPatterns(patterns);
  const byNormalized = new Map<string, string>();
  for (const d of displays) {
    const n = normalize(d, lang);
    if (!byNormalized.has(n)) byNormalized.set(n, d);
  }
  const result = { lang, displays, byNormalized };
  cache.set(exercise, result);
  return result;
}

/** The answer shown to the learner after a mistake. */
export function correctAnswerOf(exercise: Exercise): string {
  switch (exercise.type) {
    case 'multiple-choice':
      return exercise.answer;
    case 'fill-blank':
      return exercise.sentence.replace(BLANK, exercise.answer);
    case 'match-pairs':
      return exercise.pairs.map((p) => `${p.en} = ${p.pt}`).join(' · ');
    default:
      return acceptedFor(exercise)?.displays[0] ?? '';
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function gradeExercise(
  exercise: Exercise,
  response: ExerciseResponse,
  ctx: GradeContext,
): GradeResult {
  const correctAnswer = correctAnswerOf(exercise);
  const wrong: GradeResult = { verdict: 'wrong', correctAnswer };

  switch (exercise.type) {
    case 'multiple-choice':
    case 'fill-blank':
      if (response.kind !== 'choice') return wrong;
      return same(response.value, exercise.answer) ? { verdict: 'correct', correctAnswer } : wrong;

    case 'match-pairs':
      // The board only completes when every pair is matched; wrong taps are feedback, not failure.
      return response.kind === 'pairs' ? { verdict: 'correct', correctAnswer } : wrong;

    case 'speak':
      if (response.kind !== 'speech') return wrong;
      return gradeSpeech(exercise.textEn, response.transcripts)
        ? { verdict: 'correct', correctAnswer }
        : wrong;

    case 'word-bank':
    case 'translate-typing':
    case 'listen-type': {
      if (response.kind !== 'text') return wrong;
      const accepted = acceptedFor(exercise);
      if (!accepted) return wrong;
      const input = normalize(response.value, accepted.lang);
      if (!input) return wrong;
      const exact = accepted.byNormalized.get(input) ?? matchWithoutApostrophe(input, accepted);
      if (exact !== undefined) return { verdict: 'correct', correctAnswer: exact };
      // Tiles can't have typos, so "almost" only applies to typed answers.
      if (exercise.type !== 'word-bank') {
        const near = findTypoMatch(input, accepted.byNormalized, ctx.knownWords);
        if (near !== null) return { verdict: 'almost', correctAnswer: near, note: 'typo' };
      }
      return wrong;
    }
  }
}

/**
 * "its" is a real word, so it is not expanded during normalization. But on phones
 * "its seven o'clock" almost always means "it's": accept it when that makes an exact match.
 */
function matchWithoutApostrophe(input: string, accepted: Accepted): string | undefined {
  if (accepted.lang !== 'en' || !words(input).includes('its')) return undefined;
  const expanded = words(input)
    .flatMap((w) => (w === 'its' ? ['it', 'is'] : [w]))
    .join(' ');
  return accepted.byNormalized.get(expanded);
}

/**
 * One mistyped word (Levenshtein ≤ 1) in a word of ≥ 5 letters is forgiven, unless the
 * typed word is itself a real word of the course (then/than, quite/quiet).
 */
function findTypoMatch(
  input: string,
  accepted: Map<string, string>,
  knownWords: ReadonlySet<string>,
): string | null {
  const got = words(input);
  for (const [normalized, display] of accepted) {
    const want = words(normalized);
    if (want.length !== got.length) continue;
    let diffIndex = -1;
    let diffs = 0;
    for (let i = 0; i < want.length && diffs <= 1; i++) {
      if (want[i] !== got[i]) {
        diffs++;
        diffIndex = i;
      }
    }
    if (diffs !== 1) continue;
    const target = want[diffIndex] ?? '';
    const typed = got[diffIndex] ?? '';
    if (target.length < MIN_TYPO_WORD_LENGTH) continue;
    if (knownWords.has(typed)) continue;
    if (levenshtein(typed, target, 1) <= 1) return display;
  }
  return null;
}

/** Longest common subsequence length of two word lists. */
function lcs(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const row = dp[i] ?? [];
      const prevRow = dp[i - 1] ?? [];
      row[j] =
        a[i - 1] === b[j - 1]
          ? (prevRow[j - 1] ?? 0) + 1
          : Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0);
    }
  }
  return dp[a.length]?.[b.length] ?? 0;
}

/** Speech passes when ≥ 80% of the target words appear in order in any recognizer alternative. */
export function gradeSpeech(target: string, transcripts: readonly string[]): boolean {
  const want = words(normalize(target, 'en'));
  if (want.length === 0) return false;
  return transcripts.some(
    (t) => lcs(want, words(normalize(t, 'en'))) / want.length >= SPEECH_THRESHOLD,
  );
}

/** Builds the known-word set used to block false "almost" matches. */
export function collectKnownWords(texts: Iterable<{ text: string; lang: Lang }>): Set<string> {
  const set = new Set<string>();
  for (const { text, lang } of texts) {
    for (const w of words(normalize(text, lang))) set.add(w);
  }
  return set;
}
