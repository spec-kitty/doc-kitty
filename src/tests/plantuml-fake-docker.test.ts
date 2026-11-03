/**
 * The strict fake `docker` must not be permissive: any argv outside its accepted
 * shapes exits 125. One smoke test proves an accepted shape works; the CLI and
 * halves tests exercise the fake's env knobs everywhere else.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FAKE_DOCKER_DIR, canaryPort, closeAll, runCheck } from './helpers/plantuml-check-harness';

const FAKE = path.join(FAKE_DOCKER_DIR, 'docker');
const INSPECT_FILE = path.resolve(FAKE_DOCKER_DIR, '../plantuml-include-check/inspect-sandbox.json');

afterEach(closeAll);

function docker(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ stdout: string; stderr: string; exit: number }>((resolve, reject) => {
    const child = spawn(FAKE, args, { env: { ...process.env, PATH: `${FAKE_DOCKER_DIR}${path.delimiter}${process.env.PATH}`, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout, stderr, exit: code ?? -1 }));
  });
}

const INSPECT = ['inspect', '--type', 'container', '-f', '{{json .Config.Env}}', 'c'];
const INSPECT_ARGS = ['inspect', '--type', 'container', '-f', '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]', 'c'];

describe('fake docker', () => {
  it('smoke: an accepted inspect prints the file named by DK_FAKE_DOCKER_INSPECT_FILE', async () => {
    const r = await docker(INSPECT, { DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE });
    expect(r).toMatchObject({ exit: 0, stderr: '' });
    expect(r.stdout).toBe(readFileSync(INSPECT_FILE, 'utf8'));
  });

  it.each([
    ['docker ps', ['ps']],
    ['inspect without -f', ['inspect', 'c']],
    ['inspect without --type container', ['inspect', '-f', '{{json .Config.Env}}', 'c']],
    ['network-mode inspect without json', ['inspect', '--type', 'container', '-f', '{{.HostConfig.NetworkMode}}', 'c']],
    ['inspect with an extra arg', ['inspect', '--type', 'container', '-f', '{{json .Config.Env}}', 'c', 'extra']],
    ['exec with the wrong curl flag', ['exec', 'c', 'curl', '-s', '--max-time', '5', '-o', '/dev/null', 'http://x/']],
    ['inspect with the wrong format', ['inspect', '--type', 'container', '-f', '{{.Config.Env}}', 'c']],
    ['command-line inspect without the brackets', ['inspect', '--type', 'container', '-f', '{{json .Config.Entrypoint}} {{json .Config.Cmd}} {{json .Args}}', 'c']],
    ['command-line inspect with an extra arg', [...INSPECT_ARGS, 'extra']],
    ['ports inspect without json', ['inspect', '--type', 'container', '-f', '{{.NetworkSettings.Ports}}', 'c']],
  ])('rejects %s with 125', async (_name, args) => {
    const r = await docker(args);
    expect(r.exit).toBe(125);
    expect(r.stderr).toBe(`fake docker: unexpected argv: ${JSON.stringify(args)}\n`);
  });
});

describe('runCheck', () => {
  it.each([
    [['--bogus'], 'unknown or incomplete argument'],
  ])('pathMode node-only still starts the CLI; usage error %j exits 2 (docker missing)', async (args, message) => {
    const r = await runCheck(args, { pathMode: 'node-only' });
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain(message);
  });

  it('canaryPort never hands out the same port twice in one process, and below the ephemeral range', async () => {
    const ports = await Promise.all(Array.from({ length: 20 }, () => canaryPort()));
    expect(new Set(ports).size).toBe(ports.length);
    for (const port of ports) expect(port >= 20000 && port < 30000).toBe(true);
  });
});
