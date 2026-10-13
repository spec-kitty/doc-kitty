/**
 * `relativeMdLinks` — rewrites a relative link to another page's `.md`/`.mdx`
 * file into that page's published route when the site is built (FR-011..FR-014),
 * so an author can write a link that also works on GitHub. ADR-0037 rejected
 * `.md`-relative authoring because Astro does not rewrite these links; this
 * pass makes the toolkit do it.
 *
 * Options are plain JSON on purpose (`{ routes, base, docsRoot }`): Astro keys
 * its content-store digest on the config, so the route table inside them is
 * what makes a rename or a draft flip re-render the pages that link to it
 * (FR-021). A function, `Map` or `Set` would serialise to nothing and hide the
 * change.
 *
 * Both link forms are covered: inline (`link`) and reference-style
 * (`definition`). Images, raw HTML anchors and everything else are left alone.
 * Resolution is `resolveRelativeDocLink`; on `null` the node is untouched so the
 * built-link gate still reports it (FR-013). With no options, an empty table, a
 * file with no path, or a file outside the docs root the tree is not mutated
 * (NFR-001). Registered only in the build pipeline: the glossary re-derive
 * processors do not get it, and the agent route serves the raw body (C-007).
 *
 * The href is emitted already base-prefixed. The rehype pass leaves an href that
 * starts with the base untouched, so a section named like the base
 * (base `/guides`, route `/guides/x/`) is not prefixed twice, and a based href
 * that was not emitted here is not mistaken for one.
 */
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { resolveRelativeDocLink } from '../vocabulary-core.mjs';

export interface RelativeMdLinksOptions {
  /** `buildRouteTable(...).routes`: docs-relative POSIX path to unbased route. */
  routes?: Readonly<Record<string, string>>;
  /** The site's normalised base prefix (`/site`, or `''`), the value the rehype pass receives. */
  base?: string;
  /** The docs root as configured (absolute); its real path is tried as well. */
  docsRoot?: string;
}

interface UrlNode {
  type: string;
  url?: string;
  children?: UrlNode[];
}

/** The part of the remark VFile this plugin reads. */
interface PathFile {
  path?: string;
}

/**
 * The docs-relative POSIX key of `filePath`, or `undefined` when it is not under
 * the docs root. The lexical root and its real path are both tried: the glob
 * loader hands over a lexical path, while an `.mdx` Vite id is real-pathed.
 */
function sourceKey(filePath: string, roots: readonly string[]): string | undefined {
  for (const root of roots) {
    const rel = path.relative(root, filePath);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    return rel.split(path.sep).join('/');
  }
  return undefined;
}

export default function relativeMdLinks(options?: RelativeMdLinksOptions) {
  const routes = options?.routes;
  const docsRoot = options?.docsRoot;
  if (!routes || !docsRoot || Object.keys(routes).length === 0) {
    return function inert(): void {};
  }
  const base = options?.base ?? '';
  const roots = [path.resolve(docsRoot)];
  try {
    const real = realpathSync(docsRoot);
    if (!roots.includes(real)) roots.push(real);
  } catch {
    // A docs root that is not on disk has no real path to add.
  }

  return function transformer(tree: UrlNode, file: PathFile): void {
    if (!file?.path) return;
    const key = sourceKey(file.path, roots);
    if (key === undefined) return;

    const walk = (node: UrlNode): void => {
      if ((node.type === 'link' || node.type === 'definition') && typeof node.url === 'string') {
        const route = resolveRelativeDocLink(routes, key, node.url);
        // `base` is already normalised and the route is root-absolute, so a plain
        // join is exact; `withBase` reads the build-time `BASE_URL`, which a
        // config-time plugin does not have, and would skip a route that starts with the base.
        if (route !== null) node.url = `${base}${route}`;
      }
      if (Array.isArray(node.children)) for (const child of node.children) walk(child);
    };
    walk(tree);
  };
}
