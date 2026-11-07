/**
 * Does a page get an Atom entry (page-chrome FR-020, FR-022)? No Astro imports, so
 * the pure page-format helper (WP09) and tests can load it: the route and the link
 * both ask this, so a link and an entry cannot disagree.
 */
import type { DocKittyFrontmatter } from '../metadata.js';
import { feedDateMillis, isDraftEntry, isPublished } from '../metadata.js';

/**
 * Published (also under `DK_PUBLISH_DRAFTS=on`, which loads drafts but must not feed
 * them) and dated.
 */
export function atomEligible(entry: { id: string; data: DocKittyFrontmatter }): boolean {
  return isPublished(entry.data) && !isDraftEntry(entry) && feedDateMillis(entry.data) > 0;
}
