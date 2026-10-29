/** Browser file helpers for the progress backup (download and read). */

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Downloads `data` as pretty-printed JSON through a temporary <a download>. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ReadResult = { ok: true; text: string } | { ok: false; reason: 'tooBig' | 'read' };

/** Reads a chosen file as text, refusing big files without reading them. */
export async function readTextFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, reason: 'tooBig' };
  try {
    return { ok: true, text: await file.text() };
  } catch {
    return { ok: false, reason: 'read' };
  }
}
