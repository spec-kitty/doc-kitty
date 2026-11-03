/**
 * NFR-003 (#268, WP09): the build and the include check resolve the PlantUML opt-in
 * identically. Black box at both ends: the build side is the REAL `defineDocKittyIntegrations`
 * evaluated through the real site-config evaluator (the fixture's `indexBasename: ['PARITY']`
 * read back as `names` proves it ran); the check side is the real CLI.
 *
 * Build-side capture: `evaluateSiteConfig` runs the `--evaluate` child with `spawnSync` and
 * discards its stderr, where `defineDocKittyIntegrations` prints the FR-003 notice
 * (`console.warn`). So the build side spawns that same `--evaluate` child entry point
 * directly, with the same cleaned environment and working directory, and keeps stderr.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, startFakePlantuml, runCheck } from './helpers/plantuml-check-harness';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, 'fixtures/plantuml-opt-in-site');
const ASTRO_CONFIG = path.join(SITE, 'astro.config.mjs');
const NO_INTEGRATION_CONFIG = path.join(SITE, 'no-integration.config.mjs');
const EVAL = path.resolve(HERE, '../scripts/site-config-eval.mjs');
const TIMEOUT = 60_000;

type Resolution = { mode: string; entries: string[]; source: string };
const SANDBOX: Resolution = { mode: 'sandbox', entries: [], source: 'default' };
const A = 'https://a.example/x/';
const B = 'https://b.example/y/';

interface Cell {
  name: string;
  /** DK_PARITY_SITE_VALUE: absent | undefined | JSON of the option. */
  knob: string;
  /** DK_PLANTUML_ALLOW_EXTERNAL; null: not set. */
  env: string | null;
  expected: Resolution;
  /** Expected FR-003 notice: none, or the text it must contain. */
  notice: null | { contains: string[] };
}

const alist = (entries: string[], source: string): Resolution => ({ mode: 'allowlist', entries, source });
const internet = (source: string): Resolution => ({ mode: 'internet', entries: [], source });
const ENV_LABEL = 'environment DK_PLANTUML_ALLOW_EXTERNAL';
const allowNotice = (label: string, entries: string[]) => ({
  contains: [`declared PlantUML allowlist mode (from ${label})`, ...entries, '--astro-config'],
});
const internetNotice = (label: string) => ({
  contains: ['WARNING: declared PlantUML internet mode', `(from ${label})`, '--astro-config'],
});

const CELLS: Cell[] = [
  { name: 'site only / unset', knob: 'absent', env: null, expected: SANDBOX, notice: null },
  { name: 'site only / allowlist', knob: JSON.stringify([A]), env: null, expected: alist([A], 'site configuration'), notice: allowNotice('site configuration', [A]) },
  { name: 'site only / internet', knob: '"internet"', env: null, expected: internet('site configuration'), notice: internetNotice('site configuration') },
  { name: 'env only / unset', knob: 'absent', env: '', expected: SANDBOX, notice: null },
  { name: 'env only / allowlist', knob: 'absent', env: A, expected: alist([A], 'environment'), notice: allowNotice(ENV_LABEL, [A]) },
  { name: 'env only / internet', knob: 'absent', env: 'internet', expected: internet('environment'), notice: internetNotice(ENV_LABEL) },
  { name: 'both / unset', knob: 'undefined', env: '   ', expected: SANDBOX, notice: null },
  { name: 'both / allowlist (env wins)', knob: JSON.stringify([B]), env: A, expected: alist([A], 'environment'), notice: allowNotice(ENV_LABEL, [A]) },
  { name: 'both / internet (env wins)', knob: JSON.stringify([B]), env: 'internet', expected: internet('environment'), notice: internetNotice(ENV_LABEL) },
  { name: 'E5 (blank env, site value kept)', knob: JSON.stringify([B]), env: '', expected: alist([B], 'site configuration'), notice: allowNotice('site configuration', [B]) },
];

/** Site-only allowlist/internet are invisible without --astro-config (the spec's Limits). */
const SITE_ONLY_VISIBLE = new Set(['site only / allowlist', 'site only / internet', 'E5 (blank env, site value kept)']);

function cellEnv(cell: Cell): Record<string, string | undefined> {
  return { DK_PARITY_SITE_VALUE: cell.knob, DK_PLANTUML_ALLOW_EXTERNAL: cell.env ?? undefined };
}

interface BuildResult {
  resolution: Resolution | null;
  names: string[] | null;
  notice: string[];
}

/** The build side: the real config, evaluated in the evaluator's own child, stderr kept. */
function buildSide(
  env: Record<string, string | undefined>,
  config: string = ASTRO_CONFIG,
): Promise<BuildResult> {
  const childEnv: Record<string, string | undefined> = { ...process.env };
  for (const name of ['DK_PLANTUML_ALLOW_EXTERNAL', 'DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED', 'DK_PARITY_SITE_VALUE', 'DK_INDEX_BASENAME']) {
    delete childEnv[name];
  }
  for (const [k, v] of Object.entries(env)) if (v !== undefined) childEnv[k] = v;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [EVAL, '--evaluate', config, path.dirname(config)], {
      cwd: path.dirname(config),
      env: childEnv as NodeJS.ProcessEnv,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.once('error', reject);
    child.once('close', () => {
      const answer = JSON.parse(stdout.trim().split('\n').pop() ?? '');
      if (!answer.ok) return reject(new Error(`config evaluation failed: ${answer.message}`));
      resolve({
        resolution: answer.plantumlAllowExternal,
        names: answer.names,
        notice: stderr.split('\n').filter((l) => l.startsWith('[dk-plantuml]')),
      });
    });
  });
}

