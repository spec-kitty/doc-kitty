# Tasks: Readable build-time diagrams in both themes

**Mission**: `diagram-dark-contrast-label-clipping-01M801Y5`
**Planning base / merge target**: `main` (via the mission branch `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5`)
**Issues**: spec-kitty/doc-kitty#369 (items 1 and 2), spec-kitty/doc-kitty#370

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Fixture page with long labels, an author-font diagram, author fills and an ArchiMate view | WP01 | |
| T002 | Pixel-based legibility helper (contrast + overflow) | WP01 | [P] |
| T003 | Browser spec over the fixture: both themes, 1280 px and 390 px | WP01 | |
| T004 | Register the fixture route; prove the spec red on `main` | WP01 | |
| T005 | Pin the label font in the render page (`css` option) and fold it into the cache salt | WP02 | |
| T006 | Pin the same label font at display time (figure and lightbox) | WP02 | [P] |
| T007 | Author-fill label contrast pass for Mermaid hast | WP02 | |
| T008 | Author-fill label contrast pass for PlantUML raw SVG | WP02 | |
| T009 | Register the pass after the sentinel rewrite; unit tests; preset assertions | WP02 | |
| T010 | Update the diagrams architecture page | WP03 | [P] |
| T011 | Changelog fragment | WP03 | [P] |
| T012 | Issue root-cause comment draft and consumer report | WP03 | |

## WP01 — Fixture and red browser check

**Prompt**: [tasks/WP01-fixture-and-browser-check.md](tasks/WP01-fixture-and-browser-check.md)
**Goal**: one example page reproduces every defect, and one Playwright spec measures it in both themes, red on `main`.
**Priority**: P1. **Independent test**: `pnpm test:a11y --project=light --project=dark diagram-legibility` fails on `main` with the ArchiMate labels, the pale-fill label and three clipped labels.
**Dependencies**: none.

T001 Fixture page (WP01)
T002 Legibility helper (WP01)
T003 Browser spec (WP01)
T004 Route + red proof (WP01)

Risks: the backdrop must come from pixels, not a DOM walk (research R4). In client render mode the spec skips.

## WP02 — Font pinning and author-fill label contrast

**Prompt**: [tasks/WP02-font-and-label-contrast.md](tasks/WP02-font-and-label-contrast.md)
**Goal**: labels fit their boxes and stay readable on author fills; the WP01 spec turns green.
**Priority**: P1. **Independent test**: `pnpm test` (new unit tests) and the WP01 spec, green after a fresh build.
**Dependencies**: WP01.

T005 Render-page font pin + cache salt (WP02)
T006 Display-side font pin (WP02)
T007 Mermaid author-fill pass (WP02)
T008 PlantUML author-fill pass (WP02)
T009 Registration + unit tests (WP02)

Risks: PlantUML arrives as one raw HTML string; edit only inside `<g class="entity">` blocks.

## WP03 — Docs, changelog and reporting

**Prompt**: [tasks/WP03-docs-and-changelog.md](tasks/WP03-docs-and-changelog.md)
**Goal**: adopters learn what changed; the issues carry the root cause.
**Priority**: P3. **Dependencies**: WP02.

T010 Diagrams page (WP03)
T011 Changelog fragment (WP03)
T012 Root-cause note (WP03)
