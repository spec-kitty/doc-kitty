/**
 * The only code that runs `docker` for the PlantUML include check's declared modes and the
 * unset-mode profile read (#268). It reads, never changes: exactly four argv shapes, and it
 * never starts, stops, runs or removes anything (C-003).
 *
 *   docker inspect -f '{{json .Config.Env}}' <container>
 *   docker inspect -f '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]' <container>
 *   docker inspect -f '{{json .NetworkSettings.Ports}}' <container>
 *   docker exec <container> curl -sf --max-time 5 -o /dev/null <url>
 *
 * The ports read ties a local `--server` to the container (a decoy container cannot vouch
 * for another service). The command-line read exists because `docker run <image> -D…` puts Java system properties on the
 * container command line, out of reach of the env read; the caller fails closed on them.
 *
 * All work with a GitHub Actions service id or a container name (spike: GO, services block).
 * The env array also holds runner-injected (`GITHUB_ACTIONS`, `CI`) and image variables in
 * varying order, so callers pick `PLANTUML_SECURITY_PROFILE` and `PLANTUML_ALLOWLIST_URL`
 * by name from the returned map.
 *
 * Node built-ins only (C-006).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ServiceConfigError, parseContainerArgs, parseContainerEnv, parseContainerPorts } from './plantuml-mode-check.mjs';

const run = promisify(execFile);

/** The one template of the command-line read: a JSON array of entrypoint, cmd and args. */
export const ARGS_TEMPLATE = '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]';

/** Why a `docker` call failed, in one short line. */
function failureReason(err) {
  if (err?.code === 'ENOENT') return 'docker not found on PATH';
  const stderr = typeof err?.stderr === 'string' ? err.stderr.trim().split('\n').pop() : '';
  const exit = typeof err?.code === 'number' ? `docker inspect exited ${err.code}` : 'docker inspect failed';
  return stderr ? `${exit}: ${stderr}` : exit;
}

/**
 * The service container's environment as a map (keys by name; order irrelevant).
 *
 * @param {string} container service id or container name
 * @returns {Promise<Record<string, string>>}
 * @throws {ServiceConfigError} docker missing, erroring, or output that is not a JSON array of `KEY=VALUE`
 */
export async function readServiceEnv(container) {
  let stdout;
  try {
    ({ stdout } = await run('docker', ['inspect', '-f', '{{json .Config.Env}}', container]));
  } catch (err) {
    throw new ServiceConfigError(failureReason(err));
  }
  return parseContainerEnv(stdout);
}

/**
 * The service container's command line: its entrypoint, command and args as one flat list.
 *
 * @param {string} container service id or container name
 * @returns {Promise<string[]>}
 * @throws {ServiceConfigError} docker missing, erroring, or output not of the template's shape
 */
export async function readServiceArgs(container) {
  let stdout;
  try {
    ({ stdout } = await run('docker', ['inspect', '-f', ARGS_TEMPLATE, container]));
  } catch (err) {
    throw new ServiceConfigError(failureReason(err));
  }
  return parseContainerArgs(stdout);
}

/** The one template of the published-ports read. */
export const PORTS_TEMPLATE = '{{json .NetworkSettings.Ports}}';

/**
 * The service container's published ports.
 *
 * @param {string} container service id or container name
 * @returns {Promise<{ containerPort: string, hostIp: string, hostPort: number }[]>}
 * @throws {ServiceConfigError} docker missing, erroring, or output not of the template's shape
 */
export async function readServicePorts(container) {
  let stdout;
  try {
    ({ stdout } = await run('docker', ['inspect', '-f', PORTS_TEMPLATE, container]));
  } catch (err) {
    throw new ServiceConfigError(failureReason(err));
  }
  return parseContainerPorts(stdout);
}

/**
 * A probe that fetches `url` from inside the service container: the argv the unset path
 * has always used. Rejects when curl fails (the caller judges reachability from the canary log).
 *
 * @param {string} container service id or container name
 * @returns {(url: string) => Promise<void>}
 */
export function dockerProbe(container) {
  return async (url) => {
    await run('docker', ['exec', container, 'curl', '-sf', '--max-time', '5', '-o', '/dev/null', url]);
  };
}
