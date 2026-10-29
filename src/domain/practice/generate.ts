/**
 * Builds a 12-exercise Practice session from study items (docs/fases/FASE-6.md §2).
 * Deterministic: the only randomness is seededRandom(seed).
 */
import type { Exercise, ExerciseOf } from '../../content/schema';
import { normalize } from '../grading/normalize';
import { expandPattern } from '../grading/patterns';
import { tokenizeForBank } from '../grading/tokenize';
import type { Capabilities } from '../lesson/fallbacks';
import { seededRandom, shuffle } from '../random';
import { PRACTICE_SIZE } from '../srs/selection';

export type PracticeItem = {
  id: string;
  kind: 'vocab' | 'sentence';
  /** May use (x)/[a|b] patterns, as in the content. */
  en: string;
  /** pt[0] is the main translation (sentence: [pt]). */
  pt: string[];
  acceptedPt?: string[] | undefined;
  acceptedEn?: string[] | undefined;
  emoji?: string | undefined;
};

type PlanType =
  'match-pairs' | 'multiple-choice' | 'word-bank' | 'translate-typing' | 'listen-type';

const PLAN: readonly PlanType[] = [
  'match-pairs',
  'multiple-choice',
  'multiple-choice',
  'multiple-choice',
  'word-bank',
  'word-bank',
  'word-bank',
  'translate-typing',
  'translate-typing',
  'translate-typing',
  'listen-type',
  'listen-type',
];
const MAX_USES = 3;
const PAIRS = 4;
const MAX_MC_DISTRACTORS = 3;
const MIN_DISTRACTORS = 2;
const MAX_BANK_DISTRACTORS = 4;

/** First concrete text of a pattern (display form). */
function display(pattern: string): string {
  try {
    return expandPattern(pattern)[0] ?? pattern;
  } catch {
    return pattern;
  }
}

function expansions(patterns: readonly string[]): string[] {
  return patterns.flatMap((p) => {
    try {
      return expandPattern(p);
    } catch {
      return [p];
    }
  });
}

const enForms = (it: PracticeItem) =>
  new Set(expansions([it.en, ...(it.acceptedEn ?? [])]).map((s) => normalize(s, 'en')));
const ptForms = (it: PracticeItem) =>
  new Set(expansions([...it.pt, ...(it.acceptedPt ?? [])]).map((s) => normalize(s, 'pt')));
const hasPattern = (s: string) => s.includes('(') || s.includes('[');
const overlaps = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((x) => b.has(x));

/** Keeps the shuffled order but never puts the same type 3 times in a row (when avoidable). */
function arrange(plan: readonly PlanType[]): PlanType[] {
  const rest = [...plan];
  const out: PlanType[] = [];
  while (rest.length > 0) {
    const n = out.length;
    const blocked = n >= 2 && out[n - 1] === out[n - 2] ? out[n - 1] : undefined;
    // Prefer the most frequent remaining type among the allowed ones, so none piles up at the end.
    const count = (t: PlanType) => rest.filter((r) => r === t).length;
    let best = -1;
    rest.forEach((t, i) => {
      if (t === blocked) return;
      if (best < 0 || count(t) > count(rest[best] as PlanType)) best = i;
    });
    if (best < 0) best = 0;
    out.push(...rest.splice(best, 1));
  }
  return out;
}

