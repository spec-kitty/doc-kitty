# Post-tasks adversarial squad — M6 Slide Decks

Three lenses reviewed the finalized WP breakdown (decomposition — planner-priti;
prompt quality — reviewer-renata; ADR realization — architect-alphonso), grounded in the
live codebase. All findings folded into the WP files / contracts / tasks.md before
implementation. Verdicts: remediate-then-implement (Priti), NEEDS-REVISION (Renata),
NOT READY → resolved (Alphonso).

## Convergent BLOCKER/MAJOR findings and disposition

| Finding (lens IDs) | Disposition |
|---|---|
| **Sidebar D5 orphan** — no WP owned ADR-0021 D5; the published deck would autogenerate an in-frame sidebar link (the reader-ejection D5 forbids). *(AT-01 BLOCKER, PT-02)* | **fixed** — WP04 **T028** owns `sidebar: { hidden: true }` deck frontmatter + BA-10 assertion (deck absent from sidebar nav, overview present); `example/astro.config.mjs` given an owner (WP01). |
| **URL-parity crux** — contract's `slugFromEntry` is fictional; the real hazard is prefix-doubling (`entry.slug` already has `presentations/`). *(RT-01 BLOCKER, AT-02)* | **fixed** — shared `deckSlug`/`deckRouteParams` helper in WP01-owned `src/lib/deck/deck-slug.ts`, imported by the route **and** the BA-3 assertion; contract rewritten; the strip-and-reconstruct rule spelled out. |
| **config.ts remark seam** — no existing `remarkPlugins` seam; "mirror existing" is wrong. *(PT-01, RT-10)* | **fixed** — WP02 T008 rewritten as net-new `astro:config:setup`→`updateConfig`, inserted after GFM, frontmatter already stripped. |
| **Print assertion unbuildable** over static `dist` (client import gated on `location.search`). *(PT-03, RT-02)* | **fixed** — BA-9 re-scoped to an asset/bundle check (print sheet emitted by signature + referenced in the init chunk's print-pdf branch). |
| **reveal-CSS non-leak: detection owned, remediation + signature not.** *(AT-03, RT-03)* | **fixed** — WP01 T003 pins the isolation *mechanism* (`?url`+`<link>` / `?inline`, `cssCodeSplit` fallback owned in `astro.config.mjs`); BA-4 names the core viewport sentinel. |
| **No-JS + axe is self-contradictory** (axe runs as page JS). *(RT-04)* | **fixed** — WP05 T025 split into IX-3a (text presence via `javaScriptEnabled:false`) + IX-3b (axe over pre-enhancement SSR DOM / jsdom). |
| **Off-section guard (BA-8) unproven.** *(PT-05, AT-05)* | **fixed** — WP01 T006 adds a validator unit test (a committed misfiled fixture can't exist). |
| **Draft deck Pagefind leak** — draft route emits indexable HTML. *(RT-05)* | **fixed** — WP01 T003 puts page-level `data-pagefind-ignore` on draft decks; BA-7 now asserts draft absence from the Pagefind index. |
| **Lint-config ownership** — WP04's exception hatch touched unowned config. *(PT-04, RT-06)* | **fixed** — `.markdownlint.jsonc` + `.vale.ini` added to WP04 `owned_files`; T021 requires path-scoped `[presentations/**]` exceptions with recorded rule IDs. |
| **AA as a hard gate** — was a soft "confirm/fix if needed." *(PT-06, RT-11)* | **fixed** — WP01 T005 is a hard gate; WP05 notes a contrast failure is a hand-back to WP01. |
| **Missing vitest edges / SECTION_ORDER "115" / rss filter placement / `###`-before-`##`.** *(PT-08, RT-08, RT-07, RT-09)* | **fixed** — WP02 T012 adds no-`##` + last-wins + `###`-before-`##`; WP03 T013 filters in `rss.ts` (not `rankForFeed`); T014 drops the "115" index confusion. |
| **Over-serialized deps** — WP03 dep on WP01 unnecessary. *(PT-07)* | **fixed** — WP03 `dependencies: []` (WP04 still enforces the must-precede ordering). WP06→WP04 kept for docs-of-record narrative coherence. |
| **WP01 T007 = routing go/no-go gate** — no plan-B owner if shadowing throws. *(AT-04)* | **fixed** — WP01 T007 marked the mission-level go/no-go gate; a duplicate-route error escalates to a design change. |

## Confirmed clean (probed, no action)

- config.ts contention (WP01 vs WP02): clean — WP01 needs nothing in `src/lib/config.ts`.
- Green-at-every-boundary holds (WP01 draft deck renders un-split between WP01 and WP02).
- Pagefind body/ignore handoff (WP01 `.slides` / WP02 note aside) is an explicit contract.
- `--dk-width-deck` already exists (`theme.css:87`) — T005's width half is a no-op verify.
- Every ADR-0022 D1–D6 decision has an owning subtask.

No contested finding was silently dropped.
