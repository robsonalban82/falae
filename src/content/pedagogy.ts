import type { Lesson, Unit } from './schema';

/**
 * Pedagogy rules from .claude/skills/criar-licao §5 that the schema cannot express.
 * Returned as readable PT-BR lines; validate:content and tests treat them as errors.
 */
export const MIN_TYPES_PER_LESSON = 4;
export const MAX_LISTEN_PER_LESSON = 2;
export const SPEAK_WINDOW = 5;

function lessonIssues(lesson: Lesson, focusItems: ReadonlySet<string>): string[] {
  const issues: string[] = [];
  const types = new Set(lesson.exercises.map((e) => e.type));
  if (types.size < MIN_TYPES_PER_LESSON) {
    issues.push(
      `${lesson.id}: só ${types.size} tipos de exercício (mínimo ${MIN_TYPES_PER_LESSON}).`,
    );
  }
  const listens = lesson.exercises.filter((e) => e.type === 'listen-type').length;
  if (listens > MAX_LISTEN_PER_LESSON) {
    issues.push(`${lesson.id}: ${listens} exercícios de ouvir (máximo ${MAX_LISTEN_PER_LESSON}).`);
  }
  lesson.exercises.forEach((e, i) => {
    if (e.type !== 'speak') return;
    const window = lesson.exercises.slice(Math.max(0, i - SPEAK_WINDOW + 1), i);
    if (window.some((w) => w.type === 'speak')) {
      issues.push(`${e.id}: dois "speak" em menos de ${SPEAK_WINDOW} exercícios.`);
    }
  });
  for (const e of lesson.exercises) {
    const trainsFocus = e.itemIds.some((id) => focusItems.has(id));
    const writes =
      e.type === 'word-bank' || e.type === 'translate-typing' || e.type === 'fill-blank';
    if (trainsFocus && writes && !e.explanation) {
      issues.push(`${e.id}: treina um erro típico (focus) mas não tem "explanation".`);
    }
  }
  return issues;
}

export function pedagogyIssues(unit: Unit): string[] {
  const issues: string[] = [];
  const focusItems = new Set(
    unit.skills
      .flatMap((s) => [...s.vocab, ...s.sentences])
      .filter((i) => i.focus)
      .map((i) => i.id),
  );
  for (const skill of unit.skills) {
    if (!skill.tip.blocks.some((b) => b.kind === 'pitfall')) {
      issues.push(`${skill.id}: a dica precisa de um bloco "pitfall" (❌/✅).`);
    }
    for (const lesson of skill.lessons) issues.push(...lessonIssues(lesson, focusItems));
  }
  issues.push(...lessonIssues(unit.reviewLesson, focusItems));
  return issues.map((line) => `[${unit.id}] ${line}`);
}
