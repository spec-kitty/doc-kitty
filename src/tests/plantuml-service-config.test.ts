/**
 * The docker reader of the include check (#268, T057): `readServiceEnv`, `readServiceArgs`
 * and `dockerProbe` against the strict fake `docker`, fed with the real `docker inspect`
 * captures (env: the WP01 spike; command line: the pinned image, 2026-11-03).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CLI_PATH, FAKE_DOCKER_DIR, closeAll, trackServer } from './helpers/plantuml-check-harness';
import { ARGS_TEMPLATE, PORTS_TEMPLATE, dockerProbe, readServiceArgs, readServiceEnv, readServiceNetworkMode, readServicePorts } from '../scripts/plantuml-service-config.mjs';
import { ServiceConfigError } from '../scripts/plantuml-mode-check.mjs';

const CAPTURE = path.join(FAKE_DOCKER_DIR, 'inspect-capture.json');
const ARGS_PROPERTIES = path.join(FAKE_DOCKER_DIR, 'inspect-args-capture-properties.json');
const SPIKE_ALLOWLIST = 'http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/';
const SWITCHES = [
  'DK_FAKE_DOCKER_FAIL',
  'DK_FAKE_DOCKER_EXEC_FAIL',
  'DK_FAKE_DOCKER_EXEC_FAIL_MATCH',
  'DK_FAKE_DOCKER_INSPECT_FAIL',
  'DK_FAKE_DOCKER_INSPECT_FILE',
  'DK_FAKE_DOCKER_ARGS_FILE',
  'DK_FAKE_DOCKER_PORTS_FILE',
  'DK_FAKE_DOCKER_PUBLISHED_PORT',
  'DK_FAKE_DOCKER_LOG',
];

let saved: NodeJS.ProcessEnv;
let tmp: string;

beforeEach(() => {
  saved = { ...process.env };
  for (const name of SWITCHES) delete process.env[name];
  process.env.PATH = `${FAKE_DOCKER_DIR}${path.delimiter}${saved.PATH ?? ''}`;
  process.env.DK_FAKE_DOCKER_INSPECT_FILE = CAPTURE;
  tmp = mkdtempSync(path.join(tmpdir(), 'dk-service-config-'));
});

afterEach(async () => {
  process.env = saved;
  rmSync(tmp, { recursive: true, force: true });
  await closeAll();
});

const loggedArgv = (log: string) =>
  readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

describe('inspect-capture.json fixture', () => {
  it('is a real capture: a JSON array with the profile and image-own variables', () => {
    const parsed = JSON.parse(readFileSync(CAPTURE, 'utf8'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((item: string) => item.startsWith('PLANTUML_SECURITY_PROFILE='))).toBe(true);
    expect(parsed.some((item: string) => item.startsWith('JAVA_HOME=') || item.startsWith('JETTY_'))).toBe(true);
    // Runner-injected variables sit between the PLANTUML_* keys (spike Q6).
    expect(parsed).toContain('GITHUB_ACTIONS=true');
  });
});

describe('readServiceEnv', () => {
  it('reads the profile and allowlist by name from the capture', async () => {
    const env = await readServiceEnv('c');
    expect(env.PLANTUML_SECURITY_PROFILE).toBe('ALLOWLIST');
    expect(env.PLANTUML_ALLOWLIST_URL).toBe(SPIKE_ALLOWLIST);
    expect(env.JAVA_HOME).toBe('/opt/java/openjdk');
  });

  it('is independent of the env array order', async () => {
    const reversed = path.join(tmp, 'reversed.json');
    const items = JSON.parse(readFileSync(CAPTURE, 'utf8')) as string[];
    writeFileSync(reversed, JSON.stringify([...items].reverse()));
    expect(JSON.parse(readFileSync(reversed, 'utf8'))[0]).not.toBe(items[0]);
    process.env.DK_FAKE_DOCKER_INSPECT_FILE = reversed;
    const env = await readServiceEnv('c');
    expect(env.PLANTUML_SECURITY_PROFILE).toBe('ALLOWLIST');
    expect(env.PLANTUML_ALLOWLIST_URL).toBe(SPIKE_ALLOWLIST);
  });

  it('maps a docker failure to ServiceConfigError', async () => {
    // Positive control on the same setup: without the switch it reads.
    await expect(readServiceEnv('c')).resolves.toBeTruthy();
    process.env.DK_FAKE_DOCKER_FAIL = '1';
    const err = await readServiceEnv('c').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceConfigError);
    expect((err as Error).message).toContain('could not read the service configuration');
    expect((err as Error).message).toContain('fake docker: forced failure');
  });

  it('maps a missing docker (ENOENT) to ServiceConfigError', async () => {
    const dir = mkdtempSync(path.join(tmp, 'node-only-'));
    symlinkSync(process.execPath, path.join(dir, 'node'));
    process.env.PATH = dir;
    const err = await readServiceEnv('c').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceConfigError);
    expect((err as Error).message).toBe('could not read the service configuration (docker not found on PATH)');
  });

  it('maps unparsable output to ServiceConfigError', async () => {
    const bad = path.join(tmp, 'bad.json');
    writeFileSync(bad, 'not json');
    process.env.DK_FAKE_DOCKER_INSPECT_FILE = bad;
    await expect(readServiceEnv('c')).rejects.toBeInstanceOf(ServiceConfigError);
  });

  it('runs exactly `docker inspect -f {{json .Config.Env}} <container>`', async () => {
    const log = path.join(tmp, 'docker.log');
    process.env.DK_FAKE_DOCKER_LOG = log;
    await readServiceEnv('c');
    expect(loggedArgv(log)).toEqual([['inspect', '--type', 'container', '-f', '{{json .Config.Env}}', 'c']]);
  });
});

describe('readServiceArgs', () => {
  it('reads the default capture: the pinned image run with no command', async () => {
    expect(await readServiceArgs('c')).toEqual(['/entrypoint.sh']);
  });

  it('reads -D words from Cmd and Args (real capture of `docker run <image> -D…`)', async () => {
    process.env.DK_FAKE_DOCKER_ARGS_FILE = ARGS_PROPERTIES;
    const args = await readServiceArgs('c');
    expect(args).toContain('-DPLANTUML_SECURITY_PROFILE=INTERNET');
    expect(args).toContain('-Dplantuml.allowlist.url=http://dk-inc:8000/');
  });

  it('maps a docker failure and unparsable output to ServiceConfigError', async () => {
    process.env.DK_FAKE_DOCKER_INSPECT_FAIL = '1';
    const err = await readServiceArgs('c').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceConfigError);
    expect((err as Error).message).toContain('fake docker: forced inspect failure');
    delete process.env.DK_FAKE_DOCKER_INSPECT_FAIL;
    const bad = path.join(tmp, 'bad.json');
    writeFileSync(bad, '["/entrypoint.sh"]');
    process.env.DK_FAKE_DOCKER_ARGS_FILE = bad;
    await expect(readServiceArgs('c')).rejects.toBeInstanceOf(ServiceConfigError);
  });

  it('runs exactly `docker inspect -f [{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}] <container>`', async () => {
    const log = path.join(tmp, 'docker.log');
    process.env.DK_FAKE_DOCKER_LOG = log;
    await readServiceArgs('c');
    expect(ARGS_TEMPLATE).toBe('[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]');
    expect(loggedArgv(log)).toEqual([['inspect', '--type', 'container', '-f', ARGS_TEMPLATE, 'c']]);
  });
});

describe('readServicePorts', () => {
  it('reads the real capture and runs exactly `docker inspect -f {{json .NetworkSettings.Ports}} <container>`', async () => {
    const log = path.join(tmp, 'docker.log');
    process.env.DK_FAKE_DOCKER_LOG = log;
    expect(await readServicePorts('c')).toEqual([
      { containerPort: '8080/tcp', hostIp: '0.0.0.0', hostPort: 18602 },
      { containerPort: '8080/tcp', hostIp: '::', hostPort: 18602 },
    ]);
    expect(PORTS_TEMPLATE).toBe('{{json .NetworkSettings.Ports}}');
    expect(loggedArgv(log)).toEqual([['inspect', '--type', 'container', '-f', PORTS_TEMPLATE, 'c']]);
  });

  it('maps a docker failure and unparsable output to ServiceConfigError', async () => {
    process.env.DK_FAKE_DOCKER_INSPECT_FAIL = '1';
    await expect(readServicePorts('c')).rejects.toBeInstanceOf(ServiceConfigError);
    delete process.env.DK_FAKE_DOCKER_INSPECT_FAIL;
    const bad = path.join(tmp, 'bad.json');
    writeFileSync(bad, '[]');
    process.env.DK_FAKE_DOCKER_PORTS_FILE = bad;
    await expect(readServicePorts('c')).rejects.toBeInstanceOf(ServiceConfigError);
  });
});

describe('readServiceNetworkMode', () => {
  it('reads the mode and runs exactly `docker inspect --type container -f {{json .HostConfig.NetworkMode}} <container>`', async () => {
    const log = path.join(tmp, 'docker.log');
    process.env.DK_FAKE_DOCKER_LOG = log;
    expect(await readServiceNetworkMode('c')).toBe('bridge');
    process.env.DK_FAKE_DOCKER_NETWORK_MODE = 'host';
    expect(await readServiceNetworkMode('c')).toBe('host');
    expect(loggedArgv(log)[0]).toEqual(['inspect', '--type', 'container', '-f', '{{json .HostConfig.NetworkMode}}', 'c']);
  });
});

describe('dockerProbe', () => {
  async function listen(): Promise<{ url: string; hits: string[] }> {
    const hits: string[] = [];
    const server = trackServer(
      createServer((req, res) => {
        hits.push(req.url ?? '');
        res.writeHead(200).end('ok');
      }),
    );
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/dk-canary/allowed/probe`, hits };
  }

  it('runs exactly `docker exec <c> curl -sf --max-time 5 -o /dev/null <url>` and fetches the url', async () => {
    const { url, hits } = await listen();
    const log = path.join(tmp, 'docker.log');
    process.env.DK_FAKE_DOCKER_LOG = log;
    await dockerProbe('c')(url);
    expect(loggedArgv(log)).toEqual([['exec', 'c', 'curl', '-sf', '--max-time', '5', '-o', '/dev/null', url]]);
    expect(hits).toEqual(['/dk-canary/allowed/probe']);
  });

  it('rejects when curl fails inside the container', async () => {
    const { url, hits } = await listen();
    process.env.DK_FAKE_DOCKER_EXEC_FAIL = '1';
    await expect(dockerProbe('c')(url)).rejects.toThrow();
    expect(hits).toEqual([]);
  });
});

/** Run the include-check CLI (or a copy of it) with the opt-in variables removed. */
function runCli(args: string[], cli = CLI_PATH): Promise<{ stdout: string; stderr: string; exit: number }> {
  const env = { ...process.env };
  delete env.DK_PLANTUML_ALLOW_EXTERNAL;
  delete env.DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout, stderr, exit: code ?? -1 }));
  });
}

