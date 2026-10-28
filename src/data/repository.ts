import type {
  DailyGoal,
  DailyStats,
  ExportFile,
  LessonProgress,
  LessonResult,
  Profile,
  Settings,
  SrsCard,
  UnlockedAchievement,
} from './models';

/** Everything that changes when a lesson/practice ends, written in one transaction. */
export type LessonOutcome = {
  result: LessonResult;
  /** Profile already updated by domain rules (XP, streak, hearts). */
  profile: Profile;
  srsCards: SrsCard[];
  newAchievements: UnlockedAchievement[];
  dailyGoalXp: DailyGoal;
};

/**
 * Storage boundary. The UI and stores only talk to this interface, so the
 * IndexedDB implementation can later be swapped for a synced backend.
 */
export interface Repository {
  /** May write: an invalid stored row is moved to quarantine. Do not call inside a read-only transaction. */
  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  getLessonProgress(): Promise<LessonProgress[]>;
  recordLessonResult(outcome: LessonOutcome): Promise<void>;
  getRecentResults(limit: number): Promise<LessonResult[]>;
  getSrsCards(): Promise<SrsCard[]>;
  upsertSrsCards(cards: SrsCard[]): Promise<void>;
  getDailyStats(fromDay: string, toDay: string): Promise<DailyStats[]>;
  getAchievements(): Promise<UnlockedAchievement[]>;
  exportAll(): Promise<ExportFile>;
  /** Replaces all data atomically. The file must already be validated. */
  importAll(file: ExportFile): Promise<void>;
  resetAll(): Promise<void>;
}
