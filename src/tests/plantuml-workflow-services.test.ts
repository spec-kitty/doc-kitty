/**
 * Inventory of every PlantUML service in every workflow (#268, FR-014).
 *
 * This test finds services BY IMAGE across ALL workflow files, so a new
 * service cannot slip in unchecked (it absorbed the former
 * plantuml-service-hardening.test.ts, #251, which checked only the first block
 * per workflow). Every one is SANDBOX and pinned, except the
 * ci.yml `plantuml-allowlist` lane: ALLOWLIST, pinned, canary-host entries only,
 * never INTERNET (NFR-001 static half, C-001, C-004, C-005).
 *
 * The second describe pins the lane against being neutered: without its verdict
 * grep or flags it would go green while proving nothing. (ci-ok wiring is not
 * pinned here: a missing lane result is RED at runtime, see
 * .github/scripts/ci-ok-decision.test.mjs.)
 *
 * Text parsing only (no YAML dependency), as in plantuml-service-hardening.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const WORKFLOW_DIR = new URL('.github/workflows/', ROOT);
const read = (rel: string) => readFileSync(new URL(rel, ROOT), 'utf8');

const PINNED_IMAGE =
  /^plantuml\/plantuml-server:jetty-v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/;
const LANE_JOB = 'plantuml-allowlist';
const VERDICT = 'verdict: declared allowlist, observed allowlist';

const workflowFiles = readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f));

interface Service {
  file: string;
  job: string;
  key: string;
  image: string;
  block: string;
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/** Text of job `job` (from its key to the next job key), or '' when absent. */
function jobBlock(workflow: string, job: string): string {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => l === `  ${job}:`);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '' && !lines[i].trimStart().startsWith('#') && indentOf(lines[i]) <= 2) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/** Every service (any key) in every job whose `image:` is a plantuml-server image. */
function findServices(file: string, text: string): Service[] {
  const lines = text.split('\n');
  const found: Service[] = [];
  let job = '';
  for (let i = 0; i < lines.length; i++) {
    const jobMatch = /^ {2}([\w-]+):\s*$/.exec(lines[i]);
    if (jobMatch) job = jobMatch[1];
    // `services:` at job level (4 spaces); each service key sits at 6.
    if (!/^ {4}services:\s*$/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) > 4)) j++;
    const body = lines.slice(i + 1, j);
    let k = 0;
    while (k < body.length) {
      const keyMatch = /^ {6}([\w-]+):\s*$/.exec(body[k]);
      if (!keyMatch) { k++; continue; }
      let m = k + 1;
      while (m < body.length && (body[m].trim() === '' || indentOf(body[m]) > 6)) m++;
      const block = body.slice(k, m).join('\n');
      const image = /^\s*image:\s*(\S+)\s*$/m.exec(block)?.[1] ?? '';
      if (image.startsWith('plantuml/plantuml-server')) {
        found.push({ file, job, key: keyMatch[1], image, block });
      }
      k = m;
    }
    i = j - 1;
  }
  return found;
}

const envValue = (block: string, name: string) =>
  new RegExp(`^\\s*${name}:\\s*"?([^"\\n]*?)"?\\s*(?:#.*)?$`, 'm').exec(block)?.[1];

const texts = new Map(workflowFiles.map((f) => [f, read(`.github/workflows/${f}`)]));
const services = [...texts].flatMap(([f, t]) => findServices(f, t));
const isLane = (s: Service) => s.file === 'ci.yml' && s.job === LANE_JOB;

