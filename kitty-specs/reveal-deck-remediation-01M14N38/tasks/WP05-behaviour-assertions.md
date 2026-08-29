---
work_package_id: WP05
title: Behaviour assertions (the non-fakeable lock)
dependencies:
- WP01
- WP02
- WP03
- WP04
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-008
- NFR-001
- NFR-002
- NFR-004
planning_base_branch: fix/reveal-deck-remediation
merge_target_branch: fix/reveal-deck-remediation
branch_strategy: Planning artifacts for this mission were generated on fix/reveal-deck-remediation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/reveal-deck-remediation unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
- T020
- T021
- T022
- T023
- T024
history:
- '2026-08-28: authored by /spec-kitty.tasks (planner-priti)'
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent: []
execution_mode: code_change
owned_files:
- tests/a11y/deck.interaction.spec.ts
- tests/a11y/diagram.spec.ts
- tests/a11y/routes.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Run `/ad-hoc-profile-load frontend-freddy` (role: implementer) BEFORE anything else.
Apply its initialization, boundaries, directives, and tactics. Then read this WP in
full, plus:
- [../spec.md](../spec.md) — FR-001..FR-005, FR-008, NFR-001/002/004; SC-001..SC-005; **C-001**
  (behaviour/DOM assertions ONLY — no visual/a11y snapshot baselines).
- [../plan.md](../plan.md) — **IC-06** (the mandatory assertion list, with line cites).
- Both contracts:
  [../contracts/slide-aware-diagram-render.md](../contracts/slide-aware-diagram-render.md)
  (the assertion table rows C1/C2/C3/C4/B3/C7) and
  [../contracts/deck-chrome-and-metadata.md](../contracts/deck-chrome-and-metadata.md)
  (C1 FR-002, C2 FR-003, C3 FR-001 promoted).
- [../reviews/post-plan-squad.md](../reviews/post-plan-squad.md) — findings **C1–C7**
  (fakeable proxies), **B3**, **D2/D3/D6**, **E3**.

## Objective

