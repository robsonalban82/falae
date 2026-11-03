import { FalaeDb } from './db';
import { z } from 'zod';
import { formatIssues } from '../lib/zodIssues';
import {
  defaultProfile,
  defaultSettings,
  EXPORT_SCHEMA_VERSION,
  exportFileSchema,
  lessonResultSchema,
  MAX_USER_CARDS,
  mapProgressSchema,
  planProgressSchema,
  userCardSchema,
  profileSchema,
  settingsSchema,
  srsCardSchema,
  unlockedAchievementSchema,
  type DailyStats,
  type ExportFile,
  type LessonProgress,
  type MapProgress,
  type PlanProgress,
  type UserCard,
  type Profile,
  type Settings,
  type SrsCard,
} from './models';
import { isLearned } from '../domain/srs/sm2';
import {
  UserCardLimitError,
  type CommitResult,
  type LessonOutcome,
  type Repository,
} from './repository';
import {
  sessionCompletesLesson,
  sessionCountsAsStudy,
  sessionStudiesMap,
} from '../domain/gamification/xp';
import { emitDataReplaced } from './events';

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

  async updateProfile(mutate: (profile: Profile) => Profile): Promise<Profile> {
    const db = this.db;
    const nowIso = this.nowIso();
    return db.transaction('rw', [db.profile, db.quarantine], async () => {
      const raw = await db.profile.get('me');
      let current = defaultProfile(nowIso);
      if (raw !== undefined) {
        const parsed = profileSchema.safeParse(raw);
        if (parsed.success) current = parsed.data;
        else {
          const issues = formatIssues(parsed.error);
          console.error('[falae] Invalid profile row moved to quarantine:', issues);
          await db.quarantine.add({ table: 'profile', raw, at: nowIso, issues });
        }
      }
      const next = profileSchema.parse(mutate(current));
      await db.profile.put(next);
      return next;
    });
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

  async recordLessonResult<M = undefined>({
    result,
    profile,
    srsCards,
    newAchievements,
    dailyGoalXp,
    extraItemIds,
    apply,
  }: LessonOutcome<M>): Promise<CommitResult<M>> {
    const db = this.db;
    // Validate up front so a domain bug can never write data that export/import would reject.
    const validResult = lessonResultSchema.parse(result);
    const nowIso = this.nowIso();

    return db.transaction(
      'rw',
      [
        db.results,
        db.lessonProgress,
        db.daily,
        db.profile,
        db.srs,
        db.achievements,
        db.quarantine,
        db.mapProgress,
      ],
      async (): Promise<CommitResult<M>> => {
        // Idempotent: the same lesson run is never counted twice (profile and achievements included).
        // This `get` is the only read of `results` (the one table that grows without limit).
        if (await db.results.get(validResult.id)) return { applied: false };

        // Fresh reads inside the transaction.
        const storedRaw = await db.profile.get('me');
        let storedProfile: Profile;
        if (storedRaw === undefined) storedProfile = defaultProfile(nowIso);
        else {
          const parsed = profileSchema.safeParse(storedRaw);
          if (parsed.success) storedProfile = parsed.data;
          else {
            // Keep the original row before continuing with the default (same transaction:
            // if the commit fails, neither the quarantine nor the new profile is written).
            const issues = formatIssues(parsed.error);
            console.error('[falae] Invalid profile row moved to quarantine:', issues);
            await db.quarantine.add({ table: 'profile', raw: storedRaw, at: nowIso, issues });
            storedProfile = defaultProfile(nowIso);
          }
        }
        const unlockedIds = new Set(
          (await db.achievements.toCollection().primaryKeys()).map(String),
        );
        const dayRow = await db.daily.get(validResult.day);

        const mapId = validResult.context?.mapId;
        let prevMap: MapProgress | undefined;
        if (mapId !== undefined && sessionStudiesMap(validResult.kind)) {
          const rawMap = await db.mapProgress.get(mapId);
          if (rawMap !== undefined) {
            const parsedMap = mapProgressSchema.safeParse(rawMap);
            if (parsedMap.success) prevMap = parsedMap.data;
            else {
              // Keep the bad row in quarantine and treat the map as never studied.
              const issues = formatIssues(parsedMap.error);
              console.error('[falae] Invalid map progress row moved to quarantine:', issues);
              await db.quarantine.add({ table: 'mapProgress', raw: rawMap, at: nowIso, issues });
            }
          }
        }

        let nextProfile = profile;
        let nextAchievements = newAchievements;
        let nextCards = srsCards;
        let meta: M | undefined;
        let finalXp = validResult.xp;
        if (apply) {
          const itemIds = [
            ...new Set([...validResult.itemOutcomes.map((o) => o.itemId), ...(extraItemIds ?? [])]),
          ];
          const cards = (await db.srs.bulkGet(itemIds)).filter(
            (c): c is SrsCard => c !== undefined,
          );
          const out = apply({
            profile: storedProfile,
            unlockedIds,
            dailyBefore: dayRow,
            completedLessonIds: new Set(
              (await db.lessonProgress.toCollection().primaryKeys()).map(String),
            ),
            // Cursors, never materialized arrays (booleans are not indexable in IndexedDB).
            goalMetCount: await db.daily
              .filter((d) => d.goalMet && d.day !== validResult.day)
              .count(),
            goalMetToday: dayRow?.goalMet ?? false,
            srsCards: cards,
            // O(n) cursor over `srs`, acceptable: the table is bounded by the course items
            // (hundreds), not by usage. A boolean "learned" cannot be indexed in IndexedDB.
            wordsLearnedBefore: await db.srs.filter(isLearned).count(),
            ...(prevMap ? { mapProgress: prevMap } : {}),
          });
          if (out.xp !== undefined) finalXp = out.xp;
          nextProfile = out.profile;
          nextAchievements = out.newAchievements;
          nextCards = out.srsCards;
          meta = out.meta;
        }
        // Throws (and rolls back the transaction) on invalid data.
        const validProfile = profileSchema.parse(nextProfile);
        const validCards = z.array(srsCardSchema).parse(nextCards);
        const fresh = z
          .array(unlockedAchievementSchema)
          .parse(nextAchievements)
          .filter((a) => !unlockedIds.has(a.id));

        // The stored result carries the final XP (a repeated map earns 0).
        const storedResult = lessonResultSchema.parse({ ...validResult, xp: finalXp });
        await db.results.put(storedResult);
        if (sessionCompletesLesson(result.kind)) {
          const prev = await db.lessonProgress.get(result.lessonId);
          await db.lessonProgress.put({
            lessonId: result.lessonId,
            completedCount: (prev?.completedCount ?? 0) + 1,
            bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, result.accuracy),
            firstCompletedAt: prev?.firstCompletedAt ?? result.finishedAt,
          });
        }
        if (mapId !== undefined && sessionStudiesMap(result.kind)) {
          await db.mapProgress.put({
            mapId,
            firstStudiedAt: prevMap?.firstStudiedAt ?? result.finishedAt,
            // A clock that went back never moves the last day backwards.
            lastStudiedDay:
              prevMap && prevMap.lastStudiedDay > result.day ? prevMap.lastStudiedDay : result.day,
            timesStudied: (prevMap?.timesStudied ?? 0) + 1,
          });
        }

        // Placement is not study: it never shows in the chart nor counts as today's activity.
        if (sessionCountsAsStudy(result.kind)) {
          // Clock went back (a day before the last activity): XP counts, but no new goal day.
          const last = storedProfile.streak.lastActiveDay;
          const clockBack = last !== undefined && validResult.day < last;
          const xp = (dayRow?.xp ?? 0) + finalXp;
          const cardsToday =
            result.kind === 'cards'
              ? (dayRow?.cards ?? 0) + new Set(result.itemOutcomes.map((o) => o.itemId)).size
              : dayRow?.cards;
          await db.daily.put({
            day: result.day,
            xp,
            lessons: (dayRow?.lessons ?? 0) + 1,
            // Once met, a day stays met even if the goal is raised later.
            goalMet: (dayRow?.goalMet ?? false) || (!clockBack && xp >= dailyGoalXp),
            ...(cardsToday !== undefined ? { cards: cardsToday } : {}),
          });
        }

        await db.profile.put(validProfile);
        if (validCards.length) await db.srs.bulkPut(validCards);
        if (fresh.length) await db.achievements.bulkAdd(fresh);
        return { applied: true, profile: validProfile, newAchievements: fresh, meta };
      },
    );
  }

  async listUserCards(): Promise<UserCard[]> {
    const rows = await this.db.userCards.orderBy('updatedAt').reverse().toArray();
    return rows.flatMap((row) => {
      const parsed = userCardSchema.safeParse(row);
      if (parsed.success) return [parsed.data];
      console.error('[falae] Invalid user card skipped:', formatIssues(parsed.error));
      return [];
    });
  }

  countUserCards(): Promise<number> {
    return this.db.userCards.count();
  }

  async saveUserCard(card: UserCard): Promise<void> {
    const valid = userCardSchema.parse(card);
    const db = this.db;
    await db.transaction('rw', db.userCards, async () => {
      if (!(await db.userCards.get(valid.id)) && (await db.userCards.count()) >= MAX_USER_CARDS)
        throw new UserCardLimitError();
      await db.userCards.put(valid);
    });
  }

  async deleteUserCard(id: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', [db.userCards, db.srs], async () => {
      await db.userCards.delete(id);
      await db.srs.delete(id); // a card's SrsCard has the card id as itemId
    });
  }

  async getMapProgress(): Promise<MapProgress[]> {
    const rows = await this.db.mapProgress.toArray();
    return rows.flatMap((row) => {
      const parsed = mapProgressSchema.safeParse(row);
      if (parsed.success) return [parsed.data];
      console.error('[falae] Invalid map progress skipped:', formatIssues(parsed.error));
      return [];
    });
  }

  async getPlanProgress(planId: string): Promise<PlanProgress | undefined> {
    const row = await this.db.planProgress.get(planId);
    if (row === undefined) return undefined;
    const parsed = planProgressSchema.safeParse(row);
    if (parsed.success) return parsed.data;
    console.error('[falae] Invalid plan progress skipped:', formatIssues(parsed.error));
    return undefined;
  }

  async savePlanProgress(progress: PlanProgress): Promise<void> {
    await this.db.planProgress.put(planProgressSchema.parse(progress));
  }

  getRecentResults(limit: number) {
    return this.db.results.orderBy('finishedAt').reverse().limit(limit).toArray();
  }

  getSrsCards() {
    return this.db.srs.toArray();
  }

  /** Tests/helpers only. */
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
        userCards: await db.userCards.toArray(),
        mapProgress: await db.mapProgress.toArray(),
        planProgress: await db.planProgress.toArray(),
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
      await db.userCards.bulkPut(data.userCards);
      await db.mapProgress.bulkPut(data.mapProgress);
      await db.planProgress.bulkPut(data.planProgress);
    });
    emitDataReplaced();
  }

  async resetAll(): Promise<void> {
    const db = this.db;
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
    emitDataReplaced();
  }

  /** Test helper. */
  close(): void {
    this.db.close();
  }
}
