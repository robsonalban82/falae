/** Path progression and unlock rules (docs/ARQUITETURA.md §12). Pure: no React, Dexie or content. */

export type PathCourseInput = {
  units: readonly {
    id: string;
    skills: readonly { id: string; lessons: readonly { id: string }[] }[];
    reviewLesson: { id: string };
  }[];
};

export type NodeStatus = 'locked' | 'available' | 'current' | 'completed';

export type LessonNode = {
  lessonId: string;
  unitId: string;
  /** null = unit review */
  skillId: string | null;
  /** -1 = unit review */
  index: number;
  status: NodeStatus;
  /** Completed through the placement test. */
  testedOut: boolean;
};

export type SkillState = {
  skillId: string;
  crowned: boolean;
  unlocked: boolean;
  nodes: LessonNode[];
};

export type UnitState = {
  unitId: string;
  unlocked: boolean;
  /** Review completed or unit tested out. */
  completed: boolean;
  skills: SkillState[];
  review: LessonNode;
};

export type PathState = {
  units: UnitState[];
  /** null = whole course completed */
  currentLessonId: string | null;
  byLesson: ReadonlyMap<string, LessonNode>;
};

export type Placement = { score: number; skippedUnit1: boolean };

export function computePathState(
  course: PathCourseInput,
  progress: readonly { lessonId: string }[],
  placement?: Placement,
): PathState {
  const done = new Set(progress.map((p) => p.lessonId));
  const byLesson = new Map<string, LessonNode>();
  const units: UnitState[] = [];
  let currentLessonId: string | null = null;
  let previousUnitCompleted = true;

  // `course.units` is already sorted by order, so the first unit is "order 1".
  course.units.forEach((unit, unitIndex) => {
    const testedOut = unitIndex === 0 && placement?.skippedUnit1 === true;
    const unitUnlocked = unitIndex === 0 || previousUnitCompleted;

    const makeNode = (
      lessonId: string,
      skillId: string | null,
      index: number,
      open: boolean,
    ): LessonNode => {
      const completed = testedOut || done.has(lessonId);
      let status: NodeStatus;
      // Completed always wins, even when imported data is out of order.
      if (completed) status = 'completed';
      else if (!open) status = 'locked';
      else if (currentLessonId === null) {
        status = 'current';
        currentLessonId = lessonId;
      } else status = 'available';
      const node: LessonNode = { lessonId, unitId: unit.id, skillId, index, status, testedOut };
      byLesson.set(lessonId, node);
      return node;
    };

    let previousSkillCrowned = true;
    const skills: SkillState[] = unit.skills.map((skill, skillIndex) => {
      const skillUnlocked = unitUnlocked && (skillIndex === 0 || previousSkillCrowned);
      let previousLessonDone = true;
      const nodes = skill.lessons.map((lesson, i) => {
        const node = makeNode(lesson.id, skill.id, i, skillUnlocked && previousLessonDone);
        previousLessonDone = node.status === 'completed';
        return node;
      });
      const crowned = nodes.length > 0 && nodes.every((n) => n.status === 'completed');
      previousSkillCrowned = crowned;
      return { skillId: skill.id, crowned, unlocked: skillUnlocked, nodes };
    });

    const allCrowned = skills.every((s) => s.crowned);
    const review = makeNode(unit.reviewLesson.id, null, -1, unitUnlocked && allCrowned);
    const completed = review.status === 'completed';
    previousUnitCompleted = completed;
    units.push({ unitId: unit.id, unlocked: unitUnlocked, completed, skills, review });
  });

  return { units, currentLessonId, byLesson };
}

export function canOpenLesson(state: PathState, lessonId: string): boolean {
  const node = state.byLesson.get(lessonId);
  return node !== undefined && node.status !== 'locked';
}
