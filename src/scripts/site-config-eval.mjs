/**
 * Evaluate a site's `astro.config.*` once and read back the few values the CLI
 * gates need: the index names the integration published (`DK_INDEX_BASENAME`)
 * and Vite's `envDir` (#173). Contract: `contracts/check-links-index-names.md`.
 *
 * The config is evaluated in a child Node process, with Vite's `runnerImport`
 * (resolved from the site's own `astro`), for three reasons: every caller here
 * is synchronous, a config's top-level code (it writes `DK_DOCS_ROOT` and other
 * env) must not leak into the CLI, and the child starts from a clean
 * `DK_INDEX_BASENAME`. One child per config file, cached for the process, so
 * every gate and every caller in one run shares one evaluation.
 *
 * The child answers with the extracted fields only, never the raw config:
 * plugins and functions do not survive JSON.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findAstroConfig, findSiteRoot, viteEnvDirOf } from '../lib/draft-publication.mjs';
import { DK_INDEX_BASENAME_ENV as ENV_NAME, parsePublishedIndexBasenames } from '../lib/vocabulary-core.mjs';

/**
 * How long a site config may take to evaluate. A config that hangs (a network
 * call, an unresolved promise) must not hang a CI job: it is reported like any
 * other load failure.
 */
export const EVALUATE_TIMEOUT_MS = 30_000;

/** @typedef {{ names: string[] | null, envDir: string | false | null }} EvaluatedConfig */

/** Config path -> what evaluating it gave (names null: it never published; envDir null: it sets none). */
const evaluated = new Map();

/** A config that exists but could not be evaluated: a gate must fail closed on it. */
export class ConfigEvalError extends Error {
  /**
   * @param {string} message the full message, as shown to a person
   * @param {string} configPath absolute path of the config
   * @param {string} reason why it failed, without the prefix
   */
  constructor(message, configPath, reason) {
    super(message);
    this.name = 'ConfigEvalError';
    this.configPath = configPath;
    this.reason = reason;
  }
}

/** A path as shown to a person: relative to the working directory when inside it. */
export function shown(absPath) {
  const rel = relative(process.cwd(), absPath);
  return rel.startsWith('..') ? absPath : rel;
}

/** What the child left when it gave no JSON answer: the tail of its stderr (bounded) and how it ended. */
function noAnswerReason(res) {
  let text = (res.stderr || '').trim();
  const lines = text.split('\n');
  if (lines.length > 20) text = lines.slice(-20).join('\n');
  if (text.length > 2048) text = text.slice(-2048);
  const ended = [res.status !== null && res.status !== undefined ? `exit status ${res.status}` : '', res.signal ? `signal ${res.signal}` : '']
    .filter(Boolean)
    .join(', ');
  return [text || 'the config process produced no answer', ended && `(${ended})`].filter(Boolean).join(' ');
}

/**
 * Evaluate `configPath`; throws {@link ConfigEvalError} on any failure.
 * @returns {EvaluatedConfig}
 */
function evaluateConfigFile(configPath, siteDir, tool, timeoutMs) {
  const cached = evaluated.get(configPath);
  if (cached) return cached;
  const env = { ...process.env };
  delete env[ENV_NAME];
  const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--evaluate', configPath, siteDir], {
    cwd: siteDir,
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  const fail = (/** @type {string} */ reason) =>
    new ConfigEvalError(`[${tool}] could not load ${shown(configPath)}: ${reason}`, configPath, reason);
  if (res.error?.code === 'ETIMEDOUT') throw fail(`timed out after ${timeoutMs / 1000} s`);
  let answer;
  try {
    answer = JSON.parse(res.stdout.trim().split('\n').pop() ?? '');
  } catch {
    answer = { ok: false, message: noAnswerReason(res) };
  }
  if (!answer.ok) throw fail(answer.message);
  /** @type {EvaluatedConfig} */
  const result = { names: answer.names, envDir: answer.envDir ?? null };
  evaluated.set(configPath, result);
  return result;
}

/**
 * Find and evaluate a site's config.
 *
 * @param {object} options
 * @param {string} [options.siteRoot] The directory that holds the config. Not walked up from.
 * @param {string} [options.astroConfig] The config file itself (`--astro-config`); decides the
 *   site directory and must exist.
 * @param {string} [options.tool] Name used in messages.
 * @param {number} [options.timeoutMs]
 * @returns {{ configPath: string | null, siteDir: string, config: EvaluatedConfig | null }}
 *   `config` is null when there is no config file (a site without one is legal).
 * @throws {ConfigEvalError} a config that exists but does not load, exits non-zero or times out.
 * @throws {Error} `--astro-config` names a missing file.
 */
