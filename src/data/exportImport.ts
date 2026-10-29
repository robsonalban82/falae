import { formatIssues } from '../lib/zodIssues';
import { displayStreak } from '../domain/gamification/streak';
import type { DayKey } from '../domain/time';
import { EXPORT_SCHEMA_VERSION, exportFileSchema, type ExportFile } from './models';

export type ImportSummary = {
  totalXp: number;
  /** Streak as the app would show it today (not the raw stored value). */
  streak: number;
  longest: number;
  lessons: number;
  achievements: number;
  exportedAt: string;
};

export type ImportFailure = 'json' | 'notFalae' | 'newerVersion' | 'invalid';

export type ParseExportResult =
  | { ok: true; file: ExportFile; summary: ImportSummary }
  | { ok: false; reason: ImportFailure; issues?: string[] };

const MAX_ISSUES = 3;

/** Parses and validates an exported progress file. Pure; never throws. */
export function parseExportFile(text: string, today: DayKey): ParseExportResult {
  let json: unknown;
  try {
    // Strip a UTF-8 BOM (common in files saved on Windows).
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!json || typeof json !== 'object' || !('app' in json) || json.app !== 'falae') {
    return { ok: false, reason: 'notFalae' };
  }
  if (
    'schemaVersion' in json &&
    typeof json.schemaVersion === 'number' &&
    json.schemaVersion > EXPORT_SCHEMA_VERSION
  ) {
    return { ok: false, reason: 'newerVersion' };
  }
  const parsed = exportFileSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      issues: formatIssues(parsed.error).slice(0, MAX_ISSUES),
    };
  }
  const file = parsed.data;
  const { profile } = file.data;
  return {
    ok: true,
    file,
    summary: {
      totalXp: profile.totalXp,
      streak: displayStreak(profile.streak, today).value,
      longest: profile.streak.longest,
      lessons: file.data.lessonProgress.length,
      achievements: file.data.achievements.length,
      exportedAt: file.exportedAt,
    },
  };
}

export function exportFileName(day: string): string {
  return `falae-progresso-${day}.json`;
}
