/**
 * Draft publication in the workflows (sidebar-frame-header-carrier, FR-018;
 * WP07 review gap 3.6).
 *
 * The live site must publish no draft page. `deploy.yml` says so by setting
 * `DK_PUBLISH_DRAFTS: 'off'` on its build job. The toolkit default is `on`, so
 * that line is the only thing that keeps drafts off the live site, and nothing
 * else fails when it is removed or flipped to `on`: the deploy would publish
 * every draft and stay green. This file pins the line.
 *
 * It also pins the other half: the PR gate (`ci.yml`, job `build-example`)
 * builds with `on` for its own gates, then builds the draft-free variant into a
 * second directory and runs the gate scripts against THAT directory. They must
 * be called as `node <script> <dir>`: `pnpm assert:artifacts <dir>` appends the
 * argument after the script's own `example/dist`, so the gate would silently
 * check the drafts-on build.
 *
 * TEXT-based, like `regen-workflow-render-setup.test.ts`: no YAML parser is a
 * dependency of this repository. The helpers below cut a job out by its
 * two-space key, its `env:` block by indentation and its steps by the `- `
 * marker, and drop comment lines first, so a commented-out setting or a comment
 * that mentions a command cannot satisfy or trip an assertion.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoFile = (rel: string): string => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const readRepo = (rel: string): string => readFileSync(repoFile(rel), 'utf8');

const SETTING = 'DK_PUBLISH_DRAFTS';
const GATE_SCRIPTS = [
  'src/scripts/assert-build-artifacts.mjs',
  'src/scripts/assert-no-broken-links.mjs',
  'src/scripts/check-redirect-coverage.mjs',
];

/** The file without its comment-only lines. */
function withoutComments(text: string): string[] {
  return text.split('\n').filter((line) => !/^\s*#/.test(line));
}

/** The lines of one job: from its two-space key to the next two-space key. */
function jobLines(text: string, job: string): string[] {
  const lines = withoutComments(text);
  const start = lines.findIndex((line) => line === `  ${job}:`);
  if (start === -1) throw new Error(`job "${job}" not found`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {0,2}\S/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/** `key: value` pairs of the block under `<indent>env:`, quotes removed. */
function envOf(lines: string[], indent: number): Record<string, string> {
  const pad = ' '.repeat(indent);
  const start = lines.findIndex((line) => line === `${pad}env:`);
  const env: Record<string, string> = {};
  if (start === -1) return env;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    const m = new RegExp(`^${pad}  ([A-Za-z_][A-Za-z0-9_]*):\\s*(.*?)\\s*$`).exec(line);
    if (!m) break;
    env[m[1]] = m[2].replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

interface Step {
  name: string;
  env: Record<string, string>;
  /** The `run:` text, a block scalar joined with newlines. */
  run: string;
  uses: string;
}

/** The steps of a job, in order. */
function stepsOf(job: string[]): Step[] {
  const start = job.findIndex((line) => line === '    steps:');
  if (start === -1) throw new Error('job has no steps');
  const chunks: string[][] = [];
  for (const line of job.slice(start + 1)) {
    if (/^ {6}- /.test(line)) chunks.push([line.replace(/^ {6}- /, '        ')]);
    else if (chunks.length > 0) chunks[chunks.length - 1].push(line);
  }
  return chunks.map((chunk) => {
    const scalar = (key: string): string => {
      const at = chunk.findIndex((line) => line.startsWith(`        ${key}:`));
      if (at === -1) return '';
      const inline = chunk[at].slice(`        ${key}:`.length).trim();
      if (inline !== '|' && inline !== '>-' && inline !== '>') return inline;
      const body: string[] = [];
      for (const line of chunk.slice(at + 1)) {
        if (line.trim() !== '' && !line.startsWith('          ')) break;
        body.push(line.trim());
      }
      return body.join('\n');
    };
    return { name: scalar('name'), env: envOf(chunk, 8), run: scalar('run'), uses: scalar('uses') };
  });
}

describe('deploy.yml: the live build never publishes drafts (FR-018)', () => {
  const build = jobLines(readRepo('.github/workflows/deploy.yml'), 'build');

  it("the build job sets DK_PUBLISH_DRAFTS to 'off' explicitly", () => {
    const env = envOf(build, 4);
    expect(Object.keys(env), 'non-vacuity: the job-level env block was read').toContain('DK_DIAGRAM_BUILD_RENDER');
    expect(env[SETTING], `deploy.yml build job-level ${SETTING}`).toBe('off');
  });

  it('nothing else in the build job, and nothing in the shared build action, sets it', () => {
    const mentions = build.filter((line) => line.includes(SETTING));
    expect(mentions, 'one job-level line, no per-step override').toHaveLength(1);
    // Indentation pins the line to the job-level env block; quoting style and a
    // trailing comment are free to change.
    expect(mentions[0]).toMatch(new RegExp(`^ {6}${SETTING}:\\s*['"]?off['"]?\\s*(#.*)?$`));
    const steps = stepsOf(build);
    expect(steps.map((s) => s.uses)).toContain('./.github/actions/build-example');
    const action = withoutComments(readRepo('.github/actions/build-example/action.yml'));
    expect(action.length, 'non-vacuity: the action was read').toBeGreaterThan(10);
    expect(action.some((line) => /run:\s*pnpm build\s*$/.test(line)), 'the action runs the build').toBe(true);
    expect(action.filter((line) => line.includes(SETTING))).toEqual([]);
  });
});

describe('ci.yml: the PR gate builds with drafts on and asserts the drafts-off build', () => {
  const job = jobLines(readRepo('.github/workflows/ci.yml'), 'build-example');
  const steps = stepsOf(job);

  it("the build-example job sets DK_PUBLISH_DRAFTS to 'on' for its main build", () => {
    expect(envOf(job, 4)[SETTING], `ci.yml build-example job-level ${SETTING}`).toBe('on');
    const main = steps.find((s) => s.uses === './.github/actions/build-example');
    expect(main, 'the main build uses the shared action').toBeDefined();
    expect(main!.env[SETTING], 'the main build does not override the job-level value').toBeUndefined();
  });

  it('a later step builds with drafts off into its own output directory', () => {
    const mainAt = steps.findIndex((s) => s.uses === './.github/actions/build-example');
    const offAt = steps.findIndex((s) => s.env[SETTING] === 'off' && /^pnpm build\b/.test(s.run));
    expect(offAt, 'a `pnpm build` step with DK_PUBLISH_DRAFTS off').toBeGreaterThan(mainAt);
    const outDir = steps[offAt].env.DK_OUTDIR;
    expect(outDir, 'the drafts-off build has its own DK_OUTDIR').toMatch(/^[\w-]+$/);
    expect(outDir).not.toBe('dist');
  });

  it('every gate script runs with `node` against the drafts-off directory, with the setting off', () => {
    const offAt = steps.findIndex((s) => s.env[SETTING] === 'off' && /^pnpm build\b/.test(s.run));
    const dir = `example/${steps[offAt].env.DK_OUTDIR}`;
    const after = steps.slice(offAt + 1);
    for (const script of GATE_SCRIPTS) {
      expect(existsSync(repoFile(script)), `${script} exists`).toBe(true);
      const step = after.find((s) => s.run.startsWith(`node ${script} `));
      expect(step, `a step after the drafts-off build runs \`node ${script} …\``).toBeDefined();
      expect(step!.run.split(/\s+/), `${script} is given ${dir}`).toContain(dir);
      expect(step!.run, `${script} is not also given the drafts-on directory`).not.toMatch(/example\/dist(\s|$)/);
      expect(step!.env[SETTING], `${script} runs with ${SETTING} off`).toBe('off');
    }
  });

  it('no step reaches the drafts-off directory through a pnpm script', () => {
    const offAt = steps.findIndex((s) => s.env[SETTING] === 'off' && /^pnpm build\b/.test(s.run));
    const dir = `example/${steps[offAt].env.DK_OUTDIR}`;
    const using = steps.filter((s) => s.run.includes(dir));
    expect(using.length, 'non-vacuity: steps name the drafts-off directory').toBeGreaterThanOrEqual(GATE_SCRIPTS.length);
    for (const step of using) {
      for (const command of step.run.split('\n').filter((line) => line.includes(dir))) {
        expect(command, `"${step.name}" must call the script with node, not pnpm`).toMatch(/^node src\/scripts\/[\w-]+\.mjs /);
      }
    }
  });
});
