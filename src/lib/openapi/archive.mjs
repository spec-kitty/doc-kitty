// @ts-check
/**
 * The tagged-release archive input (mission openapi-second-slice-01M6WXJ4,
 * WP08; FR-018, FR-023, FR-028).
 *
 * `openapi.archive: { glob, labelPattern, released }` yields one version per
 * regular file the site-root-relative `glob` matches, labelled by the single
 * capturing group of `labelPattern` applied to the file's name. The scanner is
 * a `specSources` source (WP02's seam): `materialise.mjs` imports this
 * module and registers {@link materialiseArchive}, so an archive option is
 * dispatched here instead of refused with "not supported".
 *
 * Ordering is `materialise.mjs`'s (FR-023): the explicit specs keep config
 * order and these follow, sorted by POSIX relative path in code-point order.
 *
 * Fail-closed (FR-028 and the rejected-input matrix). The glob is relative and
 * has no `..`; a glob match must realpath inside the site root and be a regular
 * file (a symlink resolving inside is fine, one resolving outside is not); the
 * archive holds at most `MAX_ARCHIVE_MATCHES` matches; a derived label is
 * non-empty, route-safe — no dot, because the pinned renderer drops dots from
 * its slugs (`v1.1` → `v11`) — and unique against the explicit specs and the
 * other matches. Every error starts `[dk-openapi] archive "<glob>":` and names
 * the file where one exists.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */
import { globSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { MAX_ARCHIVE_MATCHES } from './limits.mjs';
import { OPENAPI_LOG_PREFIX } from './options.mjs';
import { materialiseSpec } from './materialise.mjs';

/** One label is one route segment: a dot would not survive the renderer's slug. */
const ROUTE_SAFE_LABEL = /^[a-z0-9_-]+$/;

/** File extensions a version may have, as `openapi.<ext>` publishes them. */
const EXTENSIONS = new Set(['yaml', 'yml', 'json']);

/**
 * @typedef {import('./materialise.mjs').SpecSourceContext} SpecSourceContext
 * @typedef {import('./materialise.mjs').MaterialisedSpec} MaterialisedSpec
 * @typedef {import('./options.mjs').NormalisedSpecInput} NormalisedSpecInput
 */

/**
 * The dispatch payload of an archive option, plus the labels already used by
 * explicit specs (`materialise.mjs` passes them for the cross-source duplicate
 * check).
 * @typedef {object} ArchiveInput
 * @property {string} entry The `[dk-openapi]` ref, `archive "<glob>"`.
 * @property {string} glob
 * @property {string} labelPattern
 * @property {boolean} [released]
 * @property {string[]} [labels] Labels the explicit specs already took.
 */

/** @param {string} entry @param {string} message @returns {never} */
function fail(entry, message) {
  throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ${message}`);
}

/** The POSIX form of a path, so messages and the FR-023 sort are platform-free. */
const toPosix = (/** @type {string} */ value) => value.split(path.sep).join('/');

/**
 * FR-023 names code-point order. JS `<` compares UTF-16 code units, which only
 * differs from code points for astral characters, so compare code points.
 * @param {string} left @param {string} right @returns {number}
 */
function compareCodePoints(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const difference = (a[i].codePointAt(0) ?? 0) - (b[i].codePointAt(0) ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

/**
 * The label pattern compiled, with the one capturing group the option promises.
 * `normaliseOpenApiOptions` already checked both; this is the scanner's own
 * guard for a caller that bypassed the static check.
 * @param {string} entry @param {string} labelPattern @returns {RegExp}
 */
function compileLabelPattern(entry, labelPattern) {
  /** @type {RegExp} */
  let pattern;
  try {
    pattern = new RegExp(labelPattern);
  } catch {
    fail(entry, `labelPattern must compile as a regular expression (${labelPattern})`);
  }
  // `pattern|` also matches the empty string through the added empty branch, so
  // a match's array length is 1 + the pattern's capturing-group count.
  if (new RegExp(`${labelPattern}|`).exec('')?.length !== 2) {
    fail(entry, `labelPattern must have exactly one capturing group (${labelPattern})`);
  }
  return pattern;
}

/**
 * The glob's matches as sorted POSIX relative paths, after the scanner's own
 * relative/no-`..` check (the option check already enforces it statically).
 * @param {string} entry @param {string} glob @param {string} siteRoot
 * @returns {string[]}
 */
function scanGlob(entry, glob, siteRoot) {
  if (path.isAbsolute(glob) || /^[a-zA-Z]:[\\/]/.test(glob) || glob.split(/[\\/]/).includes('..')) {
    fail(entry, `archive glob must be relative to the site root and stay inside it (${glob})`);
  }
  /** @type {string[]} */
  let matches;
  try {
    matches = globSync(glob, { cwd: siteRoot }).map((match) => toPosix(match).replace(/^\.\//, ''));
  } catch (error) {
    fail(entry, `cannot scan the archive glob: ${String(/** @type {Error} */ (error).message)} (${glob})`);
  }
  return matches.sort(compareCodePoints);
}

/**
 * The site root's real path, the containment baseline every match is compared
 * with (a root reached through a symlink must not make its own files look out
 * of bounds).
 * @param {string} entry @param {string} siteRoot @returns {string}
 */
function resolveRoot(entry, siteRoot) {
  try {
    return realpathSync(siteRoot);
  } catch {
    return fail(entry, `cannot resolve the site root (${siteRoot})`);
  }
}

/**
 * One glob match's real path, required to sit inside the site root. Throws for
 * a match that escapes (a symlink pointing out) or cannot be resolved.
 * @param {string} entry @param {string} rel @param {string} rootReal @param {string} siteRoot
 * @returns {string}
 */
function resolveMatch(entry, rel, rootReal, siteRoot) {
  /** @type {string} */
  let real;
  try {
    real = realpathSync(path.resolve(siteRoot, rel));
  } catch {
    return fail(entry, `cannot read the file (${rel})`);
  }
  if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) {
    fail(entry, `archive match escapes the site root (${rel})`);
  }
  return real;
}

/**
 * Whether a resolved match is a regular file. A directory or a device that a
 * glob happens to match is not a version and is skipped (FR-028).
 * @param {string} real
 * @returns {boolean}
 */
function isRegularFile(real) {
  try {
    return statSync(real).isFile();
  } catch {
    return false;
  }
}

/**
 * The label a file name derives: the single capturing group, lower-cased (the
 * same rule explicit labels use), non-empty and one safe route segment. Returns
 * `undefined` when the name does not match the pattern: the pattern selects
 * versions from a broader glob, it is not an error.
 * @param {string} entry @param {RegExp} pattern @param {string} rel
 * @returns {string | undefined}
 */
function deriveLabel(entry, pattern, rel) {
  const name = path.basename(rel);
  const match = pattern.exec(name);
  if (match === null) return undefined;
  const label = (match[1] ?? '').toLowerCase();
  if (label === '') fail(entry, `empty label: labelPattern captured nothing from the file name (${rel})`);
  if (label.includes('.')) {
    fail(
      entry,
      `the derived label ${JSON.stringify(label)} contains "."; the renderer drops dots from routes, so use a hyphen (${rel})`,
    );
  }
  if (!ROUTE_SAFE_LABEL.test(label)) {
    fail(
      entry,
      `the derived label ${JSON.stringify(label)} must use only a-z, 0-9, "_" and "-" (after lower-casing) (${rel})`,
    );
  }
  return label;
}

/**
 * A labelled match must carry a document extension, or `openapi.<ext>` would
 * publish an unknown raw document.
 * @param {string} entry @param {string} rel
 */
function checkExtension(entry, rel) {
  const ext = path.extname(rel).slice(1).toLowerCase();
  if (!EXTENSIONS.has(ext)) {
    fail(entry, `the match must end in .yaml, .yml or .json (${rel})`);
  }
}

/**
 * Scan the archive, then materialise each labelled match through the same
 * one-file flow explicit specs use (so size, alias and structural checks, and
 * the bundle/Swagger conversions of WP09, apply here too).
 * @param {ArchiveInput} input
 * @param {SpecSourceContext} context
 * @returns {MaterialisedSpec[]}
 */
export function materialiseArchive(input, context) {
  const { entry } = input;
  if (input.glob === '') fail(entry, 'archive glob is required');
  const pattern = compileLabelPattern(entry, input.labelPattern);
  const glob = input.glob;
  const matches = scanGlob(entry, glob, context.siteRoot);
  if (matches.length === 0) fail(entry, `no files match the archive glob (${glob})`);
  if (matches.length > MAX_ARCHIVE_MATCHES) {
    fail(
      entry,
      `archive glob matches ${matches.length} files, over the limit of ${MAX_ARCHIVE_MATCHES} (${glob})`,
    );
  }

  const rootReal = resolveRoot(entry, context.siteRoot);
  /** @type {Array<{ rel: string; absPath: string; label: string }>} */
  const candidates = [];
  for (const rel of matches) {
    const absPath = resolveMatch(entry, rel, rootReal, context.siteRoot);
    if (!isRegularFile(absPath)) continue;
    const label = deriveLabel(entry, pattern, rel);
    if (label === undefined) continue;
    checkExtension(entry, rel);
    candidates.push({ rel, absPath, label });
  }
  if (candidates.length === 0) fail(entry, `no files match the label pattern (${glob})`);

  // A label is unique across the explicit specs and the archive (data-model).
  const explicit = new Set(input.labels ?? []);
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const candidate of candidates) {
    if (explicit.has(candidate.label)) {
      fail(entry, `duplicate label ${JSON.stringify(candidate.label)}: an explicit spec already uses it (${candidate.rel})`);
    }
    const first = seen.get(candidate.label);
    if (first !== undefined) {
      fail(entry, `duplicate label ${JSON.stringify(candidate.label)}: ${first} and ${candidate.rel}`);
    }
    seen.set(candidate.label, candidate.rel);
  }

  const released = input.released ?? true;
  return candidates.flatMap(({ rel, absPath, label }) => {
    /** @type {NormalisedSpecInput} */
    const spec = {
      kind: 'file',
      path: rel,
      absPath,
      label,
      released,
      ext: path.extname(rel).slice(1).toLowerCase(),
    };
    return materialiseSpec(spec, entry, context).map((materialised) => ({ ...materialised, origin: 'archive' }));
  });
}
