// @ts-check
/**
 * Does a docs tree have a published page with `tom_classification`? (#401, WP03)
 *
 * The evidence-index route (`/api/tom-annex.json`) is a prerendered static
 * endpoint, and Astro cannot skip one at render time. So the integration asks
 * this at `astro:config:setup` and mounts the route only when the answer is yes
 * (FR-012: a site with no classified pages gains nothing).
 *
 * A build-free frontmatter read over the one walk and the one draft rule the
 * site already uses (`docs-walk.mjs`, `draftRoutesOf`, the sitemap's rule,
 * C-005), so it cannot disagree with the content graph on which pages are
 * published. Only this yes/no comes from here; the index itself comes from the
 * graph (C-004), and the route fails loudly if the two ever disagree.
 *
 * @module tom-annex/scan
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { draftRoutesOf } from '../draft-publication.mjs';
import { walkMarkdownPaths } from '../docs-walk.mjs';
import { buildRouteTable } from '../vocabulary-core.mjs';

/**
 * @param {string} docsRoot the absolute docs directory
 * @param {string | string[]} [indexBasename] section-index basename(s); default `README`
 * @returns {boolean}
 */
export function hasPublishedClassifiedPages(docsRoot, indexBasename) {
  const paths = walkMarkdownPaths(docsRoot);
  const { routes } = buildRouteTable(paths, { indexBasename });
  const drafts = draftRoutesOf(docsRoot, indexBasename);
  return paths.some((rel) => {
    if (drafts.has(routes[rel])) return false;
    const classification = matter(readFileSync(path.join(docsRoot, rel), 'utf8')).data?.tom_classification;
    return Array.isArray(classification) && classification.length > 0;
  });
}
