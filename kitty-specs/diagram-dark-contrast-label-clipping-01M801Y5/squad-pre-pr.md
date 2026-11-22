# Adversarial squad: pre-PR (2026-11-22)

Point-cut: after acceptance, on branch `fix/369-370-diagram-legibility`.
Question: is this branch correct, non-vacuously tested, and safe to land for doc-kitty and its first consumer?
Cast (profile-loaded, read-only, parallel): reviewer-renata (correctness and regressions), frontend-freddy (test trustworthiness and CI), architect-alphonso (architecture, theme contract, consumer).
All three verdicts: SHIP-WITH-FIXES.

## Findings and dispositions

| # | Lens | Severity | Finding | Disposition |
|---|------|----------|---------|-------------|
| 1 | freddy | BLOCKER | `tests/a11y/sidebar-membership.spec.ts` keeps its own copy of the sidebar drafts; the fixture was missing, so published-light fails | Accepted, fixed in 904717d; published-light green |
| 2 | freddy | MAJOR | Two silent `continue`s drop labels; `>= 20` floor too loose | Accepted: both now land in `skippedLabels`; exact per-figure counts `[8, 6, 4, 7]` asserted (904717d). The see-through label it reported missing was absent only from the pre-cycle-1 WP01 evidence; it is measured at HEAD (6.38 light, 6.93 dark) |
| 3 | freddy | MINOR | Browser check does not prove the `.labelBkg` rgba halo fix | Accepted as stated: the halo is covered by unit tests only; said so in the PR body |
| 4 | freddy | MINOR | Client-mode `test.skip` unguarded | Accepted: under `CI`, a client-rendered dist fails (904717d) |
| 5 | freddy | MINOR | Lightbox trigger can overlap a top-right label | Accepted: awaited and hidden during the backdrop screenshot (904717d) |
| 6 | freddy | MINOR | Integer scrollWidth vs fractional box, 1 px tolerance | Kept: build and test images share fonts-liberation; red evidence overflowed by 6–23 px. Watch for flakes |
| 7 | freddy | NIT | Most-frequent-pixel heuristic weak on gradients | Kept: fixture uses flat fills |
| 8 | alphonso | MAJOR | #369 item 1 reproduces on the reported page: figure 3's `%%{init}%%` `lineColor: '#0a0721'` is ~1.1:1 in dark; the check exempts author edges | Accepted. Verified live (13 edges `#0a0721` on `#131721`); correction posted on #369. Fix-here vs follow-up put to the dispatcher (see PR body for the outcome) |
| 9 | alphonso | MINOR | Two theme-contract rules warrant an ADR | Put to the dispatcher with the plan to add ADR-0082 |
| 10 | alphonso | MINOR | Docs overclaim "author label colour is kept" (only `classDef`/`style`) | Accepted, fixed in cd17d55 |
| 11 | alphonso | MINOR | Docs say "labels" where only HTML labels are pinned | Accepted, fixed in cd17d55 |
| 12 | alphonso | NIT | Fit sentence then caveat | Accepted, merged (cd17d55) |
| 13 | alphonso | NIT | Changelog "Now," comma; a Changed bullet for the ignored author font | Accepted (cd17d55, `370-diagram-label-font.md`) |
| 14 | renata | MAJOR | PlantUML actor / lollipop interface labels sit outside their first shape but were pinned to its fill colour | Accepted, verified against real PlantUML output; fixed in 0872e90 (pin only when the text anchor is inside the shape box), with real-SVG unit cases |
| 15 | renata | MINOR | `foreignObject *` font rule also overrides a `classDef` font (and KaTeX) | Accepted as a documented limit (diagrams page, 0872e90+1); consistent with operator ruling B |
| 16 | renata | MINOR | SVG-text diagrams (sequence, C4) keep author-font mismatch | Accepted as a documented limit; belongs with #412 |
| 17 | renata | NIT | handDrawn look keeps `fill-opacity` on the wrapper `<g>` | Deferred: classic look unaffected; noted for #412-adjacent follow-up |
| 18 | renata | NIT | `out.includes('rgb')` case-sensitive | Accepted, fixed in 0872e90 |
| 19 | renata | NIT | rgb sentinel inside a `url(data:…)` is rewritten | Kept: same as the existing hex rewrite; no new risk |
| 20 | renata | NIT | PlantUML entity with nested `<g>` (hyperlink) skipped | Kept: fails safe; noted |

## Verification at HEAD 0872e90

- Unit: `diagram-label-contrast`, `diagram-pipeline`, `diagram-preset` 49/49.
- Playwright (light, dark, published-light, published-dark): `diagram-legibility`, `diagram`, `sidebar-membership` 43 passed, 9 skipped (by design). Evidence: `evidence/pr-head/`.
- Full a11y lane: 553 passed; the 10 failures (axe getting-started and brand-home visual in four projects, layout-geometry FR-022 390x600, sidebar-title-as-index chevron) fail identically on untouched `main` in this container.
