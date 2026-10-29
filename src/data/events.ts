/** Notifies stores when all data was replaced (import/reset) so they reload. */
const listeners = new Set<() => void>();

export function onDataReplaced(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataReplaced(): void {
  listeners.forEach((l) => l());
}
