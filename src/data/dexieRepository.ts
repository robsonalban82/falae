import { FalaeDb } from './db';
import { z } from 'zod';
import { formatIssues } from '../lib/zodIssues';
import {
  defaultProfile,
  defaultSettings,
  EXPORT_SCHEMA_VERSION,
  exportFileSchema,
  lessonResultSchema,
  profileSchema,
  settingsSchema,
  srsCardSchema,
  unlockedAchievementSchema,
  type DailyStats,
  type ExportFile,
  type LessonProgress,
  type Profile,
  type Settings,
} from './models';
import type { LessonOutcome, Repository } from './repository';

export class DexieRepository implements Repository {
  private readonly db: FalaeDb;
  private readonly nowIso: () => string;

  constructor(options: { dbName?: string; nowIso: () => string }) {
    this.db = new FalaeDb(options.dbName);
    this.nowIso = options.nowIso;
  }

  async getProfile(): Promise<Profile> {
    const stored = await this.db.profile.get('me');
    if (stored === undefined) return defaultProfile(this.nowIso());
    const parsed = profileSchema.safeParse(stored);
    if (parsed.success) return parsed.data;
    // Never crash, but never lose the original row either.
    await this.quarantine('profile', stored, parsed.error);
    return defaultProfile(this.nowIso());
  }

  private async quarantine(table: string, raw: unknown, error: z.ZodError): Promise<void> {
    const issues = formatIssues(error);
    console.error(`[falae] Invalid ${table} row moved to quarantine:`, issues);
    const db = this.db;
    await db.transaction('rw', [db.quarantine, db.table(table)], async () => {
      await db.quarantine.add({ table, raw, at: this.nowIso(), issues });
      await db.table(table).delete('me');
    });
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.profile.put(profileSchema.parse(profile));
  }

  async getSettings(): Promise<Settings> {
    const stored = await this.db.settings.get('me');
    if (stored === undefined) return defaultSettings();
    const parsed = settingsSchema.safeParse(stored);
    if (parsed.success) return parsed.data;
    await this.quarantine('settings', stored, parsed.error);
    return defaultSettings();
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.settings.put(settingsSchema.parse(settings));
  }

  getLessonProgress(): Promise<LessonProgress[]> {
    return this.db.lessonProgress.toArray();
  }

  async recordLessonResult({
    result,
    profile,
    srsCards,
    newAchievements,
    dailyGoalXp,
  }: LessonOutcome): Promise<void> {
    const db = this.db;
    // Validate everything up front so a domain bug can never write data that export/import would reject.
    const validResult = lessonResultSchema.parse(result);
    const validProfile = profileSchema.parse(profile);
    const validCards = z.array(srsCardSchema).parse(srsCards);
    const validAchievements = z.array(unlockedAchievementSchema).parse(newAchievements);

    await db.transaction(
      'rw',
      [db.results, db.lessonProgress, db.daily, db.profile, db.srs, db.achievements],
      async () => {
        await db.results.put(validResult);

        if (result.kind === 'lesson' || result.kind === 'review') {
          const prev = await db.lessonProgress.get(result.lessonId);
          await db.lessonProgress.put({
            lessonId: result.lessonId,
            completedCount: (prev?.completedCount ?? 0) + 1,
            bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, result.accuracy),
            firstCompletedAt: prev?.firstCompletedAt ?? result.finishedAt,
          });
        }

        const day = await db.daily.get(result.day);
        const xp = (day?.xp ?? 0) + result.xp;
        await db.daily.put({
          day: result.day,
          xp,
          lessons: (day?.lessons ?? 0) + 1,
          // Once met, a day stays met even if the goal is raised later.
          goalMet: (day?.goalMet ?? false) || xp >= dailyGoalXp,
        });

        await db.profile.put(validProfile);
        if (validCards.length) await db.srs.bulkPut(validCards);
        if (validAchievements.length) await db.achievements.bulkPut(validAchievements);
      },
    );
  }

  getRecentResults(limit: number) {
    return this.db.results.orderBy('finishedAt').reverse().limit(limit).toArray();
  }

  getSrsCards() {
    return this.db.srs.toArray();
  }

  async upsertSrsCards(cards: LessonOutcome['srsCards']): Promise<void> {
    await this.db.srs.bulkPut(z.array(srsCardSchema).parse(cards));
  }

  getDailyStats(fromDay: string, toDay: string): Promise<DailyStats[]> {
    return this.db.daily.where('day').between(fromDay, toDay, true, true).toArray();
  }

  getAchievements() {
    return this.db.achievements.toArray();
  }

  async exportAll(): Promise<ExportFile> {
    const db = this.db;
    // Read (and, if needed, quarantine) profile/settings before the read-only transaction.
    const profile = await this.getProfile();
    const settings = await this.getSettings();
    return db.transaction('r', db.tables, async () => ({
      app: 'falae' as const,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: this.nowIso(),
      data: {
        profile,
        settings,
        lessonProgress: await db.lessonProgress.toArray(),
        results: await db.results.toArray(),
        srs: await db.srs.toArray(),
        daily: await db.daily.toArray(),
        achievements: await db.achievements.toArray(),
      },
    }));
  }

  async importAll(file: ExportFile): Promise<void> {
    const db = this.db;
    // Re-validate at the boundary: an invalid file must leave the database untouched.
    const { data } = exportFileSchema.parse(file);
    const tables = db.tables.filter((t) => t.name !== 'quarantine');
    await db.transaction('rw', tables, async () => {
      await Promise.all(tables.map((t) => t.clear()));
      await db.profile.put(data.profile);
      await db.settings.put(data.settings);
      await db.lessonProgress.bulkPut(data.lessonProgress);
      await db.results.bulkPut(data.results);
      await db.srs.bulkPut(data.srs);
      await db.daily.bulkPut(data.daily);
      await db.achievements.bulkPut(data.achievements);
    });
  }

  async resetAll(): Promise<void> {
    const db = this.db;
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
  }

  /** Test helper. */
  close(): void {
    this.db.close();
  }
}
