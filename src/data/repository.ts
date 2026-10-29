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

/** Data read inside the commit transaction, handed to `apply` (no full-table reads, ADR-011). */
export type CommitContext = {
  /** Stored profile (default profile on first run or after quarantining a corrupt row). */
  profile: Profile;
  unlockedIds: ReadonlySet<string>;
  /** Daily row of `result.day` before this result. */
  dailyBefore: DailyStats | undefined;
  /** Ids of lessons completed before this result. */
  completedLessonIds: ReadonlySet<string>;
  /** Days with goalMet before this result, not counting `result.day`. */
  goalMetCount: number;
  /** `dailyBefore?.goalMet ?? false`. */
  goalMetToday: boolean;
  /** Existing cards of the session items (`result.itemOutcomes` + `extraItemIds`). */
  srsCards: SrsCard[];
  /** Learned cards in the whole table before this commit. */
  wordsLearnedBefore: number;
};

export type AppliedCommit<M> = {
  profile: Profile;
  newAchievements: UnlockedAchievement[];
  /** Cards to write (created or changed). */
  srsCards: SrsCard[];
  meta: M;
};

/** Everything that changes when a lesson/practice ends, written in one transaction. */
export type LessonOutcome<M = undefined> = {
  result: LessonResult;
  /** Profile already updated by domain rules (used when `apply` is absent). */
  profile: Profile;
  /** Cards to write when `apply` is absent. */
  srsCards: SrsCard[];
  newAchievements: UnlockedAchievement[];
  dailyGoalXp: DailyGoal;
  /** Items whose cards `apply` also needs (e.g. unit 1 items for a passed placement). */
  extraItemIds?: string[];
  /**
   * Pure function run INSIDE the transaction on freshly read data, so concurrent
   * commits (two tabs, stale store) never overwrite each other. Overrides
   * `profile`/`newAchievements`/`srsCards` when given.
   */
  apply?: (ctx: CommitContext) => AppliedCommit<M>;
};

export type CommitResult<M> =
  | { applied: false }
  | {
      applied: true;
      profile: Profile;
      newAchievements: UnlockedAchievement[];
      meta: M | undefined;
    };

/**
 * Storage boundary. The UI and stores only talk to this interface, so the
 * IndexedDB implementation can later be swapped for a synced backend.
 */
export interface Repository {
  /** May write: an invalid stored row is moved to quarantine. Do not call inside a read-only transaction. */
  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
  /** Reads (with quarantine), applies `mutate`, validates and writes in one transaction. */
  updateProfile(mutate: (profile: Profile) => Profile): Promise<Profile>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  getLessonProgress(): Promise<LessonProgress[]>;
  /**
   * `applied: false` when this result id was already recorded (nothing is written).
   * Achievements already unlocked are never rewritten.
   */
  recordLessonResult<M = undefined>(outcome: LessonOutcome<M>): Promise<CommitResult<M>>;
  getRecentResults(limit: number): Promise<LessonResult[]>;
  getSrsCards(): Promise<SrsCard[]>;
  /** Tests/helpers only: lesson commits write cards through `apply`. */
  upsertSrsCards(cards: SrsCard[]): Promise<void>;
  getDailyStats(fromDay: string, toDay: string): Promise<DailyStats[]>;
  getAchievements(): Promise<UnlockedAchievement[]>;
  exportAll(): Promise<ExportFile>;
  /** Replaces all data atomically. The file must already be validated. */
  importAll(file: ExportFile): Promise<void>;
  /** Deletes everything (settings and quarantine included) and notifies the stores. */
  resetAll(): Promise<void>;
}
