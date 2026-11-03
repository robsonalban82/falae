import Dexie, { type EntityTable } from 'dexie';
import type {
  DailyStats,
  LessonProgress,
  LessonResult,
  MapProgress,
  PlanProgress,
  Profile,
  Settings,
  SrsCard,
  UnlockedAchievement,
  UserCard,
} from './models';
import { clearDbBlocked, emitDbOutdated } from './events';

/** Raw rows that failed validation, kept so progress is never silently lost. */
export type QuarantinedRow = {
  id?: number;
  table: string;
  raw: unknown;
  at: string;
  issues: string[];
};

export class FalaeDb extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>;
  results!: EntityTable<LessonResult, 'id'>;
  srs!: EntityTable<SrsCard, 'itemId'>;
  daily!: EntityTable<DailyStats, 'day'>;
  achievements!: EntityTable<UnlockedAchievement, 'id'>;
  quarantine!: EntityTable<QuarantinedRow, 'id'>;
  userCards!: EntityTable<UserCard, 'id'>;
  mapProgress!: EntityTable<MapProgress, 'mapId'>;
  planProgress!: EntityTable<PlanProgress, 'planId'>;

  constructor(name = 'falae') {
    super(name);
    // Schema changes: add db.version(n).stores(...) (+ .upgrade() only if old rows change shape) and a migration test.
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      lessonProgress: 'lessonId',
      results: 'id, day, lessonId, finishedAt',
      srs: 'itemId, dueDay',
      daily: 'day',
      achievements: 'id',
      quarantine: '++id',
    });
    // v2 only ADDS tables. No v1 table changes key or index, and the new optional fields
    // (LessonResult.context, DailyStats.cards) are absent on old rows and read as such, so there
    // is deliberately no upgrade(): nothing to rewrite, nothing to backfill.
    this.version(2).stores({
      userCards: 'id, updatedAt',
      mapProgress: 'mapId',
      planProgress: 'planId',
    });
    // Another tab wants to change (or delete) the schema: close our connection so it can
    // proceed, and ask the student to reload. close() without options also disables auto-reopen,
    // so later operations reject with DatabaseClosedError instead of silently reopening on the
    // old version. Returning false skips Dexie's default handler (log + close with auto-reopen).
    this.on('versionchange', (event) => {
      this.close();
      emitDbOutdated(event.newVersion === null ? 'deleted' : 'updated');
      return false;
    });
    // We are the newer tab and an older one keeps the DB open: do NOT close (we are the one
    // waiting). Ask to close the other tabs; the open proceeds once they do.
    this.on('blocked', () => emitDbOutdated('blocked'));
    this.on('ready', () => clearDbBlocked());
  }
}
