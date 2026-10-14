/**
 * Where a CLI gets the site's section-index names (FR-007, FR-008).
 *
 * A site sets them once, in `defineDocKittyIntegrations({ indexBasename })`.
 * The integration publishes the list in `DK_INDEX_BASENAME`; this module
 * evaluates the site's `astro.config.*` and reads that value back, so a CLI
 * never has to be told again. Contract: `contracts/check-links-index-names.md`.
 *
 * The config is evaluated in a child Node process, with Vite's `runnerImport`
 * (resolved from the site's own `astro`), for three reasons: every caller here
 * is synchronous, a config's top-level code (it writes `DK_DOCS_ROOT` and other
 * env) must not leak into the CLI, and the child starts from a clean
 * `DK_INDEX_BASENAME`. One child per config file, cached for the process.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENV_NAME = 'DK_INDEX_BASENAME';
/**
 * How long a site config may take to evaluate. A config that hangs (a network
 * call, an unresolved promise) must not hang a CI job: it is reported like any
 * other load failure.
 */
const EVALUATE_TIMEOUT_MS = 30_000;
const CONFIG_NAMES = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'];

/** Config path -> names published by evaluating it (null: it never published). */
const evaluated = new Map();

/** A path as shown to a person: relative to the working directory when inside it. */
function shown(absPath) {
  const rel = relative(process.cwd(), absPath);
  return rel.startsWith('..') ? absPath : rel;
}

/** The same set of names, ignoring order and case (matching is case-insensitive). */
function sameNames(a, b) {
  const key = (names) => [...new Set(names.map((n) => n.toLowerCase()))].sort().join('\0');
  return key(a) === key(b);
}

/**
 * Evaluate `configPath` and return the names it published, or null when it did
 * not call `defineDocKittyIntegrations`. Throws `could not load` on any failure.
 */
function namesFromConfig(configPath, siteDir, tool, timeoutMs) {
  if (evaluated.has(configPath)) return evaluated.get(configPath);
  const env = { ...process.env };
  delete env[ENV_NAME];
  const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--evaluate', configPath, siteDir], {
    cwd: siteDir,
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  if (res.error?.code === 'ETIMEDOUT') {
    throw new Error(`[${tool}] could not load ${shown(configPath)}: timed out after ${timeoutMs / 1000} s`);
  }
  let answer;
  try {
    answer = JSON.parse(res.stdout.trim().split('\n').pop() ?? '');
  } catch {
    answer = { ok: false, message: (res.stderr || 'the config process produced no answer').trim() };
  }
  if (!answer.ok) throw new Error(`[${tool}] could not load ${shown(configPath)}: ${answer.message}`);
  evaluated.set(configPath, answer.names);
  return answer.names;
}

/**
 * Resolve the index names for the docs folder `root`.
 *
 * @param {string} root Docs folder; its parent holds the site's `astro.config.*`.
 * @param {object} [options]
 * @param {string[]} [options.flag] Names given with `--index-basename`.
 * @param {string} [options.siteDir] Site folder, when it is not the parent of `root`.
 * @param {string} [options.configPath] The site config file itself (`--astro-config`),
 *   when it is not next to the docs folder. It must exist and load.
 * @param {number} [options.timeoutMs] Evaluation time limit (default 30 s).
 * @param {string} [options.tool] Name used in messages (default `dk-check-links`).
 * @returns {{ names: string[], source: string, fromConfig: boolean, warning?: string }}
 *   `source` is the one-line account of where the names came from, for the CLI to
 *   print (see {@link announceIndexNames}); `fromConfig` is whether the site config
 *   set them; `warning` is set when no site config was found and `README` is assumed.
 * @throws {Error} A config that cannot be loaded, or a flag that disagrees with it.
 */
export function resolveSiteIndexBasenames(root, options = {}) {
  const { flag, tool = 'dk-check-links', timeoutMs = EVALUATE_TIMEOUT_MS } = options;
  let siteDir = resolve(options.siteDir ?? dirname(resolve(root)));
  let configPath;
  if (options.configPath !== undefined) {
    configPath = resolve(options.configPath);
    if (!existsSync(configPath)) {
      throw new Error(`[${tool}] --astro-config ${options.configPath}: no such file`);
    }
    siteDir = dirname(configPath);
  } else {
    configPath = CONFIG_NAMES.map((name) => join(siteDir, name)).find((p) => existsSync(p));
  }

  const published = configPath ? namesFromConfig(configPath, siteDir, tool, timeoutMs) : null;

  if (published) {
    if (flag && !sameNames(flag, published)) {
      throw new Error(
        `[${tool}] --index-basename ${flag.join(',')} does not match the site's index names ` +
          `${published.join(',')} (from ${shown(configPath)}). Remove the flag, or change ` +
          `indexBasename in ${shown(configPath)}.`,
      );
    }
    // The config's order wins: the first name decides generated page names.
    return {
      names: published,
      source: `index names: ${published.join(',')} (from ${shown(configPath)})`,
      fromConfig: true,
    };
  }
  if (flag) return { names: flag, source: `index names: ${flag.join(',')} (from --index-basename)`, fromConfig: false };
  if (!configPath) {
    const shownRoot = shown(resolve(root));
    return {
      names: ['README'],
      source: `index names: README (default; no astro.config.* next to ${shownRoot})`,
      fromConfig: false,
      warning:
        `no astro.config.* found for ${shownRoot}; assuming index names README ` +
        '\u2014 pass --astro-config <path> if your site config lives elsewhere',
    };
  }
  return {
    names: ['README'],
    source: `index names: README (default; ${shown(configPath)} does not call defineDocKittyIntegrations)`,
    fromConfig: false,
  };
}

/**
 * Print the one line every CLI owes its user: which index names it uses and
 * where they came from, plus the warning when no site config was found.
 *
 * @param {{ source: string, warning?: string }} resolved Result of {@link resolveSiteIndexBasenames}.
 * @param {{ log?: (line: string) => void, warn?: (line: string) => void }} [sinks]
 */
export function announceIndexNames(resolved, { log = console.log, warn = console.error } = {}) {
  log(resolved.source);
  if (resolved.warning) warn(`warning: ${resolved.warning}`);
}

/** Child-process side of {@link namesFromConfig}: print one JSON answer line. */
async function evaluate(configPath, siteDir) {
  try {
    const astroPkg = createRequire(join(siteDir, 'package.json')).resolve('astro/package.json');
    const vitePath = createRequire(astroPkg).resolve('vite');
    const { runnerImport } = await import(pathToFileURL(vitePath).href);
    await runnerImport(configPath, { configFile: false });
    const raw = process.env[ENV_NAME];
    console.log(JSON.stringify({ ok: true, names: raw ? JSON.parse(raw) : null }));
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
