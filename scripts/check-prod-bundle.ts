/**
 * Fails the production build if E2E/dev-only code leaked into dist/
 * (test hooks, simulated clock storage, design showcase route, demo unit).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  'importForTest',
  'falae-test-clock',
  'falae-e2e-onboarded',
  'seedSrs',
  'notificationPermission',
  '/dev/showcase',
  'Demo do motor de lição',
];
const dir = join(process.argv[2] ?? 'dist', 'assets');

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
