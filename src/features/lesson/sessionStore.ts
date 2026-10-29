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

/** Finished lessons are kept until the result is saved (see clearSession after commit). */
export function saveSession(state: LessonState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: SESSION_VERSION, state }));
  } catch {
    // storage full/unavailable: the lesson just won't survive a reload
  }
}

export function loadSession(lessonId: string): LessonState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = z
      .object({ v: z.literal(SESSION_VERSION), state: stateSchema })
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
