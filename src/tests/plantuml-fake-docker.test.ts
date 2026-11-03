/** The strict fake `docker` rejects every argv except its four accepted shapes. */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { FAKE_DOCKER_DIR, canaryPort, closeAll, normalizePorts, runCheck, trackServer } from './helpers/plantuml-check-harness';

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

const INSPECT = ['inspect', '-f', '{{json .Config.Env}}', 'c'];
const INSPECT_ARGS = ['inspect', '-f', '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]', 'c'];
const ARGS_CAPTURE = path.join(FAKE_DOCKER_DIR, 'inspect-args-capture.json');
const ARGS_PROPERTIES = path.join(FAKE_DOCKER_DIR, 'inspect-args-capture-properties.json');
const INSPECT_PORTS = ['inspect', '-f', '{{json .NetworkSettings.Ports}}', 'c'];
const PORTS_CAPTURE = path.join(FAKE_DOCKER_DIR, 'inspect-ports-capture.json');
const execArgs = (url: string) => ['exec', 'c', 'curl', '-sf', '--max-time', '5', '-o', '/dev/null', url];

async function listen(status: number): Promise<string> {
  const server = trackServer(createServer((_req, res) => res.writeHead(status).end('x')));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/p`;
}

describe('fake docker', () => {
  it('is executable and resolved first on the PATH used by runCheck', () => {
    expect(path.dirname(FAKE)).toBe(FAKE_DOCKER_DIR);
  });

  it('inspect prints the file named by DK_FAKE_DOCKER_INSPECT_FILE', async () => {
    const r = await docker(INSPECT, { DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE });
    expect(r).toMatchObject({ exit: 0, stderr: '' });
    expect(r.stdout).toBe(readFileSync(INSPECT_FILE, 'utf8'));
  });

  it('the command-line inspect prints the recorded capture by default, or DK_FAKE_DOCKER_ARGS_FILE', async () => {
    const plain = await docker(INSPECT_ARGS);
    expect(plain).toMatchObject({ exit: 0, stderr: '' });
    expect(plain.stdout).toBe(readFileSync(ARGS_CAPTURE, 'utf8'));
    expect(plain.stdout).toBe('[["/entrypoint.sh"],null,[]]\n');
    const props = await docker(INSPECT_ARGS, { DK_FAKE_DOCKER_ARGS_FILE: ARGS_PROPERTIES });
    expect(props.stdout).toBe(readFileSync(ARGS_PROPERTIES, 'utf8'));
    expect(await docker(INSPECT_ARGS, { DK_FAKE_DOCKER_INSPECT_FAIL: '1' })).toMatchObject({
      exit: 1,
      stderr: 'fake docker: forced inspect failure\n',
    });
  });

  it('the ports inspect prints the real capture, with DK_FAKE_DOCKER_PUBLISHED_PORT as HostPort, or DK_FAKE_DOCKER_PORTS_FILE', async () => {
    const plain = await docker(INSPECT_PORTS);
    expect(plain).toMatchObject({ exit: 0, stderr: '' });
    expect(plain.stdout).toBe(readFileSync(PORTS_CAPTURE, 'utf8'));
    expect(plain.stdout).toBe('{"8080/tcp":[{"HostIp":"0.0.0.0","HostPort":"18602"},{"HostIp":"::","HostPort":"18602"}]}\n');
    const moved = await docker(INSPECT_PORTS, { DK_FAKE_DOCKER_PUBLISHED_PORT: '8091' });
    expect(moved.stdout).toBe('{"8080/tcp":[{"HostIp":"0.0.0.0","HostPort":"8091"},{"HostIp":"::","HostPort":"8091"}]}\n');
    expect((await docker(INSPECT_PORTS, { DK_FAKE_DOCKER_PORTS_FILE: ARGS_CAPTURE })).stdout).toBe(readFileSync(ARGS_CAPTURE, 'utf8'));
    expect((await docker(INSPECT_PORTS, { DK_FAKE_DOCKER_INSPECT_FAIL: '1' })).exit).toBe(1);
  });

  it('inspect without the file variable exits 1', async () => {
    const r = await docker(INSPECT, { DK_FAKE_DOCKER_INSPECT_FILE: '' });
    expect(r).toMatchObject({ exit: 1, stderr: 'fake docker: DK_FAKE_DOCKER_INSPECT_FILE not set\n' });
  });

  it('DK_FAKE_DOCKER_INSPECT_FAIL fails only inspect; exec still works', async () => {
    const env = { DK_FAKE_DOCKER_INSPECT_FAIL: '1', DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE };
    expect(await docker(INSPECT, env)).toMatchObject({ exit: 1, stderr: 'fake docker: forced inspect failure\n' });
    expect((await docker(execArgs(await listen(200)), env)).exit).toBe(0);
  });

  it('exec fetches the url: 0 on 2xx, 22 on error status, 7 on connection error', async () => {
    expect((await docker(execArgs(await listen(200)))).exit).toBe(0);
    expect(await docker(execArgs(await listen(404)))).toMatchObject({
      exit: 22,
      stderr: 'curl: (22) The requested URL returned error\n',
    });
    expect(await docker(execArgs('http://127.0.0.1:9/x'))).toMatchObject({
      exit: 7,
      stderr: 'curl: (7) Failed to connect\n',
    });
  });

  it('EXEC_FAIL and EXEC_FAIL_MATCH make exec exit 7 without fetching', async () => {
    const url = await listen(200);
    expect((await docker(execArgs(url), { DK_FAKE_DOCKER_EXEC_FAIL: '1' })).exit).toBe(7);
    expect((await docker(execArgs(url), { DK_FAKE_DOCKER_EXEC_FAIL_MATCH: '/p' })).exit).toBe(7);
    expect((await docker(execArgs(url), { DK_FAKE_DOCKER_EXEC_FAIL_MATCH: '/nomatch' })).exit).toBe(0);
  });

  it('DK_FAKE_DOCKER_FAIL exits 1 for every accepted form', async () => {
    const env = { DK_FAKE_DOCKER_FAIL: '1', DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE };
    expect(await docker(INSPECT, env)).toMatchObject({ exit: 1, stderr: 'fake docker: forced failure\n' });
    expect(await docker(execArgs('http://127.0.0.1:9/x'), env)).toMatchObject({ exit: 1 });
  });

  it('DK_FAKE_DOCKER_LOG appends one JSON line per call', async () => {
    const log = path.join(mkdtempSync(path.join(tmpdir(), 'dk-fd-')), 'log');
    await docker(INSPECT, { DK_FAKE_DOCKER_LOG: log, DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE });
    await docker(['ps'], { DK_FAKE_DOCKER_LOG: log });
    expect(readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l))).toEqual([INSPECT, ['ps']]);
  });

  it.each([
    ['docker ps', ['ps']],
    ['inspect without -f', ['inspect', 'c']],
    ['inspect with an extra arg', ['inspect', '-f', '{{json .Config.Env}}', 'c', 'extra']],
    ['exec with the wrong curl flag', ['exec', 'c', 'curl', '-s', '--max-time', '5', '-o', '/dev/null', 'http://x/']],
    ['inspect with the wrong format', ['inspect', '-f', '{{.Config.Env}}', 'c']],
    ['command-line inspect without the brackets', ['inspect', '-f', '{{json .Config.Entrypoint}} {{json .Config.Cmd}} {{json .Args}}', 'c']],
    ['command-line inspect with an extra arg', [...INSPECT_ARGS, 'extra']],
    ['ports inspect without json', ['inspect', '-f', '{{.NetworkSettings.Ports}}', 'c']],
  ])('rejects %s with 125', async (_name, args) => {
    const r = await docker(args);
    expect(r.exit).toBe(125);
    expect(r.stderr).toBe(`fake docker: unexpected argv: ${JSON.stringify(args)}\n`);
  });

  it('is deterministic: two failing exec calls give identical stderr', async () => {
    const a = await docker(execArgs('http://127.0.0.1:9/x'));
    const b = await docker(execArgs('http://127.0.0.1:9/x'));
    expect(a.stderr).toBe(b.stderr);
  });
});

describe('runCheck', () => {
  it('pathMode node-only still starts the CLI (docker missing, so the probe fails)', async () => {
    const r = await runCheck(['--bogus'], { pathMode: 'node-only' });
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain('unknown or incomplete argument');
  });

  it('canaryPort never hands out the same port twice in one process, and below the ephemeral range', async () => {
    const ports = await Promise.all(Array.from({ length: 20 }, () => canaryPort()));
    expect(new Set(ports).size).toBe(ports.length);
    for (const port of ports) expect(port >= 20000 && port < 30000).toBe(true);
  });

  it('normalizePorts rewrites loopback ports only', () => {
    expect(normalizePorts('http://127.0.0.1:4321/x localhost:80 example.com:99')).toBe(
      'http://127.0.0.1:<PORT>/x localhost:<PORT> example.com:99',
    );
  });
});
