/**
 * The paged hub listing's pure helpers (#342, WP03): the card a hub lists for a
 * child, the cards of one listing page, and the pagination window. Astro-free and
 * fs-free, so `Hub.astro`, the paged route and the tests share one definition.
 */

/** One card of a hub listing, as `Hub.astro` renders it. */
export interface HubCard {
  slug: string;
  title: string;
  description?: string;
  kind?: string;
  /** ADR lifecycle status token (Proposed/Accepted/Superseded/Deprecated); '' ⇒ unbadged. */
  status?: string;
  /** ADR date (YYYY-MM-DD). */
  date?: string;
}

/**
 * The cards of one listing page, in the order of `slugs` (the hub data's slice).
 * Throws when a slug has no card: the hub data and the hub page's own composition
 * would then disagree, which the one-composition rule (C-001) forbids.
 */
export function listingCards(slugs: readonly string[], cardsBySlug: ReadonlyMap<string, HubCard>): HubCard[] {
  return slugs.map((slug) => {
    const card = cardsBySlug.get(slug);
    if (!card) throw new Error(`[dk-hubs] listing child "${slug}" has no card`);
    return card;
  });
}

/** One item of the pagination: a page link (or the current page), or a gap. */
export type PaginationItem = { type: 'page'; page: number; current: boolean } | { type: 'gap' };

/**
 * The pages the pagination shows for page `current` of `total`. Up to seven pages
 * are all shown; beyond that the first and last page and the current page with
 * one neighbour on each side, with a gap for each run of two or more pages left
 * out (a gap never stands for a single page: that page is shown instead). The
 * list never holds more than nine items.
 */
export function paginationItems(current: number, total: number): PaginationItem[] {
  if (!Number.isInteger(total) || total < 1) throw new RangeError(`[dk-hubs] page count ${total} is not a whole number from 1`);
  if (!Number.isInteger(current) || current < 1 || current > total) {
    throw new RangeError(`[dk-hubs] page ${current} is outside 1..${total}`);
  }
  const shown = new Set<number>();
  if (total <= 7) {
    for (let page = 1; page <= total; page += 1) shown.add(page);
  } else {
    for (const page of [1, current - 1, current, current + 1, total]) if (page >= 1 && page <= total) shown.add(page);
  }
  const pages = [...shown].sort((a, b) => a - b);
  // Fill every one-page hole: a gap would be no shorter than the page itself.
  for (let at = 0; at < pages.length - 1; at += 1) {
    if (pages[at + 1]! - pages[at]! === 2) pages.splice(at + 1, 0, pages[at]! + 1);
  }
  const items: PaginationItem[] = [];
  pages.forEach((page, at) => {
    if (at > 0 && page - pages[at - 1]! > 1) items.push({ type: 'gap' });
    items.push({ type: 'page', page, current: page === current });
  });
  return items;
}

/**
 * The words of a page label before its number (`"Page 3"` → `"Page "`): the
 * current page shows its number and keeps these words visually hidden, so it reads
 * as the full label without an `aria-label` on a generic element. A translation
 * without the number gives the whole label and a space.
 */
export function pageLabelPrefix(label: string, page: number): string {
  const at = label.lastIndexOf(String(page));
  return at === -1 ? `${label} ` : label.slice(0, at);
}
