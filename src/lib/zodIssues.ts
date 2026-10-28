import type { z } from 'zod';

/** Turns a ZodError into short lines with the path, for scripts, logs and user messages. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length ? issue.path.join(' › ') : '(raiz)';
    return `${where}: ${issue.message}`;
  });
}
