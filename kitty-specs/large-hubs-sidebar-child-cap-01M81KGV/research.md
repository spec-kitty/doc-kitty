# Research: Large hubs: sidebar child cap

## R1 — Where the cap is enforced

- **Decision**: inside `shapeSidebar`, on the group whose directory is a capped hub, after its entries are ordered and before the one-page-folder rule.
- **Rationale**: the one seam every page passes through (design note); the group's directory is already derived there. No carrier (ADR-0063).
- **Alternatives**: a `Sidebar` carrier filter (rejected: carrier lock, and Starlight's pagination would still see every child); only the `sidebar.hidden` hint (rejected: needs every author to mark pages).

## R2 — Counting and ordering children

- **Decision**: `selectHubChildren` over the build-time page list (slug, title, doc_status), the same function `Hub.astro` uses.
- **Rationale**: the "N pages" count and prev/next must match the hub listing, and #342 pages that same list (C-003).
- **Consequence**: drafts are never counted, even in a build that publishes drafts, as the hub never lists them. A published draft child still marks the capped entry current (membership is by directory) and keeps Starlight's own prev/next.

## R3 — Identifying the capped entry

- **Decision**: a plain Starlight link with the hub's href, `isCurrent` set on descendant pages, and a non-HTML property `dkCappedHub: <dir>` (the same technique as `dkDir` on groups).
- **Rationale**: Starlight renders it as a normal link, so `aria-current` and open-group behaviour come for free (a group holding a current entry opens). The marker lets pagination, relabelling and icons skip it without emitting an attribute.
- **Alternatives**: an `#fragment` href (rejected: link checkers validate fragments); `attrs` marker (rejected: reaches the HTML of every capped page).

## R4 — Pagination

- **Decision**: build a pagination tree where each capped group holds its index link and the full child list in hub order, with the current page marked, and hand it to `shapePagination`. Extend `shapePagination`: when the current page is missing from Starlight's tree (pre-hidden) but present in the expanded tree, re-derive each side the author did not set.
- **Rationale**: reuses the existing side rules (author `prev`/`next` and `pagination: false` are respected). Without capped hubs the expanded tree is the shaped tree, so output is unchanged.

## R5 — Label

- **Decision**: `sidebar.cappedLabel` site option → `dockitty.sidebar.cappedEntry` translation → `{count} pages`; `{count}` replaced with the plain integer, so the build does not depend on the host locale.
- **Rationale**: mirrors `resolveIndexLabel` (#161).

## R6 — Hidden hint

- **Decision**: `cappedChildHidden(childCount, cap)` → `childCount > cap`. Shaping does not rely on Starlight's tree for count, order or current marking, so pre-hidden children give the same result.
- **Rationale**: generated producers know their child count before Starlight runs; the toolkit owns the rule.

## R7 — Fixture and measurement

- **Decision**: a build suite writes a site under `example/.dk-test-sidebar-cap` with a 200-child capped hub and an all-hidden variant, and asserts cap+2, current marking, prev/next order and hint equivalence on the built HTML. Byte-identity uses goldens, as the chrome baseline does: a second, uncapped-only fixture site (a 10-child hub) is built on the mission's base commit, its pages' HTML hashes are committed with a `CAPTURED_ON` commit id, and the suite compares today's build against them. The existing chrome baseline suite (`chrome-baseline.test.ts`) is a second, independent byte-identity check on an uncapped site. A standalone script builds a 1,000-child site capped and uncapped (`childCap: 5000`) three times each and prints build time and median page size.
- **Rationale**: keeps 200 pages out of the deployed example (decision DM child_fixture).
