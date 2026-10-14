/**
 * The two include rules that need `node:path` but no parser, shared by the
 * include resolver (`include.mjs`, the trust boundary) and the content loader's
 * include scan (`include-scan.mjs`). A module of its own so the loader, which
 * every site's module graph reaches through `schema.ts`, never pulls in
 * `include.mjs` and through it the Gherkin parser (`scenario-index.test.ts`
 * pins the `llms.txt` graph). The path-SYNTAX rule (`isRelativePosixPath`) is in
 * the import-free `text.mjs`, because the pure option validator needs it too.
 *
 * Imports only `node:path`.
 *
 * @module gherkin/include-path
 */

import path from 'node:path';

/**
 * The largest file an include reads: 1 MiB, far above any hand-written
 * `.feature` file. A larger file is refused before a byte is read, by the stage
 * (a fatal error) and by the loader (folded as unreadable).
 */
export const MAX_INCLUDE_BYTES = 1024 * 1024;

/**
 * True when `target` lies strictly below `dir`: the prefix must end at a path
 * separator, so `/x/features-old/a` is not inside `/x/features`. Both are
 * absolute and normalised (`path.resolve`, `realpathSync`, `fileURLToPath`).
 * THE containment predicate of the include pipeline: the resolver confines an
 * include to a root with it, and the loader tells an include below the project
 * root (which Vite already watches) from one it must watch.
 *
 * @param {string} target
 * @param {string} dir
 * @returns {boolean}
 */
export function isInside(target, dir) {
  const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
  return target.startsWith(prefix);
}
