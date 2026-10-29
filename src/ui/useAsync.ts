import { useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: unknown };

/**
 * Runs `load` when `key` changes (and on `retry`). Results of a stale key are ignored,
 * so a slow import never overwrites a newer screen.
 */
export function useAsync<T>(
  key: string,
  load: () => Promise<T>,
): { state: AsyncState<T>; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: AsyncState<T> } | null>(null);
  const token = `${key}#${attempt}`;

  useEffect(() => {
    let alive = true;
    load().then(
      (value) => alive && setResult({ key: token, state: { status: 'ready', value } }),
      (error: unknown) => alive && setResult({ key: token, state: { status: 'error', error } }),
    );
    return () => {
      alive = false;
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps -- `load` is keyed by `key`

  const state: AsyncState<T> = result?.key === token ? result.state : { status: 'loading' };
  return { state, retry: () => setAttempt((n) => n + 1) };
}
