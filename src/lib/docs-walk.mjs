// @ts-check
/**
 * The one walk of a docs tree (FR-010, C-002). Every route table is built from
 * this list, so the integration, the content loader and the gates cannot
 * disagree about which files are pages.
 *
 * `_meta` is reserved for the registry (decision 01M4WE30W61BS7CG5D0KH99T0T): a folder
 * named `_meta` at any depth, and a file whose stem is `_meta` (`_meta.md`,
 * `_meta.mdx`), are not pages, so nothing under them reaches the loader, the route
 * table, the link check or the sidebar. The registry YAML in `docs/_meta/` is read
 * by its catalog loaders directly, not through this walk.
 *
 * Excluded folders (ADR-0068): a site lists docs folders to leave out of the
 * build, once, in `defineDocKittyIntegrations({ exclude })`. This walk is where
 * the list takes effect, so every surface built from it (the loader's ids, the
 * route table, the draft sweep, the sidebar, the link gates, the ADR index and
 * the content graph) drops the same files. Nothing under an excluded folder is
 * walked. Which folders apply to a tree is {@link excludedFoldersFor}: the list
 * the integration published for its docs root, or the list a CLI registered for
 * a root after reading the site config ({@link registerExcludedFolders}).
 *
 * Plain ESM with JSDoc types, like `vocabulary-core.mjs`; kept apart from it
 * because it reads the file system and the core must stay fs-free.
 */
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { DK_DOCS_ROOT_ENV, DK_EXCLUDE_ENV } from './internal-env.mjs';

/** Characters a folder entry may not hold: glob syntax and a Windows separator. */
const GLOB_CHARS = /[*?[\]{}()!\\]/;

/**
 * Validate and normalise the `exclude` option (ADR-0068): docs-root-relative
 * folder paths, `/`-separated. A trailing slash and a leading `./` are dropped.
 * Rejected: a non-array, a non-string or empty entry, an absolute path, a `..`
 * or `.` segment, a dot-prefixed or `_meta` segment (never walked anyway), and
 * glob syntax (the option names folders, not patterns). Duplicates are dropped;
 * order is kept.
 *
 * @param {unknown} value
 * @param {string} [label] how the option is named in messages
 * @returns {string[]}
 */
export function normalizeExcludedFolders(value, label = 'exclude') {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`[dk-config] ${label} must be an array of docs folder paths, got ${JSON.stringify(value)}`);
  }
  /** @type {string[]} */
  const out = [];
  for (const entry of value) {
    const bad = (/** @type {string} */ why) =>
      new Error(`[dk-config] ${label}: ${JSON.stringify(entry)} ${why}. List folders relative to the docs root, e.g. "archive" or "plans/engineering-notes".`);
    if (typeof entry !== 'string') throw bad('is not a string');
    const trimmed = entry.trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
    if (trimmed === '') throw bad('is empty');
    if (trimmed.startsWith('/') || /^[a-z]:/i.test(trimmed)) throw bad('is an absolute path');
    if (GLOB_CHARS.test(trimmed)) throw bad('holds glob syntax; name a folder, not a pattern');
    const segments = trimmed.split('/');
    if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) throw bad('has an empty, "." or ".." segment');
    if (segments.some((seg) => seg.startsWith('.') || seg === '_meta')) {
      throw bad('names a dot folder or _meta, which are never part of the site');
    }
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * Is the docs-relative POSIX path `rel` inside (or equal to) one of `folders`?
 * Compared segment by segment and with exact letter case, so `archive` does not
 * match `archived/`. The integration checks that each folder exists with that
 * exact case, so a case slip fails the build instead of publishing the folder.
 *
 * @param {string} rel
 * @param {readonly string[]} folders normalised by {@link normalizeExcludedFolders}
 */
export function isExcludedPath(rel, folders) {
  return excludingFolder(rel, folders) !== undefined;
}

