/**
 * The content loader's view of `::gherkin` includes (ADR-0051 decision 11):
 * which files a page includes, and a hash of each for the page digest.
 *
 * `docKittyDocsLoader` (`../schema.ts`) re-renders a page when a file it
 * includes changes, by folding {@link includeHash} of every
 * {@link gherkinIncludeSources} entry into the page digest and by watching
 * {@link includeFile}. Kept out of `schema.ts` so it is not part of the public
 * `./schema` entry point: nothing here is supported API.
 *
 * THE LOADER IS NOT THE TRUST BOUNDARY. It is built in the site's own
 * `content.config.ts` and never sees `gherkin.includeRoots`; the remark stage
 * (`include.mjs`) confines every include to the roots and fails the build
 * otherwise. But the loader runs FIRST, on every page, so it must not read what
 * the stage would refuse to read: it applies the same relative-path and
 * `.feature` rules (`text.mjs`), never follows an absolute `src`, and reads
 * only a regular file of at most {@link MAX_INCLUDE_BYTES} (a device would
 * never end, a FIFO would hang the sync). Anything else hashes to a sentinel, so the digest stays
 * deterministic and the stage reports the real error.
 *
 * NOT PURE (it reads the filesystem). Imports `node:crypto`, `node:fs`,
 * `node:path`, the parser stack (`unified`, `remark-parse`, `remark-directive`),
 * and the shared rules of `vocabulary-core.mjs`, `text.mjs` and `include-path.mjs`
 * (never `include.mjs`, which would pull the Gherkin parser into every site).
 *
 * @module gherkin/include-scan
 */

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import { compareCodeUnit } from '../vocabulary-core.mjs';
import { MAX_INCLUDE_BYTES } from './include-path.mjs';
import { FEATURE_FILE, isRelativePosixPath } from './text.mjs';

/** The text every include directive contains; cheap pre-filter before a parse. */
export const INCLUDE_MARKER = '::gherkin';

/** The hash of an include that cannot, or must not, be read. */
const UNREADABLE_INCLUDE = 'unreadable';

/**
 * The few mdast fields the scan reads.
 *
 * @typedef {{
 *   type: string,
 *   name?: string,
 *   attributes?: Record<string, string | null | undefined> | null,
 *   children?: IncludeScanNode[],
 * }} IncludeScanNode
 */

/** A plain CommonMark + directive parse: enough to tell a directive from a code fence. */
const includeScanParser = unified().use(remarkParse).use(remarkDirective);

/**
 * The `src` of every `::gherkin{…}` leaf directive in `markdown`, de-duplicated
 * and in code-unit order. A `::gherkin` inside a code fence, inline code or
 * prose is not a leaf directive, so a real parse skips it. Markdown without the
 * marker is not parsed at all.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function gherkinIncludeSources(markdown) {
  if (!markdown.includes(INCLUDE_MARKER)) return [];
  /** @type {Set<string>} */
  const found = new Set();
  /** @param {IncludeScanNode} node */
  const walk = (node) => {
    if (node.type === 'leafDirective' && node.name === 'gherkin') {
      const src = node.attributes?.src;
      if (typeof src === 'string' && src.trim() !== '') found.add(src);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(/** @type {IncludeScanNode} */ (includeScanParser.parse(markdown)));
  return [...found].sort(compareCodeUnit);
}

/**
 * The absolute file an include `src` names, resolved against `cwd` as the stage
 * resolves it against the project root; `null` for a `src` the stage refuses
 * before reading (not relative, or not a `.feature` file): it is then never
 * watched nor read.
 *
 * @param {string} src
 * @param {string} cwd
 * @returns {string | null}
 */
export function includeFile(src, cwd) {
  return isRelativePosixPath(src) && FEATURE_FILE.test(src) ? path.resolve(cwd, src) : null;
}

/**
 * sha256 of the file `src` names, or a sentinel when it is not a relative
 * `.feature` path, not a regular file, larger than {@link MAX_INCLUDE_BYTES}, or cannot be
 * read. `statSync` follows symlinks, so a link to a device is not a file either.
 *
 * @param {string} src
 * @param {string} cwd
 * @returns {string}
 */
export function includeHash(src, cwd) {
  const file = includeFile(src, cwd);
  if (file === null) return UNREADABLE_INCLUDE;
  try {
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > MAX_INCLUDE_BYTES) return UNREADABLE_INCLUDE;
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch {
    return UNREADABLE_INCLUDE;
  }
}
