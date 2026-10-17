/**
 * Where a CLI gets the site's section-index names (FR-007, FR-008).
 *
 * A site sets them once, in `defineDocKittyIntegrations({ indexBasename })`.
 * The integration publishes the list in `DK_INDEX_BASENAME`; the shared
 * evaluator (`site-config-eval.mjs`) evaluates the site's `astro.config.*` and
 * this module reads that value back, so a CLI never has to be told again.
 * Contract: `contracts/check-links-index-names.md`.
 */
import { dirname, resolve } from 'node:path';
import { evaluateSiteConfig, EVALUATE_TIMEOUT_MS, shown } from './site-config-eval.mjs';

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
 *   configPath: string | null, warning?: string }}
 *   `source` is the one-line account of where the names came from, for the CLI to
 *   print (see {@link announceIndexNames}); `fromConfig` is whether the site config
 *   set them; `warning` is set when no site config was found and `README` is assumed.
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
    };
  }
  if (flag) return { names: flag, source: `index names: ${flag.join(',')} (from --index-basename)`, fromConfig: false, envDir, configPath };
  if (!configPath) {
    const shownRoot = shown(resolve(root));
    return {
      names: ['README'],
      source: `index names: README (default; no astro.config.* next to ${shownRoot})`,
      fromConfig: false,
      configPath: null,
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
