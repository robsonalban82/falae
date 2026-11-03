import type { ZodError } from 'zod';
import { formatIssues } from '../lib/zodIssues';
import { displayStreak } from '../domain/gamification/streak';
import type { DayKey } from '../domain/time';
import {
  EXPORT_SCHEMA_VERSION,
  exportFileSchema,
  exportFileV1Schema,
  type ExportFile,
  type ExportFileV1,
} from './models';

export type ImportSummary = {
  totalXp: number;
  /** Streak as the app would show it today (not the raw stored value). */
  streak: number;
  longest: number;
  lessons: number;
  achievements: number;
  userCards: number;
  /** Distinct maps studied. */
  mapsStudied: number;
  exportedAt: string;
};

export type ImportFailure = 'json' | 'notFalae' | 'newerVersion' | 'invalid';

export type ParseExportResult =
  | { ok: true; file: ExportFile; summary: ImportSummary }
  | { ok: false; reason: ImportFailure; issues?: string[] };

const MAX_ISSUES = 3;

/** Pure: promotes a v1 backup to v2 with the new tables empty. */
export function upgradeExportV1(file: ExportFileV1): ExportFile {
  return {
    ...file,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    data: { ...file.data, userCards: [], mapProgress: [], planProgress: [] },
  };
}

/** Importing replaces everything: warn when the student's own cards would vanish. */
export function importDropsUserCards(currentUserCards: number, summary: ImportSummary): boolean {
  return currentUserCards > 0 && summary.userCards === 0;
}

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
  const invalid = (error: ZodError): ParseExportResult => ({
    ok: false,
    reason: 'invalid',
    issues: formatIssues(error).slice(0, MAX_ISSUES),
  });
  let file: ExportFile;
  if ('schemaVersion' in json && json.schemaVersion === 1) {
    const v1 = exportFileV1Schema.safeParse(json);
    if (!v1.success) return invalid(v1.error);
    file = upgradeExportV1(v1.data);
  } else {
    const v2 = exportFileSchema.safeParse(json);
    if (!v2.success) return invalid(v2.error);
    file = v2.data;
  }
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
      userCards: file.data.userCards.length,
      mapsStudied: new Set(file.data.mapProgress.map((m) => m.mapId)).size,
      exportedAt: file.exportedAt,
    },
  };
}

export function exportFileName(day: string): string {
  return `falae-progresso-${day}.json`;
}
