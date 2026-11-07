---
affected_files: []
cycle_number: 1
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-06T10:39:02Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP04
---

# WP04 review: changes requested

Reviewer: claude:claude-opus-5-5:reviewer-renata, on commit b43259e.

## Issue 1 (blocking): the golden comparison no longer proves block order (FR-013, a [ratchet] requirement)

`normaliseMetadataBlocks()` in `src/tests/fixtures/chrome/harness.mjs` cuts each block out and leaves nothing behind, so where a block sat is no longer compared. A block can move anywhere on the page and the normalised pages still match.

Reproduced: in `src/components/slots/OnThisPage.astro`, move the `hasRelated` panel after the `hasReferences` panel. With that mutation, `pnpm test` exits 0 (3762 and 178 tests pass) and `pnpm build:a11y && pnpm assert:artifacts` exits 0. The unnormalised golden comparison this replaced compared those bytes. FR-013 says non-hub pages keep their block order, and OnThisPage's own comment calls the order intentional.

Fix: leave a marker where each block was, in `normaliseMetadataBlocks`:

    page = `${page.slice(0, open.index)}<!--block:${panel}-->${page.slice(elementEnd(page, open.index, open[1]))}`;

I tried this temporarily, then reverted it. Unmutated, `chrome-baseline` and `hub-block-order` pass (28 tests) with goldens unedited. With the swap, 2 tests go red: the page comparison in each file.

Also add a case to the `normaliseMetadataBlocks keeps the page comparison honest` describe in `chrome-baseline.test.ts`: two blocks swapped must not compare clean. It should fail on today's normaliser.

## Non-blocking, your call while you are in here

- `src/styles/disclosure.css`, print rule: `::details-content` needs Chrome/Edge 131, Firefox 143 or Safari 18.4 (caniuse: 89.81% global). In older browsers a closed block does not print. A `beforeprint`/`afterprint` pair in `disclosure.client.ts` that opens closed `.dk-panel.dk-disclosure > details` and restores them is about six lines and covers those browsers with scripts on. Scripts off on those browsers has no CSS route. Only Chromium is installed here, so the print rule itself is verified on Chromium only.
- `src/styles/disclosure.css`, chevrons: `.dk-disclosure > details[open] > summary...` shares a selector list with a `:dir(rtl)` selector. A browser without `:dir()` (before Chrome 120 or Safari 16.4) drops the whole rule, so the open chevron stops turning with scripts off in LTR too. Split it into two rules.

## Coordination

`src/tests/fixtures/chrome/harness.mjs` and `src/tests/chrome-baseline.test.ts` are also changed in lane-e (WP05) and lane-h (WP08). Expect to reconcile them at merge.

## Verified fine, no rework needed

Everything else held: FR-014, FR-015, FR-016, FR-018, SC-003, NFR-002 to NFR-005, the `assert-chrome-artifacts.mjs` change, the `blocks` region, Audience naming and the gap in `disclosure.css`. The Prose axe failure and the brand home visual failure both reproduce on `main` and are not this WP's.
