/**
 * Golden characterization of the include-check CLI in unset mode (#268, FR-007, SC-003).
 * goldens captured from 7fe56a5493e65182151a84db1dfed7fade733a0b (on main; the same src/ tree the goldens were captured from)
 *
 * Five cases, each frozen as stdout / stderr / exit under fixtures/plantuml-include-check/:
 *   refuse-no-container   fake refuses, no container: the "note —" line and OK line
 *   refuse-container      fake refuses, container given: OK "with the canary proven reachable"
 *   fetch                 fake fetches: FAIL "the server FETCHED the remote include"
 *   canary-unreachable    fake refuses, container probe fails: "probe failed" + "control: ... not reachable"
 *   control-fails         fake is broken: "control: a plain diagram did not render (HTTP 500)"
 *
 * The one normalization is the port number on loopback hosts (`normalizePorts`).
 * Regenerate with DK_UPDATE_GOLDENS=1 (refused when CI=true).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, normalizePorts, runCheck, startFakePlantuml, type CheckResult } from './helpers/plantuml-check-harness';

const GOLDEN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/plantuml-include-check');
const INSPECT_FILE = path.join(GOLDEN_DIR, 'inspect-sandbox.json');
const UPDATE = process.env.DK_UPDATE_GOLDENS === '1';

afterEach(closeAll);

if (UPDATE && process.env.CI === 'true') {
  it('refuses to update goldens in CI', () => {
    throw new Error('refusing to update goldens in CI');
  });
}

async function check(name: string, run: () => Promise<CheckResult>): Promise<CheckResult> {
  const raw = await run();
  const actual = { stdout: normalizePorts(raw.stdout), stderr: normalizePorts(raw.stderr), exit: raw.exit };
  const file = (ext: string) => path.join(GOLDEN_DIR, `golden-unset-${name}.${ext}`);
  if (UPDATE && process.env.CI !== 'true') {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(file('stdout'), actual.stdout);
    writeFileSync(file('stderr'), actual.stderr);
    writeFileSync(file('exit'), `${actual.exit}\n`);
  } else {
    expect(actual.stdout).toBe(readFileSync(file('stdout'), 'utf8'));
    expect(actual.stderr).toBe(readFileSync(file('stderr'), 'utf8'));
    expect(`${actual.exit}\n`).toBe(readFileSync(file('exit'), 'utf8'));
  }
  return actual;
}

const containerEnv = { DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE };

describe('include-check, unset mode (goldens)', () => {
  it('refuse-no-container', async () => {
    const fake = await startFakePlantuml('refuse');
    const out = await check('refuse-no-container', () => runCheck(['--server', fake.url]));
    expect(out.exit).toBe(0);
  });

  it('refuse-container', async () => {
    const fake = await startFakePlantuml('refuse');
    const out = await check('refuse-container', () =>
      runCheck(['--server', fake.url, '--service-container', 'fake'], { fakeDocker: true, env: containerEnv }),
    );
    expect(out.exit).toBe(0);
  });

  it('fetch', async () => {
    const fake = await startFakePlantuml('fetch');
    const out = await check('fetch', () => runCheck(['--server', fake.url]));
    expect(out.exit).toBe(1);
  });

  it('canary-unreachable', async () => {
    const fake = await startFakePlantuml('refuse');
    const out = await check('canary-unreachable', () =>
      runCheck(['--server', fake.url, '--service-container', 'fake'], {
        fakeDocker: true,
        env: { ...containerEnv, DK_FAKE_DOCKER_EXEC_FAIL: '1' },
      }),
    );
    expect(out.exit).toBe(1);
  });

  it('control-fails', async () => {
    const fake = await startFakePlantuml('refuse', { broken: true });
    const out = await check('control-fails', () => runCheck(['--server', fake.url]));
    expect(out.exit).toBe(1);
  });

  it('uses the same fixtures for the passing and the failing run (positive control)', async () => {
    const refusing = await startFakePlantuml('refuse');
    const fetching = await startFakePlantuml('fetch');
    const pass = await runCheck(['--server', refusing.url]);
    const fail = await runCheck(['--server', fetching.url]);
    expect(pass.exit).toBe(0);
    expect(fail.exit).toBe(1);
    expect(refusing.includes.map(normalizePorts)).toEqual(fetching.includes.map(normalizePorts));
    expect(refusing.includes.length).toBeGreaterThan(0);
  });
});
