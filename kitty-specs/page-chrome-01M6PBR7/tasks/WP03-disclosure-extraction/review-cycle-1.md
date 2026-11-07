---
affected_files: []
cycle_number: 1
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-05T19:32:03Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP03
---

# WP03 review: changes requested

Reviewer: reviewer-renata. Reviewed b44d462 on lane-c. The behaviour is good. The rail is unchanged, the upgrade works in a real browser, and the tests catch mutations. What must change is a false statement in ADR-0077 and in two code comments, because an ADR cannot be corrected after merge. The fix is documentation only, plus one CSS decision.

## Issue 1 (blocking): ADR-0077 and disclosure.client.ts misstate where the sheet goes

Deviation A itself is accepted: keep importing `disclosure.css` from `disclosure.client.ts`. The reason recorded for it is wrong.

The claims:
- `src/lib/disclosure/disclosure.client.ts:6-8`: "other pages' CSS does not change".
- `docs/adr/0077-shared-disclosure-control.md`, Decision: "Astro puts the sheet in the `<head>` of those pages", contrasted with `GLOBAL_COMPONENT_SHEETS`, "which would change the CSS of every page of every site".
- ADR-0077, Alternatives: registering the sheet "would put the control's rules on every page of every site ... whether or not a page has a disclosure".
- ADR-0077, Consequences: "Pages with a disclosure gain a client script and its CSS."

What a build shows: Astro attaches a script-imported sheet by the route's module graph, not by what renders. All docs pages share Starlight's route. A probe component, imported from `MarkdownContent.astro` the way WP04's blocks will be and rendered only when the path contains `getting-started`, gave:

| Page | Component rendered | Sheet inline in head | Script |
|---|---|---|---|
| guides/getting-started | yes | yes | yes |
| guides/install | no | yes | no |
| rhetoric/book-one | no | yes | no |
| presentations (hub) | no | yes | no |
| presentations/markua-deck (deck route) | no | no | not checked |

So once WP04 lands, every docs page carries the sheet, with or without a disclosure. Only the script is per-page. The real gains over `GLOBAL_COMPONENT_SHEETS` are: the deck route stays clean, the sheet arrives inline rather than as an emitted `.css` file, and the WP11 CSS golden stays unchanged.

Fix, before merge:
1. Correct those four statements so they say this. Keep the "applies before first paint and with scripts off" claim: I verified it in the example and in a packed consumer install.
2. Record in the ADR that the sheet is inlined only because it is under Astro's inline limit. `emittedCss()` in `src/tests/fixtures/chrome/harness.mjs:138` reads `.css` files only, so the `css.txt` golden does not see this sheet. It does appear in the `page.html` golden once a component imports it from the carrier, so WP04 should expect that diff.
3. Check the file header of `src/styles/disclosure.css:4-5` ("reaches the `<head>` of a page whose components import that module") against the same finding.

## Issue 2 (should fix, or scope it explicitly): "an upgrade moves nothing" is false inside `.sl-markdown-content`

`src/styles/disclosure.css:6-10` promises one box, and the margin rule at `:43` targets Starlight's content flow, so the sheet reads as supporting in-content use. It doesn't fully:

- Starlight gives `details` in content `padding-inline-start: 16px` and a 2px inline-start border, which this sheet does not reset.
- With scripts off, the summary starts at x=347. Upgraded, the button starts at x=329, so the control and its label move 18px on upgrade. The wrapper's height is unchanged.
- With scripts off, the CSS chevron renders as a stray dot, and a rule shows beside the summary.

The same result came from the example and the consumer build. WP04's mounts sit outside `<Default>`, where every measured box matched, so no planned surface hits this today.

Either reset the padding and border on `.dk-disclosure > details` and fix the chevron in content, or state in the sheet's header that the box promise holds only outside `.sl-markdown-content`. Prefer the first if it stays small.

## Not requested

Do not change the toggle, the rail, the upgrade order, or the tests for these issues. If you reset CSS, rerun `tests/a11y/toc-rail` and `pnpm lint`. After correcting the ADR, rerun `pnpm validate:adr-ids`.

## Handoff notes, no action in WP03

- WP04 should prove the box comparison and the sheet on a page without blocks, in a real browser, since CSS rules have no test yet: breaking the `display: none` hide rule leaves all 29 unit tests green. That is expected at this stage.
- `summary.click()` on a hidden summary was exercised in Chromium only, as Firefox and WebKit are not installed here.
