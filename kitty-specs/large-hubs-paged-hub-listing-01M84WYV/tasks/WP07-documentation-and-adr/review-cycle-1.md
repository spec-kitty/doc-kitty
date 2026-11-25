---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-paged-hub-listing-01M84WYV
reproduction_command:
reviewed_at: '2026-11-25T06:47:55Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP07
---

# WP07 review, cycle 1: REJECT (claude::reviewer-renata)

Reviewed: `feat/342-paged-hub-listing` @ bda45d6e. Docs checked against the final
code on lane-f @ f798acd0 and coordination @ e6b85925.

## Blocking

1. **The open locale-alternates question is not recorded.** On a listing page,
   the hreflang alternates and the language picker can point at listing pages
   that were never built (`missions/page/4` links to `fr/missions/page/4`). This
   is held for the operator (consolidation notes, "Held for the operator").
   Neither ADR-0089 (Risks) nor the guide's Limits says so. Record it as an open
   question, not as decided.
2. **The `cappedHubCaps` contract row is missing (deviation 1 not accepted).**
   The WP02 cycle-2 approval and consolidation item 6 ask for a row in
   `contracts/paging-api.md` AND the docs. The guide's API table covers the docs
   half only; `contracts/paging-api.md` @ e6b85925 has no `cappedHubCaps` row.
   Add it, recorded as an out-of-map edit.
3. **One required limit is undocumented.** A page with Starlight `draft: true`
   and `doc_status: active` is not routed in production, yet it trips the `page`
   collision guard (deliberate fail-loud, consolidation item 7). The guide's
   "A page named `page`" section must say so.
4. **The guide says listing pages are "included in every surface", but RSS and
   Atom do not carry them** (by design, consolidation WP06 carry-over (g); no
   paged entries in the feed routes on lane-f). Name the feeds as the exception
   in "Where the listing pages appear", and in ADR-0089 decision 5.

## Non-blocking

5. Nothing prunes `<cacheDir>/doc-kitty-hubs/*.hubs.json` (WP05 cycle 2 note).
   Worth one line in ADR-0089 Consequences, Negative.
6. ADR-0089 gives the locale rule (Q5) only as a risk. Say it is the operator's
   ruling (locales follow #341), as decisions 2, 5 and 7 do for page size, Q3 and Q4.
7. The guide documents `listing_of`, `page`, `of` and `children` but does not
   name the `ListingChild` type (`src/lib/contract.ts`). Note: WP06 carry-over
   (e) says the guide has neither the CSP hash nor the listing fields. That is
   wrong for bda45d6e: both are present.

## Verified

- ADR-0089 is Proposed, not Accepted. 0089 is free on main, both sibling
  missions and every remote branch. Q3 (quoted), Q4 (decision 7) and the
  separate page-size setting are recorded accurately.
- Against lane-f: the page-size precedence; the `[dk-config]`, section and
  frontmatter messages; the `RangeError`; the exact `page` collision message,
  case-insensitive; no `page/1`; the seven-page pagination rule; the five
  pagination strings; the `Listing` record position and fields; the per-page
  `children`; the `llms.txt` line `children A–B of C`; the feeds and
  `agent.discoverable` gating of listing records; and the `docsDir` fix in
  `hub-cards.ts` (so nothing to document).
- The CSP hash `sha256-dlpk7sxv9SQrYU5m52WcuINGV5NwRI/Y3N3Ida3KAhE=` matches
  `assert-build-artifacts.mjs:2996` on lane-f.
- The changelog fragment follows `docs/changelog/unreleased/README.md`:
  `section: Added`, a bold lead with the issue numbers, "Before … Now …",
  links from the repository root.
- Deviation 2 confirmed: `validate:adr-index` fails on main @ 1acc49f.

## Gates on bda45d6e

- `validate:docs` 219 files OK; `validate:links` 1964 OK; `validate:changelog`
  13 fragments OK; `validate:adr-ids` 86 unique.
- markdownlint, 7 changed files: 0 issues.
- lint OK; typecheck OK.
- `pnpm test`: src 241 files / 4745 tests, mcp 23 / 181, all green; no flakes
  tripped; no glossary side effects.
- Vale not run (not installed here).
