import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LessonSummary } from '../../domain/lesson/engine';
import {
  initialRevealState,
  isComplete,
  mapStudyLessonId,
  mapStudySummary,
  rate as rateChunk,
  reveal as revealChunk,
  toggleReveal,
  type HideableChunk,
  type RevealRating,
  type RevealState,
} from '../../domain/mindmap/reveal';
import { repository } from '../../data';
import { clock } from '../../services/clock';
import { useProfile, type CommitSummary } from '../../stores/useProfile';
import { useSettings } from '../../stores/useSettings';

export type StudySave =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; commit: CommitSummary }
  | { status: 'error'; retry: () => void };

export type MapStudy = {
  state: RevealState;
  total: number;
  complete: boolean;
  /** Everything is revealed but the last chunk (an item) still waits for its optional rating. */
  pendingRating: boolean;
  /** Ratings can no longer change: the commit was sent. */
  locked: boolean;
  save: StudySave;
  toggle: () => void;
  reveal: (key: string) => void;
  rate: (key: string, rating: RevealRating) => void;
  /** Finish without rating the last chunk. */
  finish: () => void;
};

/**
 * A retry whose first write actually landed comes back as a duplicate with `xp: 0`. Show the XP
 * that was really given by reading the stored result (UI only; nothing is written).
 */
async function withStoredXp(commit: CommitSummary, retried: boolean): Promise<CommitSummary> {
  if (!retried || commit.result.xp > 0) return commit;
  try {
    const stored = (await repository.getRecentResults(20)).find((r) => r.id === commit.result.id);
    return stored && stored.xp > 0
      ? { ...commit, result: { ...commit.result, xp: stored.xp } }
      : commit;
  } catch {
    return commit;
  }
}

type Outcome = { run: string } & ({ ok: true; commit: CommitSummary } | { ok: false });

/**
 * "Hide the English" study of one map. Opening or reading writes nothing (ADR-019 a); only
 * revealing every chunk commits one `map` session with a deterministic id, so a retry or a
 * reload mid-save never counts twice.
 */
export function useMapStudy(mapId: string, chunks: readonly HideableChunk[]): MapStudy {
  const commitSession = useProfile((s) => s.commitSession);
  const dailyGoalXp = useSettings((s) => s.settings.dailyGoalXp);
  const [state, setState] = useState<RevealState>(initialRevealState);
  const [startedAt, setStartedAt] = useState(0);
  const [skipRating, setSkipRating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const summary = useRef<LessonSummary | null>(null);
  const sent = useRef<string | null>(null);
  const lastStart = useRef(0);

  const complete = isComplete(state, chunks);
  const last = chunks.find((c) => c.key === state.revealed.at(-1));
  const pendingRating =
    complete && !skipRating && last?.itemId !== undefined && !state.ratings[last.key];
  const ready = complete && !pendingRating;
  const run = `${startedAt}:${attempt}`;

  useEffect(() => {
    // Guard: StrictMode re-runs effects; one write per attempt.
    if (!ready || sent.current === run) return;
    sent.current = run;
    // Frozen at the finish line: a retry sends the same summary.
    summary.current ??= mapStudySummary(state, chunks, startedAt, clock.now());
    commitSession(
      {
        lessonId: mapStudyLessonId(mapId),
        kind: 'map',
        context: { mapId },
        startedAt,
        summary: summary.current,
      },
      dailyGoalXp,
    )
      .then((commit) => withStoredXp(commit, attempt > 0))
      .then(
        (commit) => setOutcome({ run, ok: true, commit }),
        (err: unknown) => {
          console.error('[falae] Could not save map study', err);
          setOutcome({ run, ok: false });
        },
      );
  }, [ready, run]); // eslint-disable-line react-hooks/exhaustive-deps -- commit once per attempt

  const reveal = useCallback(
    (key: string) => setState((s) => revealChunk(s, key, chunks)),
    [chunks],
  );
  const rate = useCallback(
    (key: string, rating: RevealRating) => {
      if (!ready) setState((s) => rateChunk(s, key, rating, chunks));
    },
    [ready, chunks],
  );
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const save = useMemo<StudySave>(() => {
    if (!ready) return { status: 'idle' };
    // A result of an older run (mode turned off and on meanwhile) is ignored.
    if (!outcome || outcome.run !== run) return { status: 'saving' };
    return outcome.ok ? { status: 'saved', commit: outcome.commit } : { status: 'error', retry };
  }, [ready, outcome, run, retry]);

  return {
    state,
    total: chunks.length,
    complete,
    pendingRating,
    locked: ready,
    save,
    toggle: () => {
      // Turning the mode off drops the run; turning it on starts a new one.
      setState((s) => toggleReveal(s));
      if (!state.on) {
        // Strictly increasing, so two runs never share a result id (frozen clocks in tests).
        lastStart.current = Math.max(clock.now(), lastStart.current + 1);
        setStartedAt(lastStart.current);
      }
      setSkipRating(false);
      setAttempt(0);
      setOutcome(null);
      summary.current = null;
    },
    reveal,
    rate,
    finish: () => setSkipRating(true),
  };
}
