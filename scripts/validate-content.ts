import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCourse } from '../src/content/course';
import { pedagogyIssues } from '../src/content/pedagogy';

const dir = join(import.meta.dirname, '..', 'src', 'content', 'units');
const files = (existsSync(dir) ? readdirSync(dir) : []).filter((f) => f.endsWith('.json')).sort();

if (files.length === 0) {
  console.warn('Nenhuma unidade em src/content/units ainda.');
  process.exit(0);
}

const raw: unknown[] = [];
let parseFailed = false;
for (const file of files) {
  try {
    raw.push(JSON.parse(readFileSync(join(dir, file), 'utf8')));
  } catch (err) {
    parseFailed = true;
    console.error(`✗ ${file}: JSON inválido — ${(err as Error).message}`);
  }
}

const { course, errors: schemaErrors } = buildCourse(raw);
const errors = [...schemaErrors, ...course.units.flatMap(pedagogyIssues)];
for (const line of errors) console.error(`✗ ${line}`);

const exercises = course.units.reduce(
  (n, u) =>
    n +
    [...u.skills.flatMap((s) => s.lessons), u.reviewLesson].reduce(
      (m, l) => m + l.exercises.length,
      0,
    ),
  0,
);
console.log(
  `${course.units.length}/${files.length} unidades válidas · ${course.items.size} itens · ${course.lessons.size} lições · ${exercises} exercícios`,
);

if (parseFailed || errors.length > 0) process.exit(1);
console.log('✓ Conteúdo válido.');