export function generatePractice(input: {
  items: readonly PracticeItem[];
  distractorPool: readonly PracticeItem[];
  caps: Capabilities;
  seed: number;
  /** Multiple-choice prompt for a Portuguese meaning (UI copy comes from i18n). */
  choicePrompt: (pt: string) => string;
}): Exercise[] {
  const { items, distractorPool, caps, seed, choicePrompt } = input;
  if (items.length === 0) return [];
  const rand = seededRandom(seed);
  const plan = arrange(shuffle(PLAN, rand));
  const pool = [...new Map([...items, ...distractorPool].map((it) => [it.id, it])).values()];

  const uses = new Map<string, number>();
  const usedTypes = new Map<string, Set<string>>();
  let cursor = 0;

  const suits = (it: PracticeItem, type: PlanType): boolean => {
    if (type === 'word-bank') return it.kind === 'sentence';
    if (type === 'listen-type') return caps.tts && !hasPattern(it.en);
    if (type === 'match-pairs') return it.kind === 'vocab';
    return true;
  };

  /** Next item in round-robin order, relaxing the rules only when nothing else fits. */
  const pickItem = (type: PlanType): PracticeItem => {
    const tiers: ((it: PracticeItem) => boolean)[] = [
      (it) =>
        (uses.get(it.id) ?? 0) < MAX_USES && !usedTypes.get(it.id)?.has(type) && suits(it, type),
      (it) => (uses.get(it.id) ?? 0) < MAX_USES && !usedTypes.get(it.id)?.has(type),
      (it) => (uses.get(it.id) ?? 0) < MAX_USES,
      () => true,
    ];
    for (const ok of tiers) {
      for (let k = 0; k < items.length; k++) {
        const idx = (cursor + k) % items.length;
        const it = items[idx];
        if (it && ok(it)) {
          cursor = idx + 1;
          return it;
        }
      }
    }
    return items[0] as PracticeItem; // unreachable: the last tier accepts anything
  };

  const translate = (it: PracticeItem, id: string): ExerciseOf<'translate-typing'> => ({
    id,
    type: 'translate-typing',
    itemIds: [it.id],
    promptEn: display(it.en),
    accepted: [...it.pt, ...(it.acceptedPt ?? [])],
  });

  const choice = (it: PracticeItem, id: string): Exercise => {
    const answer = display(it.en);
    const wantEn = enForms(it);
    const wantPt = ptForms(it);
    const seen = new Set([normalize(answer, 'en')]);
    const candidates = shuffle(
      pool.filter((p) => p.id !== it.id && p.kind === it.kind),
      rand,
    );
    const distractors: PracticeItem[] = [];
    for (const c of candidates) {
      if (distractors.length >= MAX_MC_DISTRACTORS) break;
      const text = normalize(display(c.en), 'en');
      // A distractor that is also a right answer (or means the same) would be unfair.
      if (seen.has(text) || wantEn.has(text) || overlaps(ptForms(c), wantPt)) continue;
      seen.add(text);
      distractors.push(c);
    }
    if (distractors.length < MIN_DISTRACTORS) return translate(it, id);
    const withEmoji = it.emoji !== undefined && distractors.every((d) => d.emoji !== undefined);
    const option = (p: PracticeItem) => ({
      text: display(p.en),
      ...(withEmoji && p.emoji ? { emoji: p.emoji } : {}),
    });
    return {
      id,
      type: 'multiple-choice',
      itemIds: [it.id],
      prompt: choicePrompt(it.pt[0] ?? ''),
      options: shuffle([option(it), ...distractors.map(option)], rand),
      answer,
    };
  };

  const bank = (it: PracticeItem, id: string): Exercise => {
    if (it.kind !== 'sentence') return translate(it, id);
    const answer = display(it.en);
    const tiles = new Set(tokenizeForBank(answer).map((w) => w.toLowerCase()));
    const words = new Map<string, string>();
    for (const other of shuffle(
      pool.filter((p) => p.kind === 'sentence' && p.id !== it.id),
      rand,
    )) {
      for (const w of tokenizeForBank(display(other.en))) {
        const key = w.toLowerCase();
        if (!tiles.has(key) && !words.has(key)) words.set(key, w);
      }
    }
    const distractors = shuffle([...words.values()], rand).slice(0, MAX_BANK_DISTRACTORS);
    if (distractors.length < MIN_DISTRACTORS) return translate(it, id);
    return {
      id,
      type: 'word-bank',
      itemIds: [it.id],
      promptPt: it.pt[0] ?? '',
      answer,
      ...(it.acceptedEn?.length || hasPattern(it.en)
        ? { accepted: [it.en, ...(it.acceptedEn ?? [])] }
        : {}),
      distractors,
    };
  };

  const pairs = (it: PracticeItem, id: string): Exercise => {
    const chosen: PracticeItem[] = [];
    const ens = new Set<string>();
    const pts = new Set<string>();
    const add = (p: PracticeItem) => {
      if (p.kind !== 'vocab' || chosen.length >= PAIRS) return;
      const en = display(p.en).toLowerCase();
      const pt = (p.pt[0] ?? '').toLowerCase();
      if (!pt || ens.has(en) || pts.has(pt)) return;
      ens.add(en);
      pts.add(pt);
      chosen.push(p);
    };
    add(it);
    for (const p of items) add(p);
    for (const p of shuffle(pool, rand)) add(p);
    if (chosen.length < PAIRS || !chosen.includes(it)) return choice(it, id);
    return {
      id,
      type: 'match-pairs',
      itemIds: chosen.map((p) => p.id),
      pairs: chosen.map((p) => ({ en: display(p.en), pt: p.pt[0] ?? '' })),
    };
  };

  const listen = (it: PracticeItem, id: string): Exercise => {
    if (!caps.tts || hasPattern(it.en)) return translate(it, id);
    return { id, type: 'listen-type', itemIds: [it.id], textEn: it.en };
  };

  return plan.slice(0, PRACTICE_SIZE).map((type, pos) => {
    const it = pickItem(type);
    uses.set(it.id, (uses.get(it.id) ?? 0) + 1);
    const types = usedTypes.get(it.id) ?? new Set<string>();
    types.add(type);
    usedTypes.set(it.id, types);
    const id = `practice-${seed}-${pos}`;
    switch (type) {
      case 'match-pairs':
        return pairs(it, id);
      case 'multiple-choice':
        return choice(it, id);
      case 'word-bank':
        return bank(it, id);
      case 'listen-type':
        return listen(it, id);
      case 'translate-typing':
        return translate(it, id);
    }
  });
}
