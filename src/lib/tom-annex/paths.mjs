// @ts-check
/**
 * Containment for the `dockitty-tom-annex` command (#401): its path arguments
 * must resolve inside the project it runs in. Paths are compared as REAL paths
 * (symlinks resolved), so a project reached through a symlink is still inside,
 * and a directory symlink that points out of the project is outside.
 *
 * @module tom-annex/paths
 */

import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

/**
 * Does a path relative to the root leave it? `..` and `../x` leave; `..x`
 * stays. An absolute relative path is another drive or a UNC share (Windows
 * only: POSIX `relative` never returns one).
 *
 * @param {string} rel the result of `relative(root, target)`
 * @param {Pick<typeof path, 'sep' | 'isAbsolute'>} [p] the path flavour (for tests)
 * @returns {boolean}
 */
export function leavesRoot(rel, p = path) {
  return rel === '..' || rel.startsWith(`..${p.sep}`) || p.isAbsolute(rel);
}

/**
 * The real path of `abs`: symlinks resolved in its deepest existing ancestor,
 * with the part that does not exist yet appended as written.
 *
 * @param {string} abs an absolute path
 * @returns {string}
 */
export function realPathOf(abs) {
  /** @type {string[]} */
  const missing = [];
  let current = abs;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    missing.unshift(path.basename(current));
    current = parent;
  }
  return path.join(realpathSync(current), ...missing);
}

/**
 * Resolve a path argument against the working directory and return its real
 * path, or `undefined` when it leaves the working directory.
 *
 * @param {string} value the argument as given
 * @param {string} [cwd] the working directory
 * @returns {{ root: string, real: string | undefined }}
 */
export function resolveInside(value, cwd = process.cwd()) {
  const root = realpathSync(cwd);
  const real = realPathOf(path.resolve(cwd, value));
  return { root, real: leavesRoot(path.relative(root, real)) ? undefined : real };
}
