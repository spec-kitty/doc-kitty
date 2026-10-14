// @ts-check
/**
 * The one walk of a docs tree (FR-010, C-002). Every route table is built from
 * this list, so the integration, the content loader and the gates cannot
 * disagree about which files are pages.
 *
 * Plain ESM with JSDoc types, like `vocabulary-core.mjs`; kept apart from it
 * because it reads the file system and the core must stay fs-free.
 */
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Recursively list every `.md`/`.mdx` path under `absBase`, relative to it
 * (`/`-joined), except the reserved `log.md` and anything under a dot-prefixed
 * folder or named with a leading dot: Astro's glob loader does not load those,
 * so a route for them would be a route the site never emits. An absent base is
 * an empty tree.
 *
 * @param {string} absBase
 * @returns {string[]}
 */
export function walkMarkdownPaths(absBase) {
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
      if (name.startsWith('.')) continue;
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let isDir;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        walk(abs, relPath);
        continue;
      }
      if (/\.mdx?$/i.test(name) && !/(^|\/)log\.md$/i.test(relPath)) out.push(relPath);
    }
    active.delete(real);
  };
  walk(absBase, '');
  return out;
}
