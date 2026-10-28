import { unitSchema } from './schema';
import { pedagogyIssues } from './pedagogy';
import { buildUnit } from '../test/fixtures/buildUnit';

/** Fixture unit made pedagogy-compliant (every written focus exercise explained). */
const unit = () => {
  const u = unitSchema.parse(buildUnit());
  for (const lesson of [...u.skills.flatMap((s) => s.lessons), u.reviewLesson]) {
    for (const e of lesson.exercises)
      if (e.type === 'fill-blank') e.explanation ??= 'Idade usa "be".';
  }
  return u;
};

describe('pedagogyIssues', () => {
  it('accepts the fixture unit', () => {
    expect(pedagogyIssues(unit())).toEqual([]);
  });

  it('flags lessons with too few exercise types', () => {
    const u = unit();
    const lesson = u.skills[0]!.lessons[0]!;
    lesson.exercises = lesson.exercises.map((e, i) => ({
      ...e,
      ...lesson.exercises[0]!,
      id: `${lesson.id}-x${i}`,
    }));
    expect(pedagogyIssues(u).join('\n')).toMatch(/tipos de exercício/);
  });

  it('flags speak exercises too close together and too many listen-type', () => {
    const u = unit();
    const lesson = u.skills[0]!.lessons[0]!;
    const speak = lesson.exercises.find((e) => e.type === 'speak')!;
    const listen = lesson.exercises.find((e) => e.type === 'listen-type')!;
    lesson.exercises.splice(
      1,
      0,
      { ...speak, id: 'extra-speak' },
      { ...listen, id: 'l2' },
      { ...listen, id: 'l3' },
    );
    lesson.exercises.splice(1, 0, { ...speak, id: 'extra-speak-2' });
    const text = pedagogyIssues(u).join('\n');
    expect(text).toMatch(/dois "speak"/);
    expect(text).toMatch(/exercícios de ouvir/);
  });

  it('requires explanations on written exercises that train a focus item', () => {
    const u = unit();
    const wb = u.skills[0]!.lessons[0]!.exercises.find((e) => e.type === 'word-bank')!;
    delete wb.explanation;
    expect(pedagogyIssues(u).join('\n')).toMatch(/explanation/);
  });

  it('requires a pitfall block in every tip', () => {
    const u = unit();
    u.skills[1]!.tip.blocks = u.skills[1]!.tip.blocks.map((b) =>
      b.kind === 'pitfall' ? { kind: 'text', md: 'x' } : b,
    );
    expect(pedagogyIssues(u).join('\n')).toMatch(/pitfall/);
  });
});
