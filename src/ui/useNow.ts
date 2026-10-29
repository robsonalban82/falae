import { useEffect, useState } from 'react';
import { clock } from '../services/clock';

/** Current time from `clock`, re-read every `intervalMs` (for live countdowns). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