/**
 * The folder of `folders` that holds `rel`, or undefined.
 *
 * @param {string} rel
 * @param {readonly string[]} folders
 * @returns {string | undefined}
 */
export function excludingFolder(rel, folders) {
  return folders.find((folder) => rel === folder || rel.startsWith(`${folder}/`));
}

/**
 * Check that every excluded folder exists under `absRoot` as a folder, with the
 * exact letter case given (ADR-0068). A typo, or `Archive` for `archive` on a
 * case-insensitive disk, would otherwise exclude nothing and publish the folder.
 *
 * @param {string} absRoot
 * @param {readonly string[]} folders
 * @param {string} [shownRoot] the docs root as named in the message
 * @throws {Error} naming each folder that is not there
 */
export function assertExcludedFoldersExist(absRoot, folders, shownRoot = absRoot) {
  const missing = folders.filter((folder) => {
    let dir = absRoot;
    for (const seg of folder.split('/')) {
      let names;
      try {
        names = readdirSync(dir);
      } catch {
        return true;
      }
      if (!names.includes(seg)) return true;
      dir = path.join(dir, seg);
    }
    try {
      return !statSync(dir).isDirectory();
    } catch {
      return true;
    }
  });
  if (missing.length) {
    throw new Error(
      `[dk-config] exclude: ${missing.map((f) => JSON.stringify(f)).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not ` +
        `a folder under ${shownRoot} (letter case counts). Fix the path, or remove the entry.`,
    );
  }
}

/**
 * Parse the published {@link DK_EXCLUDE_ENV} value. Absent → `[]`. A value that
 * is not a JSON list of valid folders was not written by DocKitty: it is an error.
 *
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parsePublishedExclude(raw) {
  if (raw === undefined || raw === '') return [];
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    value = raw;
  }
  try {
    return normalizeExcludedFolders(value, DK_EXCLUDE_ENV);
  } catch {
    throw new Error(
      `[dk-config] ${DK_EXCLUDE_ENV} is set by defineDocKittyIntegrations and must not be set by hand; got: ${raw}`,
    );
  }
}

/** Absolute docs root -> excluded folders, registered by a CLI for the roots it checks. */
const registered = new Map();

/**
 * Record the excluded folders of the docs tree at `absRoot` for this process. A
 * CLI calls this once it has read the site config, so every walk of that tree in
 * the run, including the ones inside shared helpers, drops the same folders.
 *
 * @param {string} absRoot
 * @param {readonly string[]} folders
 */
export function registerExcludedFolders(absRoot, folders) {
  registered.set(path.resolve(absRoot), [...folders]);
}

/** Forget every registration. For tests. */
export function clearRegisteredExclusions() {
  registered.clear();
}

/**
 * The docs root that owns `abs` and its excluded folders: a root a CLI
 * registered, else the root `defineDocKittyIntegrations` published. `abs` is the
 * root itself or a folder inside it. Null when no known root holds `abs`.
 *
 * @param {string} abs absolute, resolved
 * @returns {{ root: string, folders: string[] } | null}
 */
function owningRoot(abs) {
  const holds = (/** @type {string} */ root) => abs === root || abs.startsWith(`${root}${path.sep}`);
  let best = null;
  for (const [root, folders] of registered) {
    if (holds(root) && (!best || root.length > best.root.length)) best = { root, folders };
  }
  if (best) return best;
  const docsRoot = process.env[DK_DOCS_ROOT_ENV];
  if (docsRoot && holds(path.resolve(docsRoot))) {
    return { root: path.resolve(docsRoot), folders: parsePublishedExclude(process.env[DK_EXCLUDE_ENV]) };
  }
  return null;
}

/**
 * The excluded folders that apply to the tree at `absBase`, relative to it: the
 * ones a CLI registered for its docs root, else the ones
 * `defineDocKittyIntegrations` published for the docs root it was configured
 * with, else none. `absBase` may be the docs root or a folder inside it (the ADR
 * folder): the folders below it are given relative to it. A tree outside every
 * known docs root (another root a CLI checks, a fixture) is walked whole.
 *
 * @param {string} absBase
 * @returns {string[]}
 */
