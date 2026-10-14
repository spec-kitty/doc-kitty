/**
 * Gherkin feature DISCOVERY + PARSE-ONCE loader (ADR-0046, WP02).
 *
 * Walks every configured source directory for `*.feature` files, parses each
 * one exactly once with `@cucumber/gherkin`, and returns an Astro-free
 * {@link FeatureModel} that the pure metadata core (`feature-core.mjs`), the
 * renderer (`render.mjs`) and the generator (`generate.mjs`) all consume. Both
 * the Astro integration (`config.ts`) and the bare-Node drift gate
 * (`generate-feature-pages.mjs --check`) call this same function, so the model
 * they see is identical by construction.
 *
 * DETERMINISM: files are ordered by source index, then by `compareCodeUnit` on
 * the source-relative POSIX path — never locale or filesystem order. Every file
 * gets a FRESH `IdGenerator.incrementing()`, so AST ids depend only on that
 * file's own contents (adding a file elsewhere never renumbers another file).
 *
 * ERRORS (house posture, glossary FR-002): malformed source and
 * misconfiguration are build-fatal. Every syntax error in every file is
 * collected first, then ONE `Error` is thrown listing them all, one line each:
 * `[dk-gherkin] <path-from-root>:<line>:<col> <parser message>`. A missing
 * source directory is fatal immediately. A document with no `Feature:` (empty
 * or comments only) is a warning and is skipped.
 *
 * PURITY CONTRACT: imports only `node:fs`, `node:path`, `node:crypto`,
 * `../vocabulary-core.mjs`, the pure `./parse.mjs` (which owns the
 * `@cucumber/gherkin` parser and the error format) and the import-free
 * `./text.mjs`. NO `astro`/`@astrojs/*`, so it loads under plain `node`.
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars (see the header of
 * `../vocabulary-core.mjs`).
 *
 * @module gherkin/load
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { compareCodeUnit } from '../vocabulary-core.mjs';
import { parseGherkin } from './parse.mjs';
import { FEATURE_FILE, GHERKIN_LOG_PREFIX } from './text.mjs';

/**
 * Prefix on every log line / error message this feature emits. Defined once in
 * `./text.mjs`; re-exported here for `config.ts` (and tests), which already
 * import the loader.
 */
export { GHERKIN_LOG_PREFIX };

/**
 * One parsed `.feature` file.
 *
 * @typedef {{
 *   relPath: string,
 *   absPath: string,
 *   sourceDir: string,
 *   sourceDirIndex: number,
 *   bytes: string,
 *   sha256: string,
 *   document: import('@cucumber/messages').GherkinDocument,
 * }} FeatureFile
 *
 * - `relPath`: POSIX path relative to its own source dir (`shipping/x.feature`).
 * - `absPath`: absolute path of the file.
 * - `sourceDir`: absolute path of the source dir it was found under.
 * - `sourceDirIndex`: index of that source in the `sources` option.
 * - `bytes`: the file contents decoded as UTF-8, exactly as read (no BOM/CRLF
 *   normalisation).
 * - `sha256`: full lowercase hex SHA-256 of the RAW file bytes.
 * - `document`: the parsed `GherkinDocument`; `document.feature` is always set.
 */

/** @typedef {{ files: FeatureFile[] }} FeatureModel */

/**
 * @typedef {object} LoadFeaturesOptions
 * @property {string[]} sources Source directories, resolved against `root`.
 * @property {string} root Absolute directory the sources (and reported paths) are relative to.
 * @property {(msg: string) => void} [warn] Warning sink (default: no-op).
 */

/** Directory names never descended into (besides any dot-directory). */
const SKIP_DIRS = new Set(['node_modules']);

/**
 * Convert a platform path to POSIX separators. THE one `toPosix` of the Gherkin
 * pipeline (`generate.mjs` imports it).
 *
 * @param {string} p
 * @returns {string}
 */
export function toPosix(p) {
  return p.split(path.sep).join('/');
}