describe('include-check CLI, --astro-config failures (exit 2)', () => {
  const SRC = path.resolve(FAKE_DOCKER_DIR, '../../..');

  it('a config that does not evaluate: "could not evaluate <path>", no --env-dir hint', async () => {
    // Positive control: a config that loads would not print the refusal; here it throws.
    const config = path.join(tmp, 'astro.config.mjs');
    writeFileSync(config, 'throw new Error("boom");\n');
    const r = await runCli(['--astro-config', config, '--print-declared']);
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain('assert-plantuml-no-remote-include: could not evaluate ');
    expect(r.stderr).not.toContain('--env-dir');
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(r.stdout).toBe('');
  });

  it('a missing config file exits 2 and names it', async () => {
    const r = await runCli(['--astro-config', path.join(tmp, 'nope.mjs'), '--print-declared']);
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain('nope.mjs: no such file');
  });

  it('dependencies not installed: one line, no stack trace, exit 2', async () => {
    // A copy of scripts/ + lib/ with no node_modules anywhere above it.
    const copy = path.join(tmp, 'pkg');
    cpSync(path.join(SRC, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
    cpSync(path.join(SRC, 'lib'), path.join(copy, 'lib'), { recursive: true });
    const cli = path.join(copy, 'scripts/assert-plantuml-no-remote-include.mjs');
    const config = path.join(tmp, 'astro.config.mjs');
    writeFileSync(config, 'export default {};\n');

    // Positive control: the same copy runs fine without --astro-config (built-ins only, C-006).
    const control = await runCli(['--print-declared'], cli);
    expect(control).toMatchObject({ exit: 0, stderr: '' });
    expect(control.stdout).toBe('{"mode":"sandbox","entries":[],"source":"default"}\n');

    const r = await runCli(['--astro-config', config, '--print-declared'], cli);
    expect(r.exit).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain("--astro-config needs the site's dependencies installed");
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
});
