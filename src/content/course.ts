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
  return { units, items, lessons };
}
