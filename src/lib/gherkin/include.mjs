/**
 * Resolve the `src` of a `::gherkin{src …}` include (ADR-0051 trust boundary;
 * rendering contract 03 §2.2–§2.3, §5).
 *
 * {@link resolveInclude} turns the author's `src` into the bytes of ONE file that
 * provably lies inside one of the configured `gherkin.includeRoots`, or into a
 * structured refusal the include stage (`../remark/gherkin-fence.ts`) formats as
 * its fatal `<page>:<L> ::gherkin src="x" — …` message. It never throws for a bad
 * `src`: every refusal is a value, so one page can report all of its includes.
 *
 * THE TRUST BOUNDARY (ADR-0051). Includes read files at build time on behalf of
 * page authors, so `src` is confined:
 *
 *  1. **Syntax.** `src` is project-root relative with POSIX separators. An empty
 *     value, an absolute path, a Windows drive letter, a URL scheme (`file:`,
 *     `https:`) and any backslash are refused before the filesystem is touched:
 *     each would otherwise resolve somewhere the author (or a reviewer reading
 *     the page) did not mean. So is a `src` that does not end in `.feature`
 *     (`notFeature`, slice C's `FEATURE_FILE` rule, `text.mjs`): an include root may hold
 *     other files (`includeRoots: ['.']` holds `.env`), and the parser quotes
 *     the line it chokes on, so reading one would print its contents in the
 *     build log.
 *  2. **Containment by `realpath`.** Every include root (resolved against the
 *     project root) and the TARGET are `realpath`ed, and the target must lie strictly below a root, with
 *     the prefix checked at a path-separator boundary (`features-old/` is not
 *     inside `features/`). Resolving symlinks FIRST is the point: a symlink inside
 *     a root that points out of it is refused, and so is `../` traversal, even
 *     when the target exists. A lexical check alone would pass both.
 *  3. **Missing files.** A target that does not exist cannot be `realpath`ed. It
 *     is reported `outside` when its LEXICAL path already leaves every root, or
 *     when the path it WOULD resolve to does ({@link wouldBeRealPath}: a
 *     dangling symlink inside a root that points out of it, or a missing file
 *     under a directory link that does), and `notFound` otherwise. So a refused
 *     `src` never tells the author whether a file outside the roots exists: a
 *     link out of a root answers `outside` whether its target exists or not.
 *  4. **Missing roots** are fatal (`rootMissing`) for an include whose target
 *     lies lexically below one, as slice C treats a missing source directory
 *     (`load.mjs`): a typo in `includeRoots` must not read as "file not found".
 *     A missing root is skipped for every other include, so one stale entry
 *     fails only the includes that would resolve under it (ADR-0051).
 *  5. **Only regular files, at most {@link MAX_INCLUDE_BYTES}.** A directory,
 *     device or FIFO is `notFile`, and a larger file is `tooLarge`, before a
 *     byte is read: a `.feature` file is small, and a build must not hang on a
 *     FIFO or run out of memory on a huge file. The content loader's include
 *     scan (`include-scan.mjs`) applies the same rule and cap.
 *
 * THE MEMO. A dev server is long-lived and re-renders a page on every edit, so
 * the bytes and hash of each included file are memoised, keyed on
 * `(realpath, mtimeMs, size)`: an edited file changes its mtime (and usually its
 * size), so the next render reads it again and never serves stale bytes; an
 * unchanged file costs one `stat`. A key on the path alone would serve the first
 * version for the life of the process (05 mutation check 10).
 *
 * NOT PURE (it reads the filesystem), so it is not in the purity table. Imports
 * only `node:fs`, `node:path`, `./load.mjs` (THE `toPosix`), `./text.mjs` (THE
 * relative-path and `.feature` rules) and `./include-path.mjs` (THE
 * containment predicate and size limit).
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars.
 *
 * @module gherkin/include
 */

import { readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { isInside, MAX_INCLUDE_BYTES } from './include-path.mjs';
import { toPosix } from './load.mjs';
import { FEATURE_FILE, isRelativePosixPath } from './text.mjs';

/**
 * @typedef {object} IncludeRootsOptions
 * @property {string} root Absolute project root: `src` and every include root
 *   are relative to it (the same base as `gherkin.sources`).
 * @property {readonly string[]} includeRoots `gherkin.includeRoots`, as configured
 *   (project-root relative).
 */

/**
 * @typedef {{
 *   ok: true,
 *   absPath: string,
 *   relPath: string,
 *   bytes: string,
 * } | {
 *   ok: false,
 *   reason: 'invalid' | 'notFeature' | 'outside' | 'notFound' | 'notFile' | 'tooLarge',
 * } | {
 *   ok: false,
 *   reason: 'rootMissing',
 *   includeRoot: string,
 * }} IncludeResult
 *
 * - `absPath`: the target as the author named it (`root` + `src`, normalised,
 *   symlinks kept): source links are built from it, as slice C builds them from
 *   the walked path.
 * - `relPath`: `absPath` relative to `root`, POSIX (`features/x.feature`): how
 *   messages and the source line name the file.
 * - `bytes`: the contents decoded as UTF-8, exactly as read.
 * - `rootMissing`: `includeRoot` as configured (project-root relative, so a
 *   message never prints an absolute path).
 */

/**
 * The memo: real path → the file as last read, with the stat it was read at.
 *
 * @type {Map<string, { mtimeMs: number, size: number, bytes: string }>}
 */
const memo = new Map();

/** Empty the memo (tests). */
export function clearIncludeMemo() {
  memo.clear();
}

/** Symbolic links {@link wouldBeRealPath} follows before giving up (Linux's `MAXSYMLINKS`). */
const MAX_LINK_HOPS = 40;

/**
 * The real path a MISSING `absPath` would have: its longest existing prefix
 * `realpath`ed, with each dangling symbolic link past it followed to its target
 * (resolved against the link's real directory), the rest appended as written.
 * `null` when it cannot be worked out (a link loop, a permission error): the
 * caller then falls back to the lexical answer.
 *
 * @param {string} absPath Absolute and normalised.
 * @param {{ hops: number }} [budget] Links still to follow (shared across the recursion).
 * @returns {string | null}
 */
function wouldBeRealPath(absPath, budget = { hops: MAX_LINK_HOPS }) {
  try {
    return realpathSync(absPath);
  } catch (error) {
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') return null;
  }
  const parent = path.dirname(absPath);
  if (parent === absPath) return absPath;
  const realParent = wouldBeRealPath(parent, budget);
  if (realParent === null) return null;
  const candidate = path.join(realParent, path.basename(absPath));
  let target;
  try {
    target = readlinkSync(candidate);
  } catch {
    return candidate; // absent, or not a link: it stays where it is
  }
  budget.hops -= 1;
  if (budget.hops < 0) return null;
  return wouldBeRealPath(path.resolve(realParent, target), budget);
}

/**
 * Resolve one include `src` to a file inside the include roots, and read it
 * (see the module doc for every rule). Never throws for a bad `src`.
 *
 * @param {string} src The directive's `src` attribute, as written.
 * @param {IncludeRootsOptions} options
 * @returns {IncludeResult}
 */
export function resolveInclude(src, { root, includeRoots }) {
  if (!isRelativePosixPath(src)) return { ok: false, reason: 'invalid' };
  if (!FEATURE_FILE.test(src)) return { ok: false, reason: 'notFeature' };
  const absPath = path.resolve(root, src);

  // Every root, lexically and by realpath. A missing root is a configuration
  // error for an include that would resolve under it, reported before anything
  // is said about the target; any other include skips it (module doc, rule 4).
  /** @type {Array<{ lexical: string, real: string }>} */
  const roots = [];
  for (const includeRoot of includeRoots) {
    const lexical = path.resolve(root, includeRoot);
    let real;
    try {
      real = realpathSync(lexical);
      if (!statSync(real).isDirectory()) throw new Error('not a directory');
    } catch {
      if (isInside(absPath, lexical)) return { ok: false, reason: 'rootMissing', includeRoot };
      continue;
    }
    roots.push({ lexical, real });
  }

  let realPath;
  try {
    realPath = realpathSync(absPath);
  } catch {
    // Cannot be realpath'd: it does not exist (or a link in it dangles). Never
    // reveal whether a path outside the roots exists (module doc, rule 3).
    const lexicallyInside = roots.some((r) => isInside(absPath, r.lexical));
    const wouldBe = lexicallyInside ? wouldBeRealPath(absPath) : null;
    const inside = lexicallyInside && (wouldBe === null || roots.some((r) => isInside(wouldBe, r.real)));
    return { ok: false, reason: inside ? 'notFound' : 'outside' };
  }
  if (!roots.some((r) => isInside(realPath, r.real))) return { ok: false, reason: 'outside' };

  const stat = statSync(realPath);
  if (!stat.isFile()) return { ok: false, reason: 'notFile' };
  if (stat.size > MAX_INCLUDE_BYTES) return { ok: false, reason: 'tooLarge' };

  let entry = memo.get(realPath);
  if (!entry || entry.mtimeMs !== stat.mtimeMs || entry.size !== stat.size) {
    entry = { mtimeMs: stat.mtimeMs, size: stat.size, bytes: readFileSync(realPath, 'utf8') };
    memo.set(realPath, entry);
  }
  return { ok: true, absPath, relPath: toPosix(path.relative(root, absPath)), bytes: entry.bytes };
}
