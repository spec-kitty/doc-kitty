// @ts-check
/**
 * Draft publication setting (FR-013..FR-018, research R8).
 *
 * One environment setting, `DK_PUBLISH_DRAFTS`, decides whether draft pages are
 * emitted. It is `on` unless someone turns it off: drafts are built, listed and
 * marked `noindex`. A live deployment sets `off`; one that forgets the setting
 * publishes its drafts as `noindex` pages.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `vocabulary-core.mjs`: the
 * TypeScript integration (`config.ts`), the content loader (`schema.ts`) and the
 * bare-Node gate scripts (`src/scripts/*.mjs`) all import this one module, so
 * they cannot disagree about the default or the accepted values.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { isDraftStatus, isIndexPath } from './vocabulary-core.mjs';

/** The setting's name in the process environment and in env files. */
export const DK_PUBLISH_DRAFTS_ENV = 'DK_PUBLISH_DRAFTS';

/**
 * Where the integration records the value it resolved for the current build.
 * The content loader and the carriers run in the same process and read it from
 * here, so an env-file value reaches them too. It is a separate name so the
 * integration never overwrites what the user put in `DK_PUBLISH_DRAFTS`: a dev
 * server restart re-resolves from the real sources.
 */
export const DK_PUBLISH_DRAFTS_RESOLVED_ENV = 'DK_PUBLISH_DRAFTS_RESOLVED';

/** The accepted values, in the order the error message names them. */
export const PUBLISH_DRAFTS_VALUES = /** @type {const} */ (['on', 'off']);

/**
 * What the setting resolves to when no source sets it: drafts are published.
 * The one place the default is written; the resolver, the integration and the
 * gates all take it from here.
 */
export const PUBLISH_DRAFTS_DEFAULT = true;

/**
 * @typedef {'process environment' | 'env file' | 'default'} PublishDraftsSource
 * @typedef {{ publish: boolean, source: PublishDraftsSource }} PublishDraftsResolution
 * @typedef {Record<string, string | undefined>} EnvLike
 */

/**
 * @param {string | undefined} raw
 * @returns {string} trimmed value, or '' when absent or blank
 */
function present(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Resolve the setting and say where the value came from.
 *
 * Precedence: the process environment, then the site's env files, then the
 * default, `on` ({@link PUBLISH_DRAFTS_DEFAULT}).
 * An empty or blank value counts as "not set" and falls through to the next
 * source. Any other value than `on` / `off` (case-insensitive) throws (FR-017).
 *
 * @param {EnvLike} [env]
 * @param {EnvLike} [fileEnv]
 * @returns {PublishDraftsResolution}
 */
export function describePublishDrafts(env = process.env, fileEnv = {}) {
  /** @type {Array<[string, PublishDraftsSource]>} */
  const candidates = [
    [present(env[DK_PUBLISH_DRAFTS_ENV]), 'process environment'],
    [present(fileEnv[DK_PUBLISH_DRAFTS_ENV]), 'env file'],
  ];
  for (const [raw, source] of candidates) {
    if (raw === '') continue;
    const value = raw.toLowerCase();
    if (value === 'on') return { publish: true, source };
    if (value === 'off') return { publish: false, source };
    throw new Error(
      `${DK_PUBLISH_DRAFTS_ENV} must be "on" or "off", but the ${source} sets it to ` +
        `"${raw}". Use "on" to build draft pages (marked noindex) or "off" to leave ` +
        `them out; "on" is the default.`,
    );
  }
  return { publish: PUBLISH_DRAFTS_DEFAULT, source: 'default' };
}

/**
 * @param {EnvLike} [env]
 * @param {EnvLike} [fileEnv]
 * @returns {boolean} true when drafts are published
 */
export function resolvePublishDrafts(env = process.env, fileEnv = {}) {
  return describePublishDrafts(env, fileEnv).publish;
}

/**
 * The value in force for the build running in this process: what the
 * integration recorded, or else the setting resolved from the process
 * environment (a site that uses the loader without the integration, a gate
 * script, a unit test).
 *
 * @param {EnvLike} [env]
 * @returns {boolean}
 */
export function publishDraftsInForce(env = process.env) {
  const recorded = present(env[DK_PUBLISH_DRAFTS_RESOLVED_ENV]).toLowerCase();
  if (recorded === 'on') return true;
  if (recorded === 'off') return false;
  return resolvePublishDrafts(env);
}

// The draft predicate lives in the fs-free core, so `metadata.ts` (which may not
// import `node:fs`) and this module share one definition.
export { isDraftStatus };

/**
 * Parse the text of an env file into its `DK_`-prefixed settings.
 *
 * A deliberately small reader: `KEY=value` lines, an optional `export ` prefix,
 * `#` comment lines, a trailing ` # comment` on an unquoted value, and one pair
 * of matching single or double quotes. No variable expansion and no multi-line
 * values; the toolkit's settings are single words.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?(DK_[A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = /** @type {string} */ (match[2]).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.indexOf(quote, 1) !== -1) {
      value = value.slice(1, value.indexOf(quote, 1));
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    out[/** @type {string} */ (match[1])] = value;
  }
  return out;
}

