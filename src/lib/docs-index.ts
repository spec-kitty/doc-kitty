/**
 * The docs collection adapter + index builder — the neutral owner of the
 * `docs`-collection derivation shared by BOTH the route handlers
 * (`routes/rss|llms-txt|agent-index|agent-page`) AND the slot components
 * (`components/slots/Audience|Related|OnThisPage`, `layouts/Hub`). It lived in
 * `routes/shared.ts` (whose remit is route plumbing — the docs-root resolver and
 * the feed URL/XML helpers), but after #88 the components import it too, so the
 * derivation earned its own module rather than reaching into route plumbing
 * (issue #90). It statically imports `astro:content`, so it is not `astro.config`
 * safe — that is unchanged from its previous home.
 */
import { getCollection } from 'astro:content';
import type { DocEntry, DocKittyFrontmatter, DocsIndex } from './metadata.js';
import { slugFromEntryId, sortBySlug } from './metadata.js';

/**
 * Load every docs entry as a `DocEntry`. With the README-as-index loader, an
 * entry's `id` is already the route slug ("" for the root, "how-to/pages", …).
 *
 * ORDER: slug ascending, regardless of the collection's own order (#85; contract:
 * `kitty-specs/feed-order-determinism-01M1VV64/contracts/feed-order.md`). The
 * content store is filled in the completion order of Astro's concurrent glob
 * loader, so its insertion order is build-timing noise; sorting here makes every
 * downstream surface order-stable BY CONSTRUCTION rather than one comparator at
 * a time. Consumers may treat this as a stable baseline but MUST still sort by
 * their own total key when they need a different order.
 *
 * `withBody` (#90) is opt-in: the feed/agent/index consumers never read a page's
 * body, so by default it is omitted (the returned shape is exactly `{slug,data}`,
 * byte-identical to every pre-#90 caller). `Hub.astro`'s ADR cards DO read the
 * raw markdown body, so it passes `{ withBody: true }` to get `body` carried on
 * each entry — the one field it previously mapped inline.
 */
export async function collectDocEntries(
  opts: { withBody?: boolean } = {},
): Promise<DocEntry[]> {
  const entries = await getCollection('docs');
  // `entry` is a `CollectionEntry<'docs'>`, but `astro:content` does not resolve
  // under bare `tsc` (CI's astro-aware typecheck sees the real type); annotate a
  // minimal structural shape so this split module adds no implicit-`any` beyond
  // the pre-#90 baseline.
  return sortBySlug(
    (entries as ReadonlyArray<{ id: string; data: unknown; body?: string }>).map((entry) => ({
      slug: slugFromEntryId(entry.id),
      data: entry.data as unknown as DocKittyFrontmatter,
      ...(opts.withBody ? { body: entry.body ?? '' } : {}),
    })),
  );
}

/**
 * Flatten `DocEntry`s into the `DocsIndex` shape the resolvers consume: a map
 * keyed by route slug whose values are `{ slug, title, kind, doc_status,
 * description }`. Built from the FULL collection (not the discoverable subset)
 * so a `related` ref to a non-discoverable page still resolves — a dangling ref
 * is build-fatal by design (FR-004), never silently dropped.
 */
export function buildDocsIndex(entries: DocEntry[]): DocsIndex {
  const index: DocsIndex = {};
  for (const { slug, data } of entries) {
    index[slug] = {
      slug,
      title: data.title,
      kind: data.kind ?? '',
      doc_status: data.doc_status ?? 'draft',
      ...(data.description !== undefined ? { description: data.description } : {}),
    };
  }
  return index;
}
