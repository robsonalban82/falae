/** Notifies stores when all data was replaced (import/reset) so they reload. */
const listeners = new Set<() => void>();

export function onDataReplaced(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataReplaced(): void {
  listeners.forEach((l) => l());
}

/** The DB connection was closed because another tab changed (or is blocked on) the schema. */
let dbOutdated = false;
const outdatedListeners = new Set<() => void>();

export function onDbOutdated(listener: () => void): () => void {
  outdatedListeners.add(listener);
  return () => outdatedListeners.delete(listener);
}

export function emitDbOutdated(): void {
  dbOutdated = true;
  outdatedListeners.forEach((l) => l());
}

export function isDbOutdated(): boolean {
  return dbOutdated;
}

/** Test helper. */
export function resetDbOutdated(): void {
  dbOutdated = false;
}
