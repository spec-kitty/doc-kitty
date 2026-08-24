# Contract: deck route + build assertions

## Deck route — `example/src/pages/presentations/[...slug].astro`

```
// src/lib/deck/deck-slug.ts — one oracle, imported by the route AND the parity assertion
export const deckSlug = (entry) => entry.slug.replace(/^presentations\//, '');
export const deckRouteParams = (entry) => ({ slug: deckSlug(entry) });

// example/src/pages/presentations/[...slug].astro
export const prerender = true;
export async function getStaticPaths() {
  const decks = (await getCollection('docs')).filter(e => e.data.kind === 'Presentation');
  return decks.map(e => ({ params: deckRouteParams(e), props: { entry: e } }));
}
```

- `[...slug]` captures the path **after** `presentations/`; `entry.slug` **already includes**
  the `presentations/` prefix, so `deckSlug` strips it and the built path reconstructs to
  `/${entry.slug}/` — **byte-identical** to what `llms-txt.ts` (`/${entry.slug}/`) and the
  agent API (`routeFor`/`slugFromEntryId`, `src/lib/metadata.ts`) emit. Feeding raw
  `entry.slug` doubles the prefix (`/presentations/presentations/<x>/`) and fails BA-3.
- Server-renders `<DeckLayout>` → `.reveal > .slides > <section>…</section>` (from the
  transform), plus real `<button>` navigation controls and the browser-only reveal
  `<script>` (dynamic import). No top-level reveal import (SSR-safe).
- Wins `/presentations/*` by **path specificity** over Starlight's catch-all (shadow, not
  exclude — ADR-0021); `presentations/` entries are excluded from Starlight's own routing
  (avoid a duplicate-route build error, WP01 T002) and from the in-frame sidebar (D5, WP04 T028).

## Build assertions (extend `assert-build-artifacts.mjs` / `assert-chrome-artifacts.mjs`)

| ID | Assertion | Discharges |
|---|---|---|
| BA-1 | `EXPECTED_INDEX_ENTRY_COUNT` / `EXPECTED_SITEMAP_URL_COUNT` recomputed + cross-checked against `example/docs/`, covering the published deck **and** the overview Hub in one recompute | FR-017 / C-007 |
| BA-2 | **Route-uniqueness**: exactly one HTML at `/presentations/<deck>/`, containing `.reveal > .slides`, **not** the Starlight article shell | FR-017 / C-004 (A-02) |
| BA-3 | **URL parity**: using the shared `deckSlug` oracle, the deck URL from `llms.txt` **and** the agent API equals `absolute(site, /${entry.slug}/)` and the deck route's emitted path (guards the prefix-doubling trap) | FR-017 (A-03) |
| BA-4 | **reveal-CSS non-leak**: locate the emitted stylesheet asset containing reveal 6's core viewport sentinel (pin the exact literal, e.g. `.reveal-viewport` / the `overflow:hidden` full-page rule) and the token-map sheet; assert their hrefs appear on the deck page and on **no** non-deck page, and neither via a shared chunk a doc page links | FR-010 / NFR-006 (A-06) |
| BA-5 | **Pagefind**: published deck slug is in the index (unique slide phrase resolves to the deck URL); speaker-note `<aside>` text is **not** a result | FR-012 / NFR-006 |
| BA-6 | **RSS exclusion**: published deck URL **absent** from the RSS feed (excluded on `kind: Presentation`) | FR-011 |
| BA-7 | **Draft exclusion**: retained draft deck absent from sitemap/RSS/llms/agent **and the Pagefind index** (page-level `data-pagefind-ignore`); and it does **not** move BA-1 counts | FR-023 |
| BA-8 | **Off-section error**: a `kind: Presentation` page outside `presentations/` fails the validator — proven by a **unit test** (a committed misfiled fixture can't exist) | FR-022 |
| BA-9 | **Print asset**: reveal's print stylesheet is emitted as a bundled hashed asset in `dist` (by content signature) and referenced by `reveal-init.client.ts`'s chunk under the `print-pdf` branch — an asset/bundle check (no distinct `?print-pdf` HTML artifact exists) | FR-013 |
| BA-10 | **Sidebar exclusion (D5)**: the deck URL is **absent** from the rendered in-frame sidebar `<nav>`; the overview page **is** present | ADR-0021 D5 |

## a11y (extend `tests/a11y/`)

| ID | Check | Tool |
|---|---|---|
| AX-1 | deck route passes axe (`wcag22aa`, no serious/critical) in **light and dark** | axe (static) |
| AX-2 | every `<section>` has an accessible name (heading or `aria-label`); nav controls are `<button>`s with labels; one labelled main region; AA size-aware contrast | axe (static) |
| IX-1 | arrow/space/Esc reach every slide; visible focus; no keyboard trap | Playwright interaction |
| IX-2 | `getComputedStyle(currentSlide).transitionDuration === '0s'` under emulated `prefers-reduced-motion: reduce` | Playwright interaction |
| IX-3a | JS disabled (`javaScriptEnabled:false` context / raw HTML fetch) → every slide's text present in initial HTML in document order | Playwright (no-JS) |
| IX-3b | axe over the **pre-enhancement SSR DOM** (JS-enabled, before reveal init — or `axe-core` via jsdom over static `dist` HTML), no serious/critical (axe cannot run in a JS-disabled page) | axe (static DOM) |
