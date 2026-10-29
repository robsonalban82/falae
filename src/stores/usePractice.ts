import { create } from 'zustand';
import type { StudyItem } from '../content/course';
import { getCourseManifest, loadItemIndex, manifestItemIds, pathUnits } from '../content/loader';
import { repository } from '../data';
import { onDataReplaced } from '../data/events';
import type { SrsCard } from '../data/models';
import { startLesson, type LessonState } from '../domain/lesson/engine';
import { applyFallbacks, type Capabilities } from '../domain/lesson/fallbacks';
import { generatePractice, type PracticeItem } from '../domain/practice/generate';
import type { PathState } from '../domain/progression/pathState';
import { dueCount, selectForPractice } from '../domain/srs/selection';
import { t } from '../i18n/pt-BR';
import { clock } from '../services/clock';
import { onLessonCommitted } from './useProfile';

export const PRACTICE_LESSON_ID = 'practice';

export function toPracticeItem(it: StudyItem): PracticeItem {
  return it.kind === 'vocab'
    ? {
        id: it.id,
        kind: 'vocab',
        en: it.en,
        pt: it.pt,
        acceptedPt: it.acceptedPt,
        acceptedEn: it.acceptedEn,
        emoji: it.emoji,
      }
    : {
        id: it.id,
        kind: 'sentence',
        en: it.en,
        pt: [it.pt],
        acceptedPt: it.acceptedPt,
        acceptedEn: it.acceptedEn,
      };
}

/** Item ids practiced by a lesson (from the manifest), in exercise order. */
function lessonItemIds(lessonId: string | null): string[] {
  if (lessonId === null) return [];
  for (const unit of getCourseManifest().units) {
    if (unit.reviewLesson.id === lessonId) return unit.reviewLesson.itemIds;
    for (const skill of unit.skills) {
      const lesson = skill.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson.itemIds;
    }
  }
  return [];
}

/** Reserve items (ADR-011): the current lesson of the path; course finished → the last review. */
function fallbackIds(path: PathState): string[] {
  if (path.currentLessonId !== null) return lessonItemIds(path.currentLessonId);
  const last = pathUnits().at(-1);
  return last ? last.reviewLesson.itemIds : [];
}

/** Path units unlocked in the current state (never distractors from a locked unit). */
function unlockedUnitIds(path: PathState): string[] {
  const unlocked = new Set(path.units.filter((u) => u.unlocked).map((u) => u.unitId));
  return pathUnits()
    .filter((u) => unlocked.has(u.id))
    .map((u) => u.id);
}

/** Synchronous (manifest only): ids a practice session would use. */
export function selectPracticeItems(cards: readonly SrsCard[], path: PathState): string[] {
  return selectForPractice(cards, clock.today(), fallbackIds(path), manifestItemIds());
}

/** Builds a new practice session (null when there is nothing to practice). Loads the needed units. */
export async function buildPracticeSession(
  cards: readonly SrsCard[],
  path: PathState,
  caps: Capabilities,
): Promise<LessonState | null> {
  const seed = clock.now();
  const ids = selectPracticeItems(cards, path);
  const unlocked = unlockedUnitIds(path);
  // Due cards may belong to units that are locked again (import); load their units too.
  const owners = pathUnits()
    .filter((u) => u.skills.some((s) => s.itemIds.some((id) => ids.includes(id))))
    .map((u) => u.id);
  const index = await loadItemIndex([...new Set([...unlocked, ...owners])]);
  const unlockedItems = manifestItemIds(unlocked);
  const items = ids
    .map((id) => index.items.get(id))
    .filter((i): i is StudyItem => i !== undefined)
    .map(toPracticeItem);
  const distractorPool = [...index.items.values()]
    .filter((i) => unlockedItems.has(i.id))
    .map(toPracticeItem);
  const generated = generatePractice({
    items,
    distractorPool,
    caps,
    seed,
    choicePrompt: t.practice.choicePrompt,
  });
  const exercises = applyFallbacks(generated, caps, (id) => index.items.get(id));
  if (exercises.length === 0) return null;
  return startLesson({
    lessonId: PRACTICE_LESSON_ID,
    kind: 'practice',
    exercises,
    hearts: 0,
    nowMs: seed,
  });
}

type PracticeState = {
  loaded: boolean;
  cards: SrsCard[];
  load: () => Promise<void>;
};

/** SRS cards for the Practice screen (due count). Reloads after commits and data replacement. */
export const usePractice = create<PracticeState>((set) => ({
  loaded: false,
  cards: [],
  load: async () => {
    try {
      set({ cards: await repository.getSrsCards(), loaded: true });
    } catch (err) {
      console.error('[falae] Could not load SRS cards', err);
      set({ loaded: true });
    }
  },
}));

/** Due cards whose item still exists in the content. */
export function practiceDueCount(cards: readonly SrsCard[]): number {
  const existing = manifestItemIds();
  return dueCount(
    cards.filter((c) => existing.has(c.itemId)),
    clock.today(),
  );
}

onLessonCommitted(() => void usePractice.getState().load());
onDataReplaced(() => void usePractice.getState().load());
