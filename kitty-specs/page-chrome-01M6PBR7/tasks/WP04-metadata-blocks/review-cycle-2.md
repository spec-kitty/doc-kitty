---
affected_files: []
cycle_number: 2
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-06T11:07:18Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP04
---

# WP04 review cycle 2: changes requested (one item)

Reviewer: claude:claude-opus-5-5:reviewer-renata, on fe4a1b2.

## Issue 1 (blocking): a second `beforeprint` loses the restore list
`src/lib/disclosure/disclosure.client.ts`, the `beforeprint` handler (line ~26) assigns `reopened = [...querySelectorAll(':not([open])')]`. If `beforeprint` fires twice before `afterprint`, the second run finds every block already open, so `reopened` becomes `[]` and `afterprint` restores nothing.

Reproduced with Playwright on the built site (chapter-08, 3 blocks, all closed): beforeprint -> afterprint restores `[false,false,false]` (good). beforeprint, beforeprint, afterprint leaves `[true,true,true]` and aria-expanded `"true"`: the page stays expanded after printing.

Fix: do not overwrite. Accumulate, e.g. `for (const d of document.querySelectorAll(PRINT_BLOCKS)) { reopened.push(d); d.open = true; }`, or `if (reopened.length) return;` at the top of the handler. Add a test: dispatch beforeprint twice, then afterprint, expect the original states.

## Verified fine
- Block order: with Related and External references swapped in OnThisPage.astro, chrome-baseline (page comparison) and hub-block-order-build (non-hub page golden) go red; reverted. Goldens unedited (git diff 8ac4c2e HEAD on golden is empty).
- `:dir()` split: the open chevron rule is independent; RTL and scripts-off chevron tests pass.
- Print fallback: only `.dk-panel.dk-disclosure > details` touched (sidebar and other details unchanged in the probe); single beforeprint/afterprint restores states and aria-expanded.
- metadata-blocks Playwright: 29 passed, 21 skipped (light-only), light/dark/unthemed projects.
- lint, typecheck, build:a11y, assert:artifacts all exit 0.

## Non-blocking note
The fixture page always has an active glossary, so only OnThisPage's order is covered. MarkdownContent's standalone Related-then-External order (glossary inactive) is not covered by the fixture golden; the normaliser also throws if the glossary panel is absent.
