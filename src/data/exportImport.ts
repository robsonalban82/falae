import { formatIssues } from '../lib/zodIssues';
import { EXPORT_SCHEMA_VERSION, exportFileSchema, type ExportFile } from './models';

export type ParseImportResult =
  | { ok: true; file: ExportFile; summary: { totalXp: number; streak: number; exportedAt: string } }
  | { ok: false; reason: string };

/** Parses and validates an exported progress file. Never throws. */
export function parseImportFile(text: string): ParseImportResult {
  let json: unknown;
  try {
    // Strip a UTF-8 BOM (common in files saved on Windows).
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, reason: 'O arquivo não é um JSON válido.' };
  }
  if (!json || typeof json !== 'object' || !('app' in json) || json.app !== 'falae') {
    return { ok: false, reason: 'Este arquivo não é um progresso do Falaê.' };
  }
  if ('schemaVersion' in json && json.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        typeof json.schemaVersion === 'number' && json.schemaVersion > EXPORT_SCHEMA_VERSION
          ? 'Este arquivo foi feito numa versão mais nova do Falaê. Atualize o app e tente de novo.'
          : 'Este arquivo é de uma versão do Falaê que não é mais compatível.',
    };
  }
  const parsed = exportFileSchema.safeParse(json);
  if (!parsed.success) {
    const first = formatIssues(parsed.error)[0] ?? 'formato desconhecido';
    return { ok: false, reason: `Arquivo de progresso inválido (${first}).` };
  }
  const file = parsed.data;
  return {
    ok: true,
    file,
    summary: {
      totalXp: file.data.profile.totalXp,
      streak: file.data.profile.streak.current,
      exportedAt: file.exportedAt,
    },
  };
}

export function exportFileName(day: string): string {
  return `falae-progresso-${day}.json`;
}