async function checkSide(env: Record<string, string | undefined>, astroConfig: string | null): Promise<Resolution> {
  const args = [...(astroConfig ? ['--astro-config', astroConfig] : []), '--print-declared'];
  const defined: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) defined[k] = v;
  const res = await runCheck(args, { env: defined });
  expect(res.exit).toBe(0);
  const lines = res.stdout.trimEnd().split('\n');
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]);
}

afterEach(closeAll);

describe('NFR-003: 9 of 9 (+E5) with --astro-config', () => {
  it.each(CELLS)('$name: build and check agree', async (cell) => {
    const build = await buildSide(cellEnv(cell));
    const check = await checkSide(cellEnv(cell), ASTRO_CONFIG);
    // The real defineDocKittyIntegrations ran (a stub could not publish this name).
    expect(build.names).toEqual(['PARITY']);
    expect(build.resolution).toEqual(cell.expected);
    expect(check).toEqual(build.resolution);
  }, TIMEOUT);
});

describe('FR-003 notice per source (US4 AS3)', () => {
  it.each(CELLS)('$name', async (cell) => {
    const { notice } = await buildSide(cellEnv(cell));
    if (cell.notice === null) {
      expect(notice).toEqual([]);
      return;
    }
    expect(notice).toHaveLength(1);
    for (const part of cell.notice.contains) expect(notice[0]).toContain(part);
    if (cell.expected.mode === 'internet') expect(notice[0]).toContain('WARNING');
    else expect(notice[0]).not.toContain('WARNING');
  }, TIMEOUT);
});

describe('without --astro-config (the amended NFR-003 sentence)', () => {
  it.each(CELLS)('$name', async (cell) => {
    const build = await buildSide(cellEnv(cell));
    const check = await checkSide(cellEnv(cell), null);
    if (SITE_ONLY_VISIBLE.has(cell.name)) {
      // The limit is pinned: a site-configuration-only value is not seen without the config path.
      expect(build.resolution).not.toEqual(SANDBOX);
      expect(check).toEqual(SANDBOX);
    } else {
      expect(check).toEqual(build.resolution);
    }
  }, TIMEOUT);

  it('names that site configuration was not read (declared first line, env internet)', async () => {
    const fake = await startFakePlantuml('refuse');
    const res = await runCheck(['--server', fake.url, '--canary-host', '127.0.0.1'], {
      env: { DK_PLANTUML_ALLOW_EXTERNAL: 'internet' },
      fakeDocker: true,
    });
    const first = res.stdout.split('\n')[0];
    expect(first).toMatch(/declared: internet \(from environment DK_PLANTUML_ALLOW_EXTERNAL\)/);
    expect(first.endsWith('; site configuration not read (no --astro-config)')).toBe(true);
  }, TIMEOUT);

  it('positive control: with --astro-config the same first line has no such suffix', async () => {
    const fake = await startFakePlantuml('refuse');
    const res = await runCheck(
      ['--astro-config', NO_INTEGRATION_CONFIG, '--server', fake.url, '--canary-host', '127.0.0.1'],
      { env: { DK_PLANTUML_ALLOW_EXTERNAL: 'internet' }, fakeDocker: true },
    );
    const first = res.stdout.split('\n')[0];
    expect(first).toContain('declared: internet');
    expect(first).not.toContain('site configuration not read');
  }, TIMEOUT);
});

describe('forged inherited DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED is ignored (A2b)', () => {
  const FORGED = '{"mode":"internet","entries":[],"source":"environment"}';

  it('check side, with and without --astro-config', async () => {
    const env = { DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED: FORGED, DK_PARITY_SITE_VALUE: 'absent' };
    expect(await checkSide(env, ASTRO_CONFIG)).toEqual(SANDBOX);
    expect(await checkSide(env, null)).toEqual(SANDBOX);
  }, TIMEOUT);

  it('build side: the config discards it', async () => {
    const build = await buildSide({ DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED: FORGED, DK_PARITY_SITE_VALUE: 'absent' });
    expect(build.names).toEqual(['PARITY']);
    expect(build.resolution).toEqual(SANDBOX);
  }, TIMEOUT);
});

describe('null child answer (A2a)', () => {
  it('a config that never calls defineDocKittyIntegrations falls back to env-only', async () => {
    const env = { DK_PLANTUML_ALLOW_EXTERNAL: 'internet' };
    expect((await buildSide(env, NO_INTEGRATION_CONFIG)).resolution).toBeNull();
    expect(await checkSide(env, NO_INTEGRATION_CONFIG)).toEqual(internet('environment'));
    // Control: with nothing declared, the same fallback is sandbox.
    expect(await checkSide({}, NO_INTEGRATION_CONFIG)).toEqual(SANDBOX);
  }, TIMEOUT);
});
