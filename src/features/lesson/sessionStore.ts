import { z } from 'zod';
import { exerciseSchema } from '../../content/schema';
import type { LessonState } from '../../domain/lesson/engine';

/**
 * Keeps the lesson in progress across reloads (sessionStorage: per tab, cleared on close).
 * Versioned and fully validated: a stale or corrupt session is discarded, never rendered.
 */
const KEY = 'falae-lesson-session';
const SESSION_VERSION = 1;

const index = z.number().int().nonnegative();
const stateSchema = z.object({
  lessonId: z.string(),
  kind: z.enum(['lesson', 'review', 'practice', 'placement']),
  exercises: z.array(exerciseSchema).min(1),
  queue: z.array(index),
  retried: z.array(index),
  status: z.enum(['answering', 'feedback', 'finished', 'outOfHearts']),
  turn: index,
  lastGrade: z
    .object({
      verdict: z.enum(['correct', 'almost', 'wrong']),
      correctAnswer: z.string(),
      note: z.literal('typo').optional(),
    })
    .nullable(),
  solved: z.array(index),
  missed: z.array(index),
  skipped: z.array(index),
  combo: index,
  comboBonus: index,
  mistakes: index,
  usesHearts: z.boolean(),
  feedback: z.boolean().optional(),
  hearts: index,
  startedAt: z.number(),
  itemStats: z.record(
    z.string(),
    z.object({ wrong: index, almost: z.boolean(), finallyCorrect: z.boolean() }),
  ),
});

/**
 * Hearts count expected once the in-flight heart writes land (null = nothing pending).
 * Stored with the session so a reload right after a mistake re-applies a lost write.
 */
let heartsPending: { lessonId: string; target: number } | null = null;

function write(state: LessonState): void {
  try {
    const pending = heartsPending?.lessonId === state.lessonId ? heartsPending.target : undefined;
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ v: SESSION_VERSION, state, heartsSpentPending: pending }),
    );
  } catch {
    // storage full/unavailable: the lesson just won't survive a reload
  }
}

let lastState: LessonState | null = null;

/** Finished lessons are kept until the result is saved (see clearSession after commit). */
export function saveSession(state: LessonState): void {
  lastState = state;
  write(state);
}

/** Records (synchronously) that a heart write is in flight; `target` = hearts after it lands. */
export function markHeartsPending(lessonId: string, target: number): void {
  heartsPending = { lessonId, target };
  if (lastState?.lessonId === lessonId) write(lastState);
}

/** All heart writes landed. */
export function clearHeartsPending(): void {
  heartsPending = null;
  if (lastState) write(lastState);
}

/** Pending hearts target saved with `lessonId`'s session (read-only; the next save drops it). */
export function readHeartsPending(lessonId: string): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = z
      .object({ state: z.object({ lessonId: z.string() }), heartsSpentPending: index.optional() })
      .safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.state.lessonId !== lessonId) return null;
    return parsed.data.heartsSpentPending ?? null;
  } catch {
    return null;
  }
}

export function loadSession(lessonId: string): LessonState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = z
      .object({
        v: z.literal(SESSION_VERSION),
        state: stateSchema,
        heartsSpentPending: index.optional(),
      })
      .safeParse(JSON.parse(raw));
    if (!parsed.success) {
      clearSession();
      return null;
    }
    const state = parsed.data.state;
    const inRange = (i: number) => i < state.exercises.length;
    const indexesOk = [state.queue, state.retried, state.solved, state.missed, state.skipped].every(
      (list) => list.every(inRange),
    );
    if (state.lessonId !== lessonId || !indexesOk) return null;
    if (state.status === 'outOfHearts') return null;
    if (state.status !== 'finished' && state.queue.length === 0) return null;
    return state;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  lastState = null;
  heartsPending = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Drops the saved session if it belongs to `lessonId` (e.g. the lesson became locked). */
export function discardSession(lessonId: string): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const owner = z.object({ state: z.object({ lessonId: z.string() }) }).safeParse(parsed);
    if (!owner.success || owner.data.state.lessonId === lessonId) clearSession();
  } catch {
    clearSession();
  }
}
