/**
 * Where a CLI gets the site's section-index names (FR-007, FR-008).
 *
 * A site sets them once, in `defineDocKittyIntegrations({ indexBasename })`.
 * The integration publishes the list in `DK_INDEX_BASENAME`; the shared
 * evaluator (`site-config-eval.mjs`) evaluates the site's `astro.config.*` and
 * this module reads that value back, so a CLI never has to be told again.
 * Contract: `contracts/check-links-index-names.md`.
 */
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateSiteConfig, EVALUATE_TIMEOUT_MS, shown } from './site-config-eval.mjs';
import { registerExcludedFolders } from '../lib/docs-walk.mjs';

/** A path's real location, or the path itself when it does not exist. */
function real(p) {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/**
 * The excluded folders (ADR-0068) the evaluated config sets for the docs tree
 * `root`: its `exclude` list when `root` is the docs root the config names, else
 * none. Registered with the shared walk, so every walk of `root` in this process
 * leaves them out.
 *
 * @param {string} root
 * @param {{ exclude?: string[], docsRoot?: string | null } | null | undefined} evaluatedConfig
 * @returns {string[]}
 */
function siteExclusionFor(root, evaluatedConfig) {
  const exclude = evaluatedConfig?.exclude ?? [];
  const docsRoot = evaluatedConfig?.docsRoot;
  if (exclude.length === 0 || !docsRoot || real(docsRoot) !== real(root)) return [];
  registerExcludedFolders(resolve(root), exclude);
  return exclude;
}

/** The same set of names, ignoring order and case (matching is case-insensitive). */
function sameNames(a, b) {
  const key = (names) => [...new Set(names.map((n) => n.toLowerCase()))].sort().join('\0');
  return key(a) === key(b);
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
 * @returns {{ names: string[], source: string, fromConfig: boolean, envDir?: string | false,
 *   configPath: string | null, warning?: string, exclude: string[], excludeSource?: string }}
 *   `source` is the one-line account of where the names came from, for the CLI to
 *   print (see {@link announceIndexNames}); `fromConfig` is whether the site config
 *   set them; `warning` is set when no site config was found and `README` is assumed.
 *   `exclude` is the folders the site leaves out of `root` (ADR-0068), already
 *   registered with the shared walk; `excludeSource` is the line that says so,
 *   set only when there are any.
 * @throws {Error} A config that cannot be loaded, or a flag that disagrees with it.
 */
export function resolveSiteIndexBasenames(root, options = {}) {
  const { flag, tool = 'dk-check-links', timeoutMs = EVALUATE_TIMEOUT_MS } = options;
  const siteDir = resolve(options.siteDir ?? dirname(resolve(root)));
  const { configPath, config: evaluatedConfig } = evaluateSiteConfig({
    siteRoot: siteDir,
    astroConfig: options.configPath,
    tool,
    timeoutMs,
  });
  const published = evaluatedConfig?.names ?? null;
  // `undefined` when no config was evaluated; `null` is not passed on, so a gate reads it as "unset".
  const envDir = evaluatedConfig ? (evaluatedConfig.envDir ?? undefined) : undefined;
  const exclude = siteExclusionFor(root, evaluatedConfig);
  const excluded = exclude.length ? { excludeSource: `excluded folders: ${exclude.join(', ')} (from ${shown(configPath)})` } : {};

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
      envDir,
      configPath,
      exclude,
      ...excluded,
    };
  }
  if (flag) return { names: flag, source: `index names: ${flag.join(',')} (from --index-basename)`, fromConfig: false, envDir, configPath, exclude, ...excluded };
  if (!configPath) {
    const shownRoot = shown(resolve(root));
    return {
      names: ['README'],
      source: `index names: README (default; no astro.config.* next to ${shownRoot})`,
      fromConfig: false,
      configPath: null,
      exclude,
      warning:
        `no astro.config.* found for ${shownRoot}; assuming index names README ` +
        '\u2014 pass --astro-config <path> if your site config lives elsewhere',
    };
  }
  return {
    names: ['README'],
    source: `index names: README (default; ${shown(configPath)} does not call defineDocKittyIntegrations)`,
    fromConfig: false,
    envDir,
    configPath,
    exclude,
  };
}

/**
 * Print the one line every CLI owes its user: which index names it uses and
 * where they came from, plus the warning when no site config was found.
 *
 * Also prints which folders the site excludes, when it excludes any.
 *
 * @param {{ source: string, warning?: string, excludeSource?: string }} resolved Result of {@link resolveSiteIndexBasenames}.
 * @param {{ log?: (line: string) => void, warn?: (line: string) => void }} [sinks]
 */
export function announceIndexNames(resolved, { log = console.log, warn = console.error } = {}) {
  log(resolved.source);
  if (resolved.excludeSource) log(resolved.excludeSource);
  if (resolved.warning) warn(`warning: ${resolved.warning}`);
}
