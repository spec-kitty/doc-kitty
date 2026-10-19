---
affected_files: []
cycle_number: 1
mission_slug: layout-guards-decisions-01M59CGE
reproduction_command:
reviewed_at: '2026-10-19T08:22:21Z'
reviewer_agent: claude
wp_id: WP06
---

# WP06 review feedback, cycle 1 (reviewer-renata)

Verdict: changes requested. One MEDIUM finding blocks approval. Everything else passes: the simulation, the target collector, the spacing math, the matrix, the fail-first runs, and the scope. The fix is small.

## Findings

[MEDIUM] tests/a11y/no-sidebar-recentre.spec.ts:197 - The collapsed reference end is `frame.end`. The pane ends at the 1px rail hairline (layout-geometry A8), not at the frame end, so the hairline is absorbed into the +-1 tolerance. Unmutated, |startGap - endGap| is exactly 1.00 at all five widths, so the test has no headroom on one side. Reviewer evidence (temporary untracked spec copies, now deleted): shifting the column 0.5px toward the start (`position:relative;left:-0.5px` on the column) turns all five collapsed cells red (e.g. 1152 gaps 65 / 67, 1600 295 / 297). Shifting it 1px toward the end leaves all five collapsed cells green. So any harmless sub-pixel change on one side goes red, while a 1px drift on the other side passes. The sibling spec already rejects this pattern: tests/a11y/layout-geometry.spec.ts:281 says "A 1px tolerance on a 1px hairline would accept 0 and 2, so this one is exact", and A10 (line 286-290) centres against `pane.end`. - Fix: account for the hairline explicitly. Use `inline(railContainer).start` (the hairline's start, which is the pane's end) as the reference end in BOTH states, and in the collapsed cell assert `railContainer.width === 1` exactly (as A8 does), so the frame-relative claim of FR-010 is "centred in the frame less the 1px hairline". The unmutated diff then becomes 0, and +-1 is symmetric. Update the header comment (lines 84-88) and the `centring()` doc comment. Re-run the positive control and the forced-mutation run, and add the new numbers to the history.

[LOW] tests/a11y/no-sidebar-recentre.spec.ts:163-176,198-199 - Both paddings (pane and content panel) are read from the live page and subtracted. A regression that makes `.main-pane` or `.content-panel` padding asymmetric would move the column without failing R1, because the reference moves with it. Subtracting the padding is correct by itself: it matches A10, and #217 deliberately widens the collapsed end padding to 36px below 84rem, where the raw frame gaps differ by 13px by design. - Fix (recommended in the same pass): pin the expected paddings per width (24/24 at >= 84rem; 24/36 collapsed below 84rem), or at minimum assert paneStart === paneEnd at 1600/1920/2560.

[LOW, non-blocking] tests/a11y/helpers/targets.ts:29 - The footer region is `.pagination-links` + `.dk-site-footer`. It does not include Starlight's footer `.meta` (edit link, last updated). That block is empty in the example, so nothing is missed today. - Fix (optional): also root the region at Starlight's page `<footer>` (the one that contains `.pagination-links`), so a consumer that enables editLink is covered.

## Checked and passing (no action)
- Simulation: removes `data-has-sidebar`, `nav.sidebar` (exactly 1) and any stray `.sidebar-pane`/`#starlight__sidebar`. It asserts that the attribute and sidebar were present first, that no sidebar is left afterwards, and that `data-has-toc` stays. The removed wrapper also holds the mobile menu button (`button[popovertarget]`, `md:sl-hidden`, so `display:none` at >= 50em). It is irrelevant at the desktop widths tested, and a real `hasSidebar:false` page has no wrapper and no button either, so the simulation is faithful.
- Target collector and spacing check: the visibility filter, union rect plus per-line rects, the 12px centre-to-rect and 24px centre-to-centre rules, nested pairs skipped through the index path, per-region non-vacuity, the toggle-only collapsed rail, and the 390 x 800 menu-open sidebar cells. The synthetic cases cover all four cases the prompt asks for, plus nesting.
- Fail-first (re-run by the reviewer): recentre with the margin mutation forced into every cell went red (8 failed: all collapsed cells, and expanded at 1600/1920/2560). Targets with the rail-link mutation went red (6 failed, all expanded cells, with `rail "..." 228x15` messages). Both are green unmutated (31 passed).
- eslint covering `src` only is a pre-existing repo fact (`"lint": "eslint src"` on the mission base). It is out of scope here.
- Scope: one WP commit (1c288c7), the 4 owned files only, no product files, and no mode changes.
