/**
 * Reproducible Lighthouse (Phase 7): production build → `vite preview` → Lighthouse mobile
 * (default emulation + simulated throttling), 3 runs per page, median per category.
 * Fails (exit 1) if any median is below 90. Reports go to lighthouse-reports/ (git-ignored).
 *
 * Uses port 4174: 4173 belongs to Playwright (it reuses a running server, and must never
 * pick up this non-E2E build).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LIGHTHOUSE = 'lighthouse@13.6.0';
const PORT = 4174;
const RUNS = 3;
const MIN_SCORE = 90;
const PAGES = [
  { path: '/', slug: 'trilha' },
  { path: '/boas-vindas', slug: 'boas-vindas' },
];
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
/** Gated categories (plan: ≥ 90); SEO is reported only. */
const GATED: readonly string[] = ['performance', 'accessibility', 'best-practices'];
const OUT = join(import.meta.dirname, '..', 'lighthouse-reports');

function findChrome(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const system = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ].find(existsSync);
  if (system) return undefined; // Lighthouse finds the system Chrome by itself.
  // Fall back to the Chromium downloaded by Playwright.
  const cache =
    process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dir = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .at(-1);
  if (!dir) return undefined;
  const candidates = [
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
  ].map((p) => join(cache, dir, p));
  return candidates.find(existsSync);
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falhou (${result.status})`);
}

async function waitForServer(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

async function main() {
  // Production build: never with the E2E hooks or the demo unit.
  const env = { ...process.env };
  delete env.VITE_E2E;
  delete env.VITE_DEMO;
  run('npm', ['run', 'build'], env);

  mkdirSync(OUT, { recursive: true });
  let preview: ChildProcess | undefined;
  try {
    const vite = join(import.meta.dirname, '..', 'node_modules', '.bin', 'vite');
    preview = spawn(vite, ['preview', '--port', String(PORT), '--strictPort'], {
      stdio: 'ignore',
      env,
    });
    const stop = () => {
      preview?.kill();
      process.exit(130);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const base = `http://localhost:${PORT}`;
    await waitForServer(base);

    const chrome = findChrome();
    const lhEnv = chrome ? { ...env, CHROME_PATH: chrome } : env;
    if (chrome) console.log(`Usando Chromium: ${chrome}`);

    const table: { page: string; scores: Record<string, number> }[] = [];
    for (const page of PAGES) {
      const runs: Record<string, number[]> = {};
      for (let i = 1; i <= RUNS; i++) {
        const outPath = join(OUT, `${page.slug}-${i}`);
        console.log(`Lighthouse ${page.path} (${i}/${RUNS})…`);
        run(
          'npx',
          [
            '--yes',
            LIGHTHOUSE,
            `${base}${page.path}`,
            `--only-categories=${CATEGORIES.join(',')}`,
            '--output=json',
            '--output=html',
            `--output-path=${outPath}`,
            '--chrome-flags=--headless=new --no-first-run',
            '--quiet',
          ],
          lhEnv,
        );
        const report = JSON.parse(readFileSync(`${outPath}.report.json`, 'utf8')) as {
          categories: Record<string, { score: number | null }>;
        }; // Lighthouse JSON report (LHR) shape; only category scores are read
        for (const cat of CATEGORIES) {
          (runs[cat] ??= []).push(Math.round((report.categories[cat]?.score ?? 0) * 100));
        }
      }
      table.push({
        page: page.path,
        scores: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs[c] ?? [])])),
      });
      console.log(
        `  execuções: ${CATEGORIES.map((c) => `${c} ${runs[c]?.join('/')}`).join(' · ')}`,
      );
    }

    console.log(
      `\nLighthouse mobile — mediana de ${RUNS} (mínimo ${MIN_SCORE}; SEO só informativo)`,
    );
    console.log(`${'página'.padEnd(14)}${CATEGORIES.map((c) => c.padStart(16)).join('')}`);
    let failed = false;
    for (const row of table) {
      const cells = CATEGORIES.map((c) => {
        const score = row.scores[c] ?? 0;
        const bad = GATED.includes(c) && score < MIN_SCORE;
        if (bad) failed = true;
        return `${score}${bad ? ' ✗' : ''}`.padStart(16);
      });
      console.log(`${row.page.padEnd(14)}${cells.join('')}`);
    }
    console.log(`\nRelatórios em ${OUT}`);
    if (failed) {
      console.error(`✗ Alguma categoria abaixo de ${MIN_SCORE}.`);
      process.exitCode = 1;
    } else {
      console.log('✓ Lighthouse dentro da meta.');
    }
  } finally {
    preview?.kill();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