export function excludedFoldersFor(absBase) {
  const abs = path.resolve(absBase);
  const owner = owningRoot(abs);
  if (!owner || owner.folders.length === 0) return [];
  const prefix = path.relative(owner.root, abs).split(path.sep).join('/');
  if (prefix === '') return [...owner.folders];
  return owner.folders
    .filter((folder) => folder.startsWith(`${prefix}/`))
    .map((folder) => folder.slice(prefix.length + 1));
}

/**
 * Is the folder `absBase` itself inside an excluded folder of its docs root?
 * Then the shared walk lists nothing under it.
 *
 * @param {string} absBase
 */
export function isInsideExcludedFolder(absBase) {
  const abs = path.resolve(absBase);
  const owner = owningRoot(abs);
  if (!owner || owner.folders.length === 0) return false;
  const rel = path.relative(owner.root, abs).split(path.sep).join('/');
  return rel !== '' && isExcludedPath(rel, owner.folders);
}

/**
 * Recursively list every `.md`/`.mdx` path under `absBase`, relative to it
 * (`/`-joined), except the reserved `log.md` and anything under a dot-prefixed
 * folder or named with a leading dot: Astro's glob loader does not load those,
 * so a route for them would be a route the site never emits. An absent base is
 * an empty tree. Nothing under an excluded folder is listed (ADR-0068).
 *
 * @param {string} absBase
 * @param {{ exclude?: readonly string[] }} [options] `exclude`: the folders to
 *   leave out, relative to `absBase`; default {@link excludedFoldersFor}`(absBase)`
 *   (and nothing at all when `absBase` is itself inside an excluded folder). Pass
 *   `[]` to walk the whole tree.
 * @returns {string[]}
 */
export function walkMarkdownPaths(absBase, options = {}) {
  if (options.exclude === undefined && isInsideExcludedFolder(absBase)) return [];
  const exclude = options.exclude ?? excludedFoldersFor(absBase);
  /** @type {string[]} */
  const out = [];
  /** Real paths of the directories on the current descent: a symlink back into one is a loop. */
  const active = new Set();
  /**
   * @param {string} dir
   * @param {string} rel
   */
  const walk = (dir, rel) => {
    /** @type {string[]} */
    let names;
    let real;
    try {
      real = realpathSync(dir);
      names = readdirSync(dir);
    } catch {
      return; // base absent → an empty content tree (glob() itself no-ops too)
    }
    if (active.has(real)) return; // symlink loop: still followed once, never re-entered
    active.add(real);
    for (const name of names) {
      if (name.startsWith('.') || name === '_meta') continue;
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let isDir;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        if (exclude.length && isExcludedPath(relPath, exclude)) continue;
        walk(abs, relPath);
        continue;
      }
      if (/^_meta\.mdx?$/.test(name)) continue;
      if (/\.mdx?$/i.test(name) && !/(^|\/)log\.md$/i.test(relPath)) out.push(relPath);
    }
    active.delete(real);
  };
  walk(absBase, '');
  return out;
}

/**
 * The pages the shared walk would list under the excluded folders of `absBase`,
 * relative to `absBase`: the files a link may name but the site never builds.
 * Used by the link gates to say "excluded" instead of "missing" (ADR-0068).
 *
 * @param {string} absBase
 * @param {readonly string[]} [exclude] default {@link excludedFoldersFor}`(absBase)`
 * @returns {string[]}
 */
export function excludedMarkdownPaths(absBase, exclude = excludedFoldersFor(absBase)) {
  if (exclude.length === 0) return [];
  return walkMarkdownPaths(absBase, { exclude: [] }).filter((rel) => isExcludedPath(rel, exclude));
}
