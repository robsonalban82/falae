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
import { emitDbOutdated } from './events';

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
    // Another tab running newer/older code wants to change the schema (or we are blocked by one):
    // close our connection so it can proceed, and ask the student to reload.
    this.on('versionchange', () => {
      this.close();
      emitDbOutdated();
      return false; // skip Dexie's default handler (it only logs and closes)
    });
    this.on('blocked', () => {
      this.close();
      emitDbOutdated();
    });
  }
}
