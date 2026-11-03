/** Notifies stores when all data was replaced (import/reset) so they reload. */
const listeners = new Set<() => void>();

export function onDataReplaced(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataReplaced(): void {
  listeners.forEach((l) => l());
}

/**
 * Why the DB needs attention:
 * - updated: another tab changed the schema (connection closed; reload to continue);
 * - deleted: the database was deleted elsewhere (connection closed; reload);
 * - blocked: this tab wants to upgrade but another tab holds the old version open (nothing
 *   is closed; it clears by itself once the other tabs are closed).
 */
export type DbNotice = 'updated' | 'deleted' | 'blocked';

let dbNotice: DbNotice | null = null;
const noticeListeners = new Set<() => void>();

export function onDbOutdated(listener: () => void): () => void {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}

export function emitDbOutdated(reason: DbNotice = 'updated'): void {
  dbNotice = reason;
  noticeListeners.forEach((l) => l());
}

/** The blocker went away and the database opened: drop a "blocked" notice only. */
export function clearDbBlocked(): void {
  if (dbNotice !== 'blocked') return;
  dbNotice = null;
  noticeListeners.forEach((l) => l());
}

export function getDbNotice(): DbNotice | null {
  return dbNotice;
}

/** Whether any notice is active (kept for tests; the UI reads `getDbNotice`). */
export function isDbOutdated(): boolean {
  return dbNotice !== null;
}

/** Test helper. */
export function resetDbOutdated(): void {
  dbNotice = null;
}