Lock every fix with DOM/behaviour assertions in the Playwright deck suite so #12/#15
cannot silently regress. Every assertion below is MANDATORY (squad findings B/C) — none is
"floating/optional". FR-001 is PROMOTED into the FR-008 locked set (it is the P1 "first
thing an adopter sees" defect and must not stay manual-only). No snapshot baselines (C-001).

You own three test files:
- `tests/a11y/deck.interaction.spec.ts` — the live reveal-enhanced deck interaction spec.
- `tests/a11y/diagram.spec.ts` — already home to the deck-diagram/theme-toggle/footprint
  idioms (`gotoDeckInMode`, the deck first-slide `toHaveCount(1)` at `:115`, the footprint
  helpers at `:190-222`). REUSE them; do NOT duplicate helpers and do NOT copy its WEAK
  per-page theme-toggle assertion at `:135`.
- `tests/a11y/routes.ts` — route + selector constants. Add the diagram-free deck route;
  KEEP the deck `renderCount:1`.

**Depends on WP01–WP04.** You assert their behaviour and consume WP04's fixtures.

### RED-before-green discipline (DIRECTIVE_034/041) — REPRODUCIBLE, not honor-system (F2)
The FR-004 assertion (T019) must be proven RED against the PRE-FIX render owner. This
CANNOT be witnessed by the normal local-then-CI flow: this WP branches DOWNSTREAM of WP01's
fix (the tree is already green), the local `node_modules` is broken (no `astro`/`mermaid`/
`vitest`; Playwright is root-owned — see the env hazard), so no local red is possible, and
CI only runs the merged (green) code. So produce a **captured, reproducible** red artifact
by ONE of these mechanics, and paste the failing job output into the PR/commit note:
- **(preferred) scratch-branch revert**: push a throwaway branch that reverts ONLY WP01's
  `render(scope)` change (keeping this WP's T019 test), let CI run it, and capture that
  job's FR-004 failure; or
- **red-in-history**: land the T019 test in one commit BEFORE the WP01 fix on this WP's
  branch, so the red is in git history and re-runnable.

The DoD for this line is discharged by the captured/reproducible red artifact, NOT a prose
"I saw it red" claim. **Flag to the operator that this line cannot be closed by a local
run** (broken node_modules; CI-only). `box>0` alone is fakeable (Mermaid can emit
`width="100%"`+viewBox → non-zero on BOTH buggy and fixed builds), which is why T019 asserts
MEASURED internal geometry AND selects the node by identity.

## Subtasks

### T017 — FR-002: description present in `<head>`, ABSENT from `.slides`
In `deck.interaction.spec.ts`, add a test on the live showcase deck: the front-matter
`description` string is present in `head meta[name="description"]` (the correct metadata
usage) AND absent from the `.slides` text content (it must not leak onto the title slide).

- Read the expected description from the deck's own front-matter identity — assert the
  exact `content` of `meta[name="description"]` is non-empty, then assert
  `page.locator('.slides').innerText()` does NOT contain that string.
- This is the Playwright half of FR-002/C1; WP03 owns the unit half.

### T018 — FR-003: footer visible, titled, positioned, stable (non-fakeable, C5)
Add a test asserting `.dk-deck-footer`:
- `toBeVisible()` (NOT merely present — an empty/hidden footer must FAIL);
- has non-empty `textContent` that CONTAINS `entry.data.title` (i.e. the deck title
  "Showcase Deck") — bind the identity, not "some footer";
- its top edge is near the frame bottom (geometry): read its `boundingBox()` and assert
  `box.y` is in the lower region of the viewport (e.g. `> viewportHeight * 0.7`);
- stays visible after navigating to slide 2+ (press Space/ArrowRight, re-assert
  `toBeVisible()`), proving it is outside `.slides` and not re-rendered per slide.

### T019 — FR-004: distinguishable non-first + inner-stack render, sane geometry, RED-proven
This is the core #15 lock. Use the DISTINGUISHABLE identities WP04 gave the two new
diagrams (their `%% description` sentences — select by caption text the way
`diagram.spec.ts:27,76-79` selects `SEQ_DESC`, NOT `.first()` / "some svg"):
- **Non-first (slide 2)**: navigate to slide 2 (Space/ArrowRight or `?#/1`), wait for the
  render, locate the figure whose `.dk-diagram__desc` contains the slide-two sentence, and
  assert its `<svg>`:
  - bounding box width > 0 AND height > 0 (NFR-001), AND
  - **MEASURED internal-node geometry (mandatory, F1)**: via `page.evaluate`, call
    `getBoundingClientRect()` (or `getBBox()`) on an internal `<g>`/`<text>` node of the
    SVG and assert it is non-zero — OR compare the SVG's rendered box against the
    correctly-rendered title-slide diagram's box. A **viewBox-derived "aspect ratio" is
    FORBIDDEN** as the proof (intrinsic to the SVG markup, non-zero on BOTH the buggy and
    the fixed build — the exact C1 defect). "Aspect ratio" is acceptable ONLY when computed
    from a rendered/measured rect, never from the `viewBox` attribute. `box>0` alone is
    fakeable; the measured internal geometry is what makes this non-fakeable.
- **Vertical/nested (inner-stack)**: descend into the vertical stack (navigate down into
  the `###` leaf), wait for render, locate the inner-stack figure by ITS sentence, and
  assert the same box>0 + measured internal-node geometry (never viewBox-derived) (D5).
- **RED proof (reproducible, F2)**: discharge via the captured CI red artifact described in
  the "RED-before-green discipline" section above (scratch-branch revert of WP01's
  `render(scope)`, or the test landed one commit before the fix) — NOT a prose claim, and
  NOT a local run (broken node_modules; CI-only).

Reuse `gotoDeckInMode` / the `.reveal.ready` + `${LEAF_SLIDE}.present` wait helpers
(`deck.interaction.spec.ts:28,33-38`); the render on `slidechanged` is async, so wait for
the `<svg>` (e.g. `expect(...).toHaveCount/ toBeVisible` with a timeout) rather than
reading synchronously.

### T020 — FR-004 print-pdf completeness: EVERY node renders in one pass (C3)
Add a test (currently ZERO assertions exist for this path): load the deck with the
`?print-pdf` query, wait for layout, and assert that EVERY `pre.mermaid` in the document
— the title diagram, the slide-2 diagram, AND the inner-stack diagram — has an `<svg>`
with box>0, in one pass (all slides are visible at once in print view). This exercises the
`controller.isPrintView` all-nodes path from WP01. Count the `pre.mermaid` nodes and assert
the count of box>0 `<svg>`s equals it. **Poll with a timeout ≥ the 3s `whenRevealReady`
fallback + layout settle (F5)** — e.g. `await expect(page.locator(...)).toHaveCount(n, {
timeout: 10_000 })` — never read the count synchronously; the render is async and the
ready gate can take up to its 3s fallback (`DeckLayout.astro:163`).

### T021 — FR-005: away-and-back one `<svg>`; theme-toggle palette-change (C4); B3; rapid-nav (E3)
Add tests for the render-once + theme invariants:
- **Away-and-back**: navigate to the slide-2 diagram (renders), navigate away, navigate
  back; assert exactly ONE `<svg>` for that node (no duplicate, no blank re-render). Use
  the per-node svg-count probe pattern from `diagram.spec.ts:50-58` (`svgMarkupPerNode`).
- **Theme toggle (non-fakeable, C4 + F4)**: after the node has rendered, toggle
  `document.documentElement` `data-theme` to the other mode; assert (a) still exactly one
  `<svg>` for the node, AND (b) a palette EQUALITY on a **directly-mapped** attribute only:
  the node `<rect>` / `.node` `fill` equals the other mode's resolved `--dk-diagram-node-fill`
  (= Mermaid `mainBkg`/`primaryColor`), **normalized hex↔`rgb()`** before comparing. Do NOT
  assert equality on stroke/label colours — Mermaid derives some of those via internal
  colour math, so they are NOT byte-equal to a token; treat those only as "changed", not
  "equals". A no-op toggle must FAIL. This strengthens the weak `diagram.spec.ts:135` check
  (which only counts SVGs); do NOT copy it.
- **Toggle-while-unvisited then navigate (B3)**: toggle the theme while the slide-2
  diagram is STILL UNVISITED (never navigated to), THEN navigate to it and assert a correct
  render (box>0 AND measured internal-node geometry non-zero, per T019 — never
  viewBox-derived). This proves INV-SCOPE: the theme observer did NOT run Mermaid over the
  hidden zero-box node and re-open #15.
- **Rapid navigation (E3)**: page quickly across several slides and back; assert every
  diagram node still has exactly one `<svg>` (the in-flight coalescing guard holds).

### T022 — NFR-002 MANDATORY footprint on the diagram-free PUBLISHED deck (C7)
Add the diagram-free deck route to `routes.ts` (a new constant, e.g.
`deckNoDiagram: `${BASE}/presentations/roadmap-deck/``) — you own `routes.ts`. Then add a
network test (in `diagram.spec.ts`, reusing the `traceRoute` helper at `:195-204`): navigate
to the `roadmap-deck` route, settle the network, and assert 0 request URLs match
`/mermaid/i`. This is now MANDATORY, not optional — it is the only observable proof of
INV-SINGLE-OWNER/footprint at deck level (the existing FP-1 covers doc-page routes only,
and citing the production guard is circular). Do NOT add this deck to `AXE_PAGES` (it is a
footprint fixture, not an axe target) and do NOT give it a `renderWait`.

### T023 — FR-001 promoted: computed-style token assertions (C6, NO screenshots)
Add non-visual computed-style assertions on the live deck (respecting C-001 — no
screenshots). Read each resolved token from `:root` in the SAME `page.evaluate` and compare
to the observed value — never a weak "≠ #000". **Normalize hex↔`rgb()` before comparing
(F3)**: `getComputedStyle(...).backgroundColor` returns `rgb(255, 255, 255)` while
`getPropertyValue('--dk-color-bg')` returns `#ffffff`, so parse both to a canonical form
(e.g. compare normalized `rgb()` triples) — a raw string `===` would fail on correct
styling. Assert:
- viewport `backgroundColor` EQUALS the resolved `--dk-color-bg`;
- the active-slide heading `color` EQUALS the resolved `--dk-color-text-strong`;
- `.reveal` `font-family` CONTAINS the brand sans (`--dk-font-sans`);
- `.dk-deck-footer` background resolves to a brand surface token (e.g. `--dk-color-surface-1`);
- the title-slide `img` height is ≤ the reveal stage height (the R4 hero-overflow gap).

**Ordering (hard intra-mission dependency, F3)**: these targets CANNOT be finalized until
WP02 has RUN and RECORDED its T006 finding against the BUILT deck (the computed
`background-color` / heading `color`). Assert equality against WP02's recorded resolved
values. If T006 found token-map non-resolution rather than thin rules, the "equals resolved
`--dk-*`" form still holds once resolution is fixed — but the resolved VALUES come from
WP02's record, not a guessed literal. Do NOT invent the targets before WP02 reports.
Delete/replace the stale `deck.interaction.spec.ts:237-239` "currently unthemed
(transparent viewport)" comment and its assumption now that the deck is themed.

### T024 — `routes.ts` housekeeping: keep `renderCount:1` (D2); `slideSentinels` only if changed (D6)
- The deck `AXE_PAGES` entry MUST keep `renderCount: 1` (`routes.ts:186-193`). A slide-2
  diagram is `display:none` at load and renders only on `slidechanged`, so it does NOT add
  to the load-time render count — a naive bump to 2 would HANG the axe gate forever (D2).
  Leave it at 1. Add a one-line comment noting WHY (the load-time count is title-slide only).
- The IX-3a `slideSentinels` array (`deck.interaction.spec.ts:186-192`) only needs updating
  if WP04 added a NEW slide. WP04 added diagrams INSIDE existing slides (no new slide), so
  the sentinels should be unchanged — VERIFY against the built deck and update only if the
  slide structure actually changed (D6).

## Branch Strategy

Planning base and final merge target: `fix/reveal-deck-remediation`. This WP branches from
its dependencies (WP01–WP04) in the worktree allocated to its lane in `lanes.json`; changes
merge back into the mission branch. Terminal WP — runs in Wave 3.

## Definition of Done

- FR-002 Playwright: description in `head meta`, absent from `.slides` (T017).
- FR-003: `.dk-deck-footer` visible, title-bearing, bottom-positioned, stable across nav (T018).
- FR-004: the distinguishable non-first AND inner-stack diagrams render with box>0 AND
  MEASURED internal-node geometry (never viewBox-derived, F1), selected by identity; the
  FR-004 RED-before-green is discharged by a CAPTURED, reproducible CI red artifact (F2),
  NOT a prose claim — this line cannot be closed by a local run (broken node_modules;
  CI-only); print-pdf renders EVERY node in one pass, polled with timeout ≥ 3s (T020/F5).
- FR-005: away-and-back → one `<svg>`; theme toggle → one `<svg>` AND `fill` equality on the
  node `<rect>`/`.node` (= `--dk-diagram-node-fill`, normalized; no-op fails) with other
  attributes only "changed" not "equals" (F4); toggle-while-unvisited then navigate →
  correct render (B3); rapid-nav → one `<svg>` per node (T021).
- NFR-002: the diagram-free `roadmap-deck` route resolves 0 `/mermaid/i` requests
  (mandatory, T022); the route constant is added to `routes.ts`.
- FR-001: computed-style token assertions equal WP02's RECORDED T006 resolved values
  (hex↔`rgb()` normalized, F3); hero ≤ stage (T023); the stale "unthemed" comment is
  removed. These targets are finalized only AFTER WP02 records T006.
- Deck `renderCount` stays 1; `slideSentinels` verified/updated only if needed (T024).
- No visual/a11y snapshot baseline added or regenerated (C-001). The full a11y lane green.

## Risks

- Live reveal timing: diagram render on `slidechanged` is async — always wait for the
  `<svg>` (poll/expect-with-timeout), never read synchronously (the IC-06 timing risk).
- `renderCount:2` is the classic trap — it hangs the axe gate. Keep it 1 (D2).
- Selecting "some svg on the page" lets the already-working title diagram discharge FR-004
  vacuously (C2) — always select the non-first/inner node by its own caption identity.
- A theme-toggle test that only counts `<svg>` passes on a no-op toggle (C4) — assert the
  palette actually changed.
- Do not add `roadmap-deck` to `AXE_PAGES` or give it a `renderWait` — it has no diagram to
  gate on and would hang.

## Reviewer guidance

- Confirm every FR-004 selector targets a node by its WP04 identity sentence, not `.first()`.
- Confirm the theme-toggle assertion checks a palette-bearing attribute changed, not just
  the `<svg>` count.
- Confirm the B3 test toggles BEFORE first visiting the slide-2 node.
- Confirm `renderCount` is still 1 and the deck `slideSentinels` still match the built deck.
- Confirm the footprint test navigates to the diagram-free `roadmap-deck` and asserts zero
  `/mermaid/i` — the single observable NFR-002 proof.
