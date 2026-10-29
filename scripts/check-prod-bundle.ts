/**
 * Fails the production build if E2E/dev-only code leaked into dist/
 * (test hooks, simulated clock storage, design showcase route, demo unit),
 * if the bundle budget is blown (Phase 7) or if unit JSON landed in the entry chunk.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { initialScripts } from './lib/htmlEntries';

const ENTRY_BUDGET = 250 * 1024; // minified bytes (~80 kB gzip)
const CHUNK_BUDGET = 300 * 1024;
/** Entry + modulepreloads, gzip (DECISOES ADR-013; measured 226 kB in Phase 7). */
const INITIAL_GZIP_BUDGET = 260 * 1024;

const FORBIDDEN = [
  'importForTest',
  'falae-test-clock',
  'falae-e2e-onboarded',
  'seedSrs',
  'notificationPermission',
  '/dev/showcase',
  'Demo do motor de lição',
];
const root = process.argv[2] ?? 'dist';
const dir = join(root, 'assets');

const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const leaks: string[] = [];
for (const file of files) {
  if (/showcase/i.test(file)) leaks.push(`${file}: showcase chunk`);
  const code = readFileSync(join(dir, file), 'utf8');
  for (const needle of FORBIDDEN) if (code.includes(needle)) leaks.push(`${file}: "${needle}"`);
}

if (leaks.length > 0) {
  console.error('Código só de teste/dev no bundle de produção:\n' + leaks.join('\n'));
  process.exit(1);
}
console.log(`✓ Bundle de produção limpo (${files.length} arquivos JS verificados).`);

// --- Budget ---
const html = readFileSync(join(root, 'index.html'), 'utf8');
const { entry, preloads } = initialScripts(html);
if (!entry) {
  console.error('Chunk de entrada não encontrado em index.html.');
  process.exit(1);
}
const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`;
const rows = files
  .map((file) => {
    const code = readFileSync(join(dir, file));
    return { file, size: code.length, gzip: gzipSync(code).length };
  })
  .sort((a, b) => b.size - a.size);
const problems: string[] = [];
console.log('\nChunk                                         minificado      gzip');
for (const r of rows) {
  const mark = r.file === entry ? ' (entrada)' : '';
  console.log(`${(r.file + mark).padEnd(44)} ${kb(r.size).padStart(10)} ${kb(r.gzip).padStart(9)}`);
  if (r.file === entry && r.size > ENTRY_BUDGET)
    problems.push(`entrada ${r.file} tem ${kb(r.size)} (limite ${kb(ENTRY_BUDGET)})`);
  if (r.size > CHUNK_BUDGET)
    problems.push(`${r.file} tem ${kb(r.size)} (limite por chunk ${kb(CHUNK_BUDGET)})`);
}
// Unit JSON must stay in lazy chunks (ADR-012): no tip title of any unit in the initial JS.
const initial = [entry, ...preloads];
const initialCode = initial.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const unitsDir = join('src', 'content', 'units');
for (const file of readdirSync(unitsDir).filter((f) => f.endsWith('.json'))) {
  const unit = JSON.parse(readFileSync(join(unitsDir, file), 'utf8')) as {
    skills?: { tip?: { title?: string } }[];
  }; // shape already validated by validate:content; only the tip title is read
  const marker = unit.skills?.[0]?.tip?.title;
  if (marker && initialCode.includes(JSON.stringify(marker).slice(1, -1)))
    problems.push(`conteúdo de ${file} no JS inicial`);
}
const initialSize = rows.filter((r) => initial.includes(r.file));
console.log(
  `\nJS inicial (entrada + modulepreload): ${kb(initialSize.reduce((n, r) => n + r.size, 0))} minificado, ${kb(initialSize.reduce((n, r) => n + r.gzip, 0))} gzip.`,
);

const initialGzip = initialSize.reduce((n, r) => n + r.gzip, 0);
if (initialGzip > INITIAL_GZIP_BUDGET)
  problems.push(`JS inicial tem ${kb(initialGzip)} gzip (limite ${kb(INITIAL_GZIP_BUDGET)})`);

if (problems.length > 0) {
  console.error('\n✗ Orçamento de bundle estourado:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`\n✓ Orçamento ok: entrada ${kb(rows.find((r) => r.file === entry)?.size ?? 0)}.`);
