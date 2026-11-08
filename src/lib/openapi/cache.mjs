// @ts-check
/**
 * The shared OpenAPI cache writer (mission openapi-second-slice-01M6WXJ4,
 * WP02; plan.md's parallel-edit registry).
 *
 * WP09's bundler and WP10's fetcher both cache parsed artefacts under
 * `node_modules/.cache/doc-kitty/openapi/`, keyed by content digest: an entry's
 * name IS its sha256, so a cache hit is a verified hit. The one writer lives
 * here so both agree on what an entry is:
 *
 *  - written atomically: a unique temp file in the SAME directory (the same
 *    filesystem, so the rename cannot be a copy), created exclusively, renamed
 *    into place — a reader never sees a half-written entry;
 *  - written through the cache root's realpath: symlinked project ancestors
 *    (for example a symlinked home or macOS /tmp) are safe and supported, but
 *    a symlinked cache entry below that root is refused (FR-028);
 *  - read verified: `readCacheVerified` hashes the bytes before returning them
 *    and reports a corrupted (or missing) entry as `undefined`, never as data.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Prefix of every error this module throws. */
export const OPENAPI_LOG_PREFIX = '[dk-openapi]';

const sha256 = (/** @type {Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Resolve the cache root after creating it. Symlinked ancestors are outside
 * the cache and may be part of the owner's project path; everything the writer
 * does next is relative to this real root. A cache entry itself must not be a
 * symlink below it.
 * @param {string} dir
 */
function cacheRoot(dir) {
  const realRoot = realpathSync(dir);
  return realRoot;
}

/** @param {string} target @param {string} dir */
function assertCacheEntryNotSymlink(target, dir) {
  try {
    if (lstatSync(target).isSymbolicLink()) {
      throw new Error(`${OPENAPI_LOG_PREFIX} refusing to write the cache through a symlinked entry: ${dir}`);
    }
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
  }
}

/**
 * The realpath of an entry's location below the cache root: the same path
 * `writeCacheAtomic` returns, so a cache hit and a write agree on `renderPath`
 * even when the configured cache dir is reached through a symlinked ancestor.
 * A cache dir that does not exist yet (nothing written, offline failure) has
 * no real path; the configured path is used verbatim then.
 * @param {string} dir
 * @param {string} sha
 * @param {string} ext
 * @returns {string}
 */
export function cacheEntryPath(dir, sha, ext) {
  try {
    return path.join(realpathSync(dir), `${sha}.${ext}`);
  } catch {
    return path.join(dir, `${sha}.${ext}`);
  }
}

/**
 * Write `bytes` to `<dir>/<sha>.<ext>`, atomically, and return that realpath.
 * The directory is created when missing. Symlinked project ancestors are
 * allowed; a symlinked entry below the resolved cache root is refused.
 * @param {string} dir The cache directory (created when missing).
 * @param {string} sha The content digest; names the entry.
 * @param {string} ext The entry's extension, no dot.
 * @param {Buffer} bytes
 * @returns {string} The path written to.
 */
export function writeCacheAtomic(dir, sha, ext, bytes) {
  mkdirSync(dir, { recursive: true });
  const realRoot = cacheRoot(dir);
  const target = path.join(realRoot, `${sha}.${ext}`);
  assertCacheEntryNotSymlink(target, dir);
  // Exclusive creation ('wx') makes the temp name unique per attempt; the pid
  // keeps parallel processes out of each other's way.
  let temp;
  let written = false;
  for (let attempt = 0; attempt < 1024 && !written; attempt += 1) {
    temp = path.join(realRoot, `.${sha}.${process.pid}.${attempt}.tmp`);
    try {
      writeFileSync(temp, bytes, { flag: 'wx' });
      written = true;
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EEXIST') {
        rmSync(temp, { force: true });
        throw error;
      }
    }
  }
  if (!temp || !written) {
    throw new Error(`${OPENAPI_LOG_PREFIX} cannot create a cache temp file in ${dir}`);
  }
  try {
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
  return target;
}

/**
 * Read `<dir>/<sha>.<ext>`, but only when its bytes really hash to `sha`:
 * a corrupted or missing entry is `undefined`, never data.
 * @param {string} dir
 * @param {string} sha
 * @param {string} ext
 * @returns {Buffer | undefined}
 */
export function readCacheVerified(dir, sha, ext) {
  let bytes;
  try {
    bytes = readFileSync(path.join(dir, `${sha}.${ext}`));
  } catch {
    return undefined;
  }
  return sha256(bytes) === sha ? bytes : undefined;
}