export function evaluateSiteConfig({ siteRoot, astroConfig, tool = 'dk-check-links', timeoutMs = EVALUATE_TIMEOUT_MS }) {
  let siteDir = resolve(siteRoot ?? '.');
  let configPath;
  if (astroConfig !== undefined) {
    configPath = resolve(astroConfig);
    if (!existsSync(configPath)) throw new Error(`[${tool}] --astro-config ${astroConfig}: no such file`);
    siteDir = dirname(configPath);
  } else {
    configPath = findAstroConfig(siteDir) ?? undefined;
  }
  if (!configPath) return { configPath: null, siteDir, config: null };
  return { configPath, siteDir, config: evaluateConfigFile(configPath, siteDir, tool, timeoutMs) };
}

/**
 * What a gate that is not given `--docs` learns from the site config: the
 * site root (`--site-root`, else the directory of `--astro-config`, else
 * the nearest config above `checkedDir`) and the config's `vite.envDir`.
 * Evaluates the config; the caller skips this when `--env-dir` decides.
 *
 * @param {{ checkedDir: string, siteRoot?: string, astroConfig?: string, tool: string }} options
 * @returns {{ siteRoot: string | undefined, envDir: string | false | undefined }}
 *   `envDir` undefined: the config sets none, or there is no config.
 * @throws {ConfigEvalError} the config exists and cannot be evaluated (the gate exits 2).
 */
export function evaluateGateConfig({ checkedDir, siteRoot, astroConfig, tool }) {
  const root = siteRoot ?? (astroConfig === undefined ? findSiteRoot(checkedDir) : undefined);
  const { siteDir, config } = evaluateSiteConfig({ siteRoot: root, astroConfig, tool });
  return { siteRoot: siteRoot ?? siteDir, envDir: config?.envDir ?? undefined };
}

/**
 * The draft setting is read from the deciding site root's own config, and that
 * must be the config that was evaluated: otherwise (a config above a nested docs
 * tree) the gate would vouch for env files it never read. Throws instead (FR-004,
 * fail closed). `--env-dir` (`envDir` given) decides the env files, so it skips this.
 * The one rule check-links and redirect-coverage share.
 *
 * @param {{ checkedDir: string, siteRoot?: string, evaluatedConfig?: string | null,
 *   envDir?: string | false, label: string }} options `label` names the checked tree in the message.
 * @throws {Error} the deciding site root has a config other than the evaluated one.
 */
export function assertEvaluatedConfigDecides({ checkedDir, siteRoot, evaluatedConfig, envDir, label }) {
  const rootConfig = findAstroConfig(siteRoot ?? findSiteRoot(checkedDir));
  if (envDir === undefined && rootConfig && resolve(rootConfig) !== evaluatedConfig) {
    throw new Error(
      `${label} is built by ${rootConfig}, but the config evaluated for it ` +
        `is ${evaluatedConfig ?? 'none'}. Pass --astro-config ${rootConfig}, or --env-dir <dir|false>.`,
    );
  }
}

/** The one-line refusal a gate prints (and exits 2 with) when its config will not evaluate. */
export function evalRefusal(err, label) {
  return (
    `${label}: could not evaluate ${shown(err.configPath)} (${err.reason}). ` +
    'Fix the config, or pass --env-dir <dir|false> to skip evaluation.'
  );
}

/** Child-process side of {@link evaluateConfigFile}: print one JSON answer line,
 * `{ ok, names, envDir }`. */
async function evaluate(configPath, siteDir) {
  try {
    const astroPkg = createRequire(join(siteDir, 'package.json')).resolve('astro/package.json');
    const vitePath = createRequire(astroPkg).resolve('vite');
    const { runnerImport } = await import(pathToFileURL(vitePath).href);
    const { module } = await runnerImport(configPath, { configFile: false });
    const names = parsePublishedIndexBasenames(process.env[ENV_NAME]) ?? null;
    // Vite's raw `envDir` (`envFile: false` folded in): the build resolves it against the site root (FR-010a).
    const envDir = viteEnvDirOf(module?.default?.vite) ?? null;
    console.log(JSON.stringify({ ok: true, names, envDir }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }));
  }
}

function isMain() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}
if (isMain() && process.argv[2] === '--evaluate') {
  await evaluate(process.argv[3], process.argv[4]);
  // A site config can leave handles open (watchers); the answer is already out.
  process.exit(0);
}