/**
 * How a feature file is named and linked as a SOURCE: THE one builder of
 * `gherkin.sourceRoot` / `gherkin.sourceUrlPrefix` links, shared by generated
 * pages (`generate.mjs`: the frontmatter's `sources[0].resource`) and include
 * source lines (`../remark/gherkin-fence.ts`, rendering contract 03 §4.6).
 *
 * - `label`: `absPath` relative to `sourceRoot`, POSIX.
 * - `resource`: `sourceUrlPrefix + label` when a prefix is set, else `label`.
 *   `scenario-index.ts` inverts exactly this.
 *
 * @param {string} absPath
 * @param {{ sourceRoot: string, sourceUrlPrefix?: string }} options `sourceRoot`
 *   is absolute.
 * @returns {{ label: string, resource: string }}
 */
export function sourceLink(absPath, { sourceRoot, sourceUrlPrefix }) {
  const label = toPosix(path.relative(sourceRoot, absPath));
  return { label, resource: sourceUrlPrefix ? `${sourceUrlPrefix}${label}` : label };
}

/**
 * Recursively collect the `*.feature` files under `absBase`, as POSIX paths
 * relative to it, sorted with `compareCodeUnit`. Mirrors the
 * `walkMarkdownPaths` shape in `schema.ts` (plain fs, no glob dependency).
 * Skips dot-directories and `node_modules`; follows symlinks but never visits
 * the same real directory twice (cycle-safe). Each directory's entries are
 * walked in `compareCodeUnit` order — never filesystem order — so WHICH path
 * reaches a real directory first (a symlink or its target) is deterministic.
 *
 * @param {string} absBase
 * @returns {string[]}
 */
function walkFeaturePaths(absBase) {
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  /**
   * @param {string} dir
   * @param {string} rel
   */
  const walk = (dir, rel) => {
    let real;
    try {
      real = realpathSync(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    /** @type {string[]} */
    let names;
    try {
      names = readdirSync(dir).sort(compareCodeUnit);
    } catch {
      return;
    }
    for (const name of names) {
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let stat;
      try {
        stat = statSync(abs);
      } catch {
        continue; // dangling symlink / editor lock file
      }
      if (stat.isDirectory()) {
        if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
        walk(abs, relPath);
        continue;
      }
      if (stat.isFile() && FEATURE_FILE.test(name)) out.push(relPath);
    }
  };
  walk(absBase, '');
  return out.sort(compareCodeUnit);
}

/**
 * Discover and parse every `*.feature` file under `sources`.
 *
 * @param {LoadFeaturesOptions} options
 * @returns {FeatureModel}
 * @throws {Error} `[dk-gherkin] source directory not found: …` for a missing
 *   source; otherwise one `Error` listing every Gherkin syntax error.
 */
export function loadFeatures({ sources, root, warn = () => {} }) {
  /** @param {string} abs */
  const fromRoot = (abs) => toPosix(path.relative(root, abs)) || '.';

  /** @type {{ relPath: string, absPath: string, sourceDir: string, sourceDirIndex: number }[]} */
  const found = [];
  sources.forEach((source, sourceDirIndex) => {
    const sourceDir = path.resolve(root, source);
    let isDir = false;
    try {
      isDir = statSync(sourceDir).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} source directory not found: ${source} (resolved to ${sourceDir})`,
      );
    }
    for (const relPath of walkFeaturePaths(sourceDir)) {
      found.push({
        relPath,
        absPath: path.join(sourceDir, ...relPath.split('/')),
        sourceDir,
        sourceDirIndex,
      });
    }
  });

  /** @type {FeatureFile[]} */
  const files = [];
  /** @type {string[]} */
  const errors = [];
  for (const entry of found) {
    const raw = readFileSync(entry.absPath);
    const bytes = raw.toString('utf8');
    const sha256 = createHash('sha256').update(raw).digest('hex');
    const display = fromRoot(entry.absPath);

    // The one parse path (`parse.mjs`): fresh ids per file, errors formatted
    // `[dk-gherkin] <path>:<line>:<col> <message>` and collected, not thrown.
    const { document, errors: fileErrors } = parseGherkin(bytes, { display });
    if (!document) {
      errors.push(...fileErrors);
      continue;
    }
    if (!document.feature) {
      warn(`${GHERKIN_LOG_PREFIX} ${display}: no Feature, skipped`);
      continue;
    }
    files.push({ ...entry, bytes, sha256, document });
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return { files };
}
