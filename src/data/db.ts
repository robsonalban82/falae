import Dexie, { type EntityTable } from 'dexie';
import type {
  DailyStats,
  LessonProgress,
  LessonResult,
  Profile,
  Settings,
  SrsCard,
  UnlockedAchievement,
} from './models';

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

  constructor(name = 'falae') {
    super(name);
    // Schema changes: add db.version(n).stores(...).upgrade(...) plus a migration test.
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
  }
}
