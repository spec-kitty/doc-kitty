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

/**
 * Check that a paged hub's page and the build's hub data list the same children
 * and count (C-001, both ways): the listing pages slice the hub data, so a card the
 * hub page composes from the collection but the hub data lacks would be silently
 * dropped, and a hub-data child with no card would have nothing to render. Throws,
 * naming the hub and the first child that differs. Membership and count only: on a
 * paged hub every surface (page 1, the listing pages, the agent API, `llms.txt`)
 * takes its ORDER from the hub data, so they cannot disagree with each other.
 */
export function assertListingAgrees(
  hub: string,
  data: { count: number; children: ReadonlyArray<{ slug: string }> },
  cards: readonly HubCard[],
): void {
  const fromData = new Set(data.children.map((child) => child.slug));
  const fromPage = new Set(cards.map((card) => card.slug));
  const extra = cards.find((card) => !fromData.has(card.slug));
  if (extra) {
    throw new Error(`[dk-hubs] hub "${hub}": its page lists "${extra.slug}" but the build's hub data does not; the paged listing would drop it`);
  }
  const missing = data.children.find((child) => !fromPage.has(child.slug));
  if (missing) throw new Error(`[dk-hubs] hub "${hub}": the build's hub data lists "${missing.slug}" but its page does not`);
  if (data.count !== cards.length) {
    throw new Error(`[dk-hubs] hub "${hub}": the build's hub data counts ${data.count} children but its page lists ${cards.length}`);
  }
}

/**
 * The cards of one listing page, checked: {@link assertListingAgrees} first, then
 * {@link listingCards} for `slugs`. The one call both listing renderers (the hub
 * page and the paged route) make, so neither can render a slice the hub data and
 * the hub page's own composition disagree on.
 */
export function pageCards(
  hub: string,
  data: { count: number; children: ReadonlyArray<{ slug: string }> },
  cards: readonly HubCard[],
  slugs: readonly string[],
): HubCard[] {
  assertListingAgrees(hub, data, cards);
  return listingCards(slugs, new Map(cards.map((card) => [card.slug, card])));
}

/** One item of the pagination: a page link (or the current page), or a gap. */
export type PaginationItem = { type: 'page'; page: number; current: boolean } | { type: 'gap' };

/**
 * The pages the pagination shows for page `current` of `total`. Up to seven pages
 * are all shown; beyond that the first and last page and the current page with
 * one neighbour on each side, with a gap for each run of two or more pages left
 * out (a gap never stands for a single page: that page is shown instead). The
 * list never holds more than seven items.
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

/**
 * The words of a page label after its number (`"第3页"` → `"页"`), visually
 * hidden after the current page's number like {@link pageLabelPrefix}'s words
 * before it. Empty for an English label and for a label without the number.
 */
export function pageLabelSuffix(label: string, page: number): string {
  const at = label.lastIndexOf(String(page));
  return at === -1 ? '' : label.slice(at + String(page).length);
}
