import { collectKnownWords } from '../domain/grading/grade';
import {
  courseIssues,
  formatIssues,
  unitSchema,
  type Lesson,
  type Sentence,
  type Skill,
  type Unit,
  type VocabItem,
} from './schema';

export type StudyItem = ({ kind: 'vocab' } & VocabItem) | ({ kind: 'sentence' } & Sentence);

export type LessonRef = {
  lesson: Lesson;
  unit: Unit;
  /** null for the unit review lesson */
  skill: Skill | null;
  /** 0-based position inside the skill, or -1 for the review */
  index: number;
};

export type Course = {
  units: Unit[];
  items: Map<string, StudyItem>;
  lessons: Map<string, LessonRef>;
  /** Normalized words of the whole course; blocks false "almost right" matches. */
  knownWords: ReadonlySet<string>;
};

export type BuildResult = { course: Course; errors: string[] };

/**
 * Validates raw unit data and indexes it. Invalid units are dropped (never loaded)
 * and reported in `errors`; callers decide whether that is fatal (scripts, tests) or not (runtime).
 */
export function buildCourse(rawUnits: readonly unknown[]): BuildResult {
  const errors: string[] = [];
  const accepted: Unit[] = [];

  rawUnits.forEach((raw, i) => {
    const parsed = unitSchema.safeParse(raw);
    if (!parsed.success) {
      const label = labelOf(raw, i);
      errors.push(...formatIssues(parsed.error).map((line) => `[${label}] ${line}`));
      return;
    }
    const issues = courseIssues([...accepted, parsed.data]);
    if (issues.length > 0) {
      errors.push(...issues.map((line) => `[${parsed.data.id}] ${line}`));
      return;
    }
    accepted.push(parsed.data);
  });

  accepted.sort((a, b) => a.order - b.order);
  return { course: indexCourse(accepted), errors };
}

function labelOf(raw: unknown, i: number): string {
  if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string') return raw.id;
  return `unidade #${i + 1}`;
}

function indexCourse(units: Unit[]): Course {
  return { ...indexUnits(units), units, knownWords: new Set(knownWordsOf(units)) };
}

/** Normalized words of the given units (sorted, deduplicated). */
export function knownWordsOf(units: readonly Unit[]): string[] {
  return [...collectKnownWords(courseTexts(units))].sort();
}

/** Item and lesson indexes of already-validated units (no cross-unit checks). */
export function indexUnits(units: readonly Unit[]): Pick<Course, 'items' | 'lessons'> {
  const items = new Map<string, StudyItem>();
  const lessons = new Map<string, LessonRef>();
  for (const unit of units) {
    for (const skill of unit.skills) {
      skill.vocab.forEach((v) => items.set(v.id, { kind: 'vocab', ...v }));
      skill.sentences.forEach((s) => items.set(s.id, { kind: 'sentence', ...s }));
      skill.lessons.forEach((lesson, index) =>
        lessons.set(lesson.id, { lesson, unit, skill, index }),
      );
    }
    lessons.set(unit.reviewLesson.id, { lesson: unit.reviewLesson, unit, skill: null, index: -1 });
  }
  return { items, lessons };
}

function* courseTexts(units: readonly Unit[]): Generator<{ text: string; lang: 'en' | 'pt' }> {
  for (const unit of units) {
    for (const skill of unit.skills) {
      for (const v of skill.vocab) {
        yield { text: v.en, lang: 'en' };
        for (const pt of v.pt) yield { text: pt, lang: 'pt' };
        yield { text: v.example.en, lang: 'en' };
        yield { text: v.example.pt, lang: 'pt' };
      }
      for (const s of skill.sentences) {
        yield { text: s.en, lang: 'en' };
        yield { text: s.pt, lang: 'pt' };
      }
    }
    for (const lesson of [...unit.skills.flatMap((s) => s.lessons), unit.reviewLesson]) {
      for (const ex of lesson.exercises) {
        if (ex.type === 'multiple-choice')
          for (const o of ex.options) yield { text: o.text, lang: 'en' };
        if (ex.type === 'word-bank') for (const d of ex.distractors) yield { text: d, lang: 'en' };
        if (ex.type === 'fill-blank') for (const o of ex.options) yield { text: o, lang: 'en' };
        if (ex.type === 'match-pairs') {
          for (const p of ex.pairs) {
            yield { text: p.en, lang: 'en' };
            yield { text: p.pt, lang: 'pt' };
          }
        }
      }
    }
  }
}

/** Finds a skill (and its unit) by id. */
export function findSkill(course: Course, skillId: string): { skill: Skill; unit: Unit } | null {
  for (const unit of course.units) {
    const skill = unit.skills.find((s) => s.id === skillId);
    if (skill) return { skill, unit };
  }
  return null;
}
