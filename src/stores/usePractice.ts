import { create } from 'zustand';
import type { Course, StudyItem } from '../content/course';
import { loadCourse, pathUnits } from '../content/loader';
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

/** Item ids practiced by a lesson, in exercise order. */
function lessonItemIds(course: Course, lessonId: string | null): string[] {
  const lesson = lessonId ? course.lessons.get(lessonId)?.lesson : undefined;
  return [...new Set((lesson?.exercises ?? []).flatMap((e) => e.itemIds))];
}

/** Reserve items (ADR-011): the current lesson of the path; course finished → the last review. */
function fallbackIds(course: Course, path: PathState): string[] {
  if (path.currentLessonId !== null) return lessonItemIds(course, path.currentLessonId);
  const last = pathUnits().at(-1);
  return last ? lessonItemIds(course, last.reviewLesson.id) : [];
}

/** Items of the unlocked units only (never distractors from a locked unit). */
function unlockedPool(course: Course, path: PathState): PracticeItem[] {
  const unlocked = new Set(path.units.filter((u) => u.unlocked).map((u) => u.unitId));
  return pathUnits()
    .filter((u) => unlocked.has(u.id))
    .flatMap((u) =>
      u.skills.flatMap((s) => [...s.vocab, ...s.sentences].map((i) => course.items.get(i.id))),
    )
    .filter((i): i is StudyItem => i !== undefined)
    .map(toPracticeItem);
}

export function selectPracticeItems(cards: readonly SrsCard[], path: PathState): string[] {
  const { course } = loadCourse();
  return selectForPractice(
    cards,
    clock.today(),
    fallbackIds(course, path),
    new Set(course.items.keys()),
  );
}

/** Builds a new practice session (null when there is nothing to practice). */
export function buildPracticeSession(
  cards: readonly SrsCard[],
  path: PathState,
  caps: Capabilities,
): LessonState | null {
  const { course } = loadCourse();
  const seed = clock.now();
  const items = selectPracticeItems(cards, path)
    .map((id) => course.items.get(id))
    .filter((i): i is StudyItem => i !== undefined)
    .map(toPracticeItem);
  const generated = generatePractice({
    items,
    distractorPool: unlockedPool(course, path),
    caps,
    seed,
    choicePrompt: t.practice.choicePrompt,
  });
  const exercises = applyFallbacks(generated, caps, (id) => course.items.get(id));
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
  const { course } = loadCourse();
  return dueCount(
    cards.filter((c) => course.items.has(c.itemId)),
    clock.today(),
  );
}

onLessonCommitted(() => void usePractice.getState().load());
onDataReplaced(() => void usePractice.getState().load());
