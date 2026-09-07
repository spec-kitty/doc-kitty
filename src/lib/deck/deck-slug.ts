/**
 * Deck URL-parity helper (ADR-0021 decision 4) — the SINGLE source of truth for
 * a deck's canonical route slug and its `getStaticPaths` params.
 *
 * The out-of-frame deck route lives at `presentations/[...slug].astro`, so the
 * `[...slug]` rest parameter captures the path AFTER `presentations/`. But a
 * deck's collection id (and therefore the route slug the generators emit —
 * `llms.txt`, the agent API, the sitemap; see `src/lib/routes/llms-txt.ts` and
 * `collectDocEntries` in `src/lib/docs-index.ts`) ALREADY includes the
 * `presentations/` prefix. Feeding the raw slug into the route params would
 * reconstruct `/presentations/presentations/<x>/` and 404 while every lane stays
 * green (the "prefix-doubling trap", BA-3). So `deckRouteParams` strips the
 * prefix, and the built path reconstructs to `/${deckSlug(entry)}/` — byte-equal
 * to what the generators list.
 *
 * WP04's URL-parity assertion imports THIS helper, not a re-derived copy, so the
 * route and the generators can never drift (ADR-0021 risk: URL drift).
 *
 * Framework-light: it depends only on `slugFromEntryId` (Astro-free), so the
 * same helper runs in the build assertion and the deck route alike.
 *
 * FR-003 index-basename note: this helper takes NO `indexBasename` — it is
 * already basename-agnostic. `entry.id` is the content loader's ALREADY
 * resolved id (`docKittyDocsLoader`'s `generateId`, which DOES apply the
 * configured basename); `slugFromEntryId` only special-cases the bundle-root
 * sentinel. A deck section indexed by `index.md` (e.g.
 * `presentations/showcase/index.md` under an opted-in basename) therefore
 * already collapses to `presentations/showcase` upstream, before this helper
 * ever sees it — verified by `deck-slug.test.ts`'s basename-composition case.
 */
import { slugFromEntryId } from '../metadata.js';

/**
 * The minimal shape this helper needs from an Astro `docs` collection entry: the
 * stored entry `id`. With the README-as-index loader an entry's `id` is already
 * the route slug (e.g. `presentations/draft-preview`), so `slugFromEntryId`
 * only special-cases the bundle root — never a deck.
 */
export interface DeckEntryLike {
  id: string;
}

/**
 * A deck's canonical route slug — identical to the slug the generators derive
 * from the collection (`slugFromEntryId(entry.id)`), so the deck's URL is
 * `/${deckSlug(entry)}/`. For any deck this is `presentations/<name>`.
 */
export function deckSlug(entry: DeckEntryLike): string {
  return slugFromEntryId(entry.id);
}

/**
 * The `getStaticPaths` params for the `presentations/[...slug]` route. The
 * `presentations/` prefix is stripped because the route file already contributes
 * it: `{ slug: '<name>' }` reconstructs to `/presentations/<name>/`, matching
 * `/${deckSlug(entry)}/` (BA-3 parity). Passing the raw slug would double the
 * prefix.
 */
export function deckRouteParams(entry: DeckEntryLike): { slug: string } {
  return { slug: deckSlug(entry).replace(/^presentations\//, '') };
}