describe('every PlantUML service in every workflow (#268, FR-014)', () => {
  it('finds the services (a parser that finds none cannot pass)', () => {
    const filesMentioning = [...texts].filter(([, t]) => t.includes('plantuml-server')).map(([f]) => f);
    expect(filesMentioning.length).toBeGreaterThan(0);
    expect(services.length).toBeGreaterThanOrEqual(filesMentioning.length);
    // Every file that names the image has a service found in it.
    for (const f of filesMentioning) {
      expect(services.some((s) => s.file === f), `a service is found in ${f}`).toBe(true);
    }
    expect(services.filter(isLane)).toHaveLength(1);
    expect(services.filter((s) => envValue(s.block, 'PLANTUML_SECURITY_PROFILE') === 'ALLOWLIST')).toHaveLength(1);
  });

  it('runs no `docker run` of the image outside a service block', () => {
    for (const [f, t] of texts) {
      expect(t, f).not.toMatch(/docker run[^\n]*plantuml-server/);
    }
  });

  for (const s of services) {
    describe(`${s.file} › ${s.job} › ${s.key}`, () => {
      it('runs the shared digest-pinned image (C-005)', () => {
        expect(s.image).toMatch(PINNED_IMAGE);
      });

      if (isLane(s)) {
        it('is ALLOWLIST with canary-host entries only (NFR-001)', () => {
          expect(envValue(s.block, 'PLANTUML_SECURITY_PROFILE')).toBe('ALLOWLIST');
          const entries = (envValue(s.block, 'PLANTUML_ALLOWLIST_URL') ?? '').split(';');
          expect(entries.length).toBeGreaterThan(0);
          for (const e of entries) expect(e).toMatch(/^http:\/\/dk-canary:/);
          expect(s.block).toContain('--add-host dk-canary:host-gateway');
        });
      } else {
        it('is SANDBOX (C-001)', () => {
          expect(envValue(s.block, 'PLANTUML_SECURITY_PROFILE')).toBe('SANDBOX');
        });
      }
    });
  }

  it('all services share one image pin', () => {
    expect(new Set(services.map((s) => s.image)).size).toBe(1);
  });

  it('the consumer guide shows the same pin and profile, with no floating tag (#251)', () => {
    const guide = read('docs/guides/consumer-setup.md');
    expect(guide).toContain(services[0].image);
    expect(guide).toMatch(/PLANTUML_SECURITY_PROFILE[=:]\s*SANDBOX/);
    expect(guide).not.toMatch(/plantuml\/plantuml-server:jetty(?![-\w])/);
  });

  it('ci.yml proves the refusal against the live service, between the wait and the build (#251)', () => {
    const ci = texts.get('ci.yml')!;
    const wait = ci.indexOf('name: Wait for the PlantUML server');
    const check = ci.indexOf('name: Assert PlantUML refuses remote includes');
    const build = ci.indexOf('name: Build example site');
    expect(wait).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(wait);
    expect(build).toBeGreaterThan(check);
    const step = ci.slice(check, build);
    expect(step).toContain('src/scripts/assert-plantuml-no-remote-include.mjs');
    expect(step).toContain('--service-container "${{ job.services.plantuml.id }}"');
    expect(step).toContain('--canary-host');
  });

  it('no workflow selects INTERNET or mentions plantuml.com (C-004)', () => {
    // Comments may say "NEVER plantuml.com"; only live (non-comment) lines count.
    for (const [f, t] of texts) {
      const live = t.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
      expect(live, f).not.toMatch(/PLANTUML_SECURITY_PROFILE:\s*"?INTERNET/);
      expect(live, f).not.toContain('plantuml.com');
    }
  });
});

describe('plantuml-allowlist lane is not vacuous', () => {
  const ci = texts.get('ci.yml')!;
  const lane = jobBlock(ci, LANE_JOB);
  const stepStart = lane.indexOf('name: Include check in declared allowlist mode');
  const step = stepStart === -1 ? '' : lane.slice(stepStart);

  it('exists, runs on code or workflow changes (not paused), depends only on detect-changes', () => {
    expect(lane).not.toBe('');
    // Path-scoped: run_code_quality is code || workflows and is off when paused.
    expect(lane).toMatch(/^ {4}if: needs\.detect-changes\.outputs\.run_code_quality == 'true'$/m);
    expect(lane).toMatch(/^ {4}needs: detect-changes$/m);
    expect(lane).not.toContain('run_build_example');
  });

  it('check step carries every flag, pipefail, and the verdict grep', () => {
    expect(step).not.toBe('');
    for (const needle of [
      'set -o pipefail',
      'DK_PLANTUML_ALLOW_EXTERNAL=',
      '--canary-host dk-canary',
      '--canary-port 18091',
      '--service-container "${{ job.services.plantuml.id }}"',
      `grep -F '${VERDICT}'`,
      'node src/scripts/assert-plantuml-no-remote-include.mjs',
    ]) {
      expect(step, needle).toContain(needle);
    }
    expect(step).not.toContain('pnpm exec');
  });

  it('leaves build-example SANDBOX with its include-check step intact (C-001)', () => {
    const be = jobBlock(ci, 'build-example');
    expect(envValue(be, 'PLANTUML_SECURITY_PROFILE')).toBe('SANDBOX');
    expect(be).toContain(
      [
        '      - name: Assert PlantUML refuses remote includes',
        '        run: |',
        `          GATEWAY=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' "\${{ job.services.plantuml.id }}")`,
        '          node src/scripts/assert-plantuml-no-remote-include.mjs \\',
        '            --server http://localhost:8091/svg/ \\',
        '            --canary-host "$GATEWAY" \\',
        '            --service-container "${{ job.services.plantuml.id }}"',
      ].join('\n'),
    );
  });
});