/**
 * Read the site's env files for a build mode, in the build tool's own order
 * (later files win): `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`.
 * `mode` is `development` for the dev server and `production` for a build, so
 * `.env.development` applies to the dev server only.
 *
 * The toolkit reads the files itself because `vite` is a dependency of Astro,
 * not of this package, and is therefore not importable from an installed copy.
 *
 * @param {string} root the site root (where `astro.config.*` lives)
 * @param {string} mode
 * @returns {Record<string, string>}
 */
export function readEnvFiles(root, mode) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    Object.assign(out, parseEnvFile(readFileSync(file, 'utf8')));
  }
  return out;
}

/** The file names Astro accepts for a site's config, in its own lookup order. */
const ASTRO_CONFIG_NAMES = [
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.ts',
  'astro.config.mts',
  'astro.config.cjs',
  'astro.config.cts',
];

/**
 * The site root a checked directory belongs to: the nearest directory, starting
 * at `fromDir` and walking up, that holds an Astro config. `fallback` (the
 * working directory by default) when none does.
 *
 * @param {string} fromDir a docs tree or a build output
 * @param {string} [fallback]
 * @returns {string} absolute path
 */
export function findSiteRoot(fromDir, fallback = process.cwd()) {
  let dir = path.resolve(fromDir);
  for (;;) {
    if (ASTRO_CONFIG_NAMES.some((name) => existsSync(path.join(dir, name)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(fallback);
    dir = parent;
  }
}

/**
 * THE resolver: the setting for one site and one build mode, and where the
 * value came from. The integration and every gate call this function and no
 * other, so a value kept in an env file is the same for the build and for the
 * gates that check it.
 *
 * Precedence is {@link describePublishDrafts}'s: the process environment, then
 * the site's env files for `mode` ({@link readEnvFiles}), then the default `on`.
 *
 * @param {string} siteRoot the directory that holds the Astro config
 * @param {string} [mode] `development` for `astro dev`, `production` otherwise
 * @param {EnvLike} [env]
 * @returns {PublishDraftsResolution}
 */
export function resolveDraftPublication(siteRoot, mode = 'production', env = process.env) {
  return describePublishDrafts(env, readEnvFiles(siteRoot, mode));
}

/**
 * Take `--site-root <dir>` and `--mode <mode>` out of a gate's arguments.
 *
 * @param {readonly string[]} args the arguments after the script name
 * @returns {{ siteRoot?: string, mode?: string, rest: string[] }}
 * @throws {Error} when a flag is given without a value
 */
export function takeSiteFlags(args) {
  /** @type {{ siteRoot?: string, mode?: string, rest: string[] }} */
  const out = { rest: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = /** @type {string} */ (args[i]);
    if (arg !== '--site-root' && arg !== '--mode') {
      out.rest.push(arg);
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${arg} needs a value: ${arg === '--mode' ? '--mode <mode>' : '--site-root <dir>'}`);
    }
    if (arg === '--mode') out.mode = value;
    else out.siteRoot = value;
    i += 1;
  }
  return out;
}

/**
 * Resolve the setting for a gate and word the one line it prints, so a gate
 * that disagrees with the build it checks is visible in the log.
 *
 * The site root is `siteRoot` when given, else {@link findSiteRoot} from the
 * directory the gate checks. The mode is `production` unless given, which is
 * what `astro build` and `astro preview` use.
 *
 * @param {{ checkedDir: string, siteRoot?: string, mode?: string, env?: EnvLike }} options
 * @returns {PublishDraftsResolution & { siteRoot: string, mode: string, summary: string }}
 */
export function resolveDraftPublicationForGate({ checkedDir, siteRoot, mode = 'production', env = process.env }) {
  const root = siteRoot ? path.resolve(siteRoot) : findSiteRoot(checkedDir);
  const resolved = resolveDraftPublication(root, mode, env);
  const shown = path.relative(process.cwd(), root) || '.';
  return {
    ...resolved,
    siteRoot: root,
    mode,
    summary:
      `${DK_PUBLISH_DRAFTS_ENV}=${resolved.publish ? 'on' : 'off'} ` +
      `(from: ${resolved.source}; site root: ${shown}; mode: ${mode})`,
  };
}

/**
 * The draft page routes of a docs tree (leading and trailing slash, no base),
 * read from each file's `doc_status`. A build-free frontmatter read, and the
 * one walker: the integration (`config.ts`: sitemap filter, sidebar shaping,
 * withheld redirects) and the bare-Node gates all call it. Every `.md`/`.mdx`
 * except `log.md` counts, in every folder (the walk does not skip `_meta/` or
 * dot-folders); index basenames collapse to their directory; the bundle root is
 * never a draft.
 *
 * @param {string} docsRoot the docs directory
 * @param {string | string[]} [indexBasename] section-index basename(s); default `README`
 * @returns {Set<string>}
 */
export function draftRoutesOf(docsRoot, indexBasename) {
  /** @type {Set<string>} */
  const routes = new Set();
  /** @param {string} dir */
  const walk = (dir) => {
    /** @type {string[]} */
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return; // no docs tree: no drafts
    }
    for (const name of names) {
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.mdx?$/i.test(name) || /^log\.md$/i.test(name)) continue;
      if (!isDraftStatus(matter(readFileSync(abs, 'utf8')).data?.doc_status)) continue;
      const rel = path.relative(docsRoot, abs).split(path.sep).join('/');
      const slug = isIndexPath(rel, indexBasename)
        ? rel.slice(0, Math.max(0, rel.lastIndexOf('/')))
        : rel.replace(/\.mdx?$/i, '');
      if (slug !== '') routes.add(`/${slug}/`);
    }
  };
  walk(docsRoot);
  return routes;
}

/**
 * The route a redirect target names: no origin, no site base, no query or
 * fragment, with a leading and a trailing slash. `null` for a target on another
 * site, which is never one of this site's pages.
 *
 * @param {string} target
 * @param {string} [base] the site base, e.g. `/docs`
 * @returns {string | null}
 */
export function routeOfTarget(target, base = '') {
  let route = String(target).trim();
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(route)) return null;
  route = route.replace(/[?#].*$/, '');
  if (!route.startsWith('/')) route = `/${route}`;
  const prefix = `/${base}`.replace(/\/+/g, '/').replace(/\/$/, '');
  if (prefix && (route === prefix || route.startsWith(`${prefix}/`))) {
    route = route.slice(prefix.length) || '/';
  }
  return route.endsWith('/') ? route : `${route}/`;
}

/**
 * The target a redirect entry names, or `null` when it has none.
 *
 * @param {unknown} value a target string or `{ destination }`
 * @returns {string | null}
 */
function targetOf(value) {
  const target =
    typeof value === 'string'
      ? value
      : /** @type {{ destination?: unknown } | null} */ (value)?.destination;
  return typeof target === 'string' ? target : null;
}

/**
 * The configured redirects that END at a draft page. With drafts off those
 * pages are not built, so such a redirect would send its old URL to a 404.
 * Sorted by old URL, so the report is the same on every build (NFR-006).
 *
 * Each redirect is followed through the declared map to its terminus: the
 * first route that is not itself a redirect's old URL. Only the terminus
 * decides:
 *  - `old -> renamed -> draft` is listed (for `old` and for `renamed`), so the
 *    first hop does not survive as a stub into a deleted one;
 *  - `old -> X -> published`, where `X` is both a draft page and a declared
 *    redirect, is not listed. With drafts off the page at `X` is not built, the
 *    redirect at `X` is, and the chain works.
 * A chain that loops has no terminus and is not listed: the stubs stay, and the
 * redirect-coverage gate reports the loop.
 *
 * @param {Record<string, unknown> | undefined} redirects Astro's `redirects`
 *   config: each value is a target string or `{ destination }`
 * @param {ReadonlySet<string>} drafts draft routes, as {@link draftRoutesOf} returns them
 * @param {string} [base]
 * @returns {Array<{ from: string, route: string }>} `route` is the draft terminus
 */
export function redirectsToDrafts(redirects, drafts, base = '') {
  /** @type {Map<string, string | null>} old route -> the route its target names */
  const next = new Map();
  for (const [from, value] of Object.entries(redirects ?? {})) {
    const target = targetOf(value);
    const key = routeOfTarget(from);
    if (target !== null && key !== null) next.set(key, routeOfTarget(target, base));
  }
  /** @type {Array<{ from: string, route: string }>} */
  const out = [];
  for (const [from, value] of Object.entries(redirects ?? {})) {
    const target = targetOf(value);
    if (target === null) continue;
    let route = routeOfTarget(target, base);
    const seen = new Set([routeOfTarget(from)]);
    while (route !== null && next.has(route)) {
      if (seen.has(route)) {
        route = null; // a loop: no terminus
        break;
      }
      seen.add(route);
      route = next.get(route) ?? null;
    }
    if (route !== null && drafts.has(route)) out.push({ from, route });
  }
  return out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
