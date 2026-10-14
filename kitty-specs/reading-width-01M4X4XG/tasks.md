# Tasks: Wider reading column and room for wide content

**Mission**: `reading-width-01M4X4XG`
**Branch**: planning base and merge target `issue-154-reading-width` (draft PR to `main`, the operator merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [research/code-grounding.md](research/code-grounding.md), [data-model.md](data-model.md), [contracts/layout-contract.md](contracts/layout-contract.md), [quickstart.md](quickstart.md)

Four work packages, one per concern in the plan's Implementation Concern Map.
The mission is ATDD-first: WP01 commits a red acceptance spec and its fixture;
WP02 turns it green; WP03 moves the existing ratchet and the visual baselines on
purpose; WP04 writes the records. WP03 and WP04 both follow WP02 and do not
share files.

```
WP01 ─► WP02 ─┬─► WP03
              └─► WP04
```

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Wide-table fixture in the example overview page | WP01 | |
| T002 | Route constant for the fixture page | WP01 | [P] |
| T003 | Acceptance spec: column width at 1440/1920, restore to 45rem | WP01 | |
| T004 | Acceptance spec: wide table grows, centred, inside the pane (expanded, collapsed, capped, RTL, 2560 cap) | WP01 | |
| T005 | Acceptance spec: narrow table and small screens unchanged; no horizontal scroll | WP01 | |
| T006 | Show the spec red on the current layout; record counts | WP01 | |
| T007 | New default and `--dk-width-wide` in `theme.css` | WP02 | |
| T008 | Same defaults in `DEFAULT_TOKENS` (`src/lib/theme.ts`) | WP02 | |
| T009 | Container and wide-table rules in `dk-components.css` | WP02 | |
| T010 | Token list in `assert-chrome-artifacts.mjs` | WP02 | [P] |
| T011 | Token agreement cases in `layout-css-contract.test.ts` | WP02 | [P] |
| T012 | Acceptance spec green; full a11y lane and unit suites | WP02 | |
| T013 | Re-measure and move `EXPANDED_MEASURE` with evidence | WP03 | |
| T014 | Regenerate the two visual baselines in the pinned container | WP03 | |
| T015 | Confirm the whole layout spec and the visual spec green | WP03 | |
| T016 | ADR-0052 and the regenerated ADR index | WP04 | |
| T017 | Theming page: both tokens, the restore line, the opt-out | WP04 | [P] |
| T018 | CHANGELOG `[Unreleased]` Changed entry | WP04 | [P] |
| T019 | Docs gates (frontmatter, links, ADR index, markdownlint) | WP04 | |

## WP01 — Acceptance spec and wide-table fixture (red first)

**Prompt**: [tasks/WP01-acceptance-spec-red.md](tasks/WP01-acceptance-spec-red.md)
**Goal**: encode the spec's layout scenarios as a Playwright spec, with a real wide table in the example, committed while the current layout fails them.
**Priority**: P1. **Independent test**: `playwright test tests/a11y/reading-width.spec.ts --project=light` is red on the current CSS for the growth and width cases, green for the unchanged cases.
**Dependencies**: none.

T001 Wide-table fixture in the example overview page (WP01)
T002 Route constant for the fixture page (WP01)
T003 Acceptance spec: column width at 1440/1920, restore to 45rem (WP01)
T004 Acceptance spec: wide table grows, centred, inside the pane (WP01)
T005 Acceptance spec: narrow table and small screens unchanged; no horizontal scroll (WP01)
T006 Show the spec red on the current layout; record counts (WP01)

**Risks**: right-to-left must set `dir` on `<main>` as well as `<html>`; the fixture must wrap, not scroll.

## WP02 — Width default and wide-table rule

**Prompt**: [tasks/WP02-width-default-and-wide-tables.md](tasks/WP02-width-default-and-wide-tables.md)
**Goal**: change the default to 52rem, add `--dk-width-wide: 80rem`, and add the container and table rules so WP01's spec passes.
**Priority**: P1. **Independent test**: WP01's spec green; `pnpm test`, `assert-chrome-artifacts`, the axe and no-scroll specs green.
**Dependencies**: WP01.

T007 New default and `--dk-width-wide` in `theme.css` (WP02)
T008 Same defaults in `DEFAULT_TOKENS` (WP02)
T009 Container and wide-table rules in `dk-components.css` (WP02)
T010 Token list in `assert-chrome-artifacts.mjs` (WP02)
T011 Token agreement cases in `layout-css-contract.test.ts` (WP02)
T012 Acceptance spec green; full a11y lane and unit suites (WP02)

**Risks**: `src/lib/theme.ts` is shared with the #114 dispatch: change only the two width lines.

## WP03 — Deliberate rebaseline

**Prompt**: [tasks/WP03-deliberate-rebaseline.md](tasks/WP03-deliberate-rebaseline.md)
**Goal**: move the column ratchet and the two visual baselines to the new layout, with evidence.
**Priority**: P1. **Independent test**: `layout-geometry.spec.ts` and `visual.spec.ts` green in CI.
**Dependencies**: WP02.

T013 Re-measure and move `EXPANDED_MEASURE` with evidence (WP03)
T014 Regenerate the two visual baselines in the pinned container (WP03)
T015 Confirm the whole layout spec and the visual spec green (WP03)

**Risks**: baselines come only from the `Update a11y baselines` workflow; a sibling dispatch may move the same images.

## WP04 — Documentation and release note

**Prompt**: [tasks/WP04-docs-adr-changelog.md](tasks/WP04-docs-adr-changelog.md)
**Goal**: document both tokens and the restore line, record the decision in ADR-0052, add the changelog entry.
**Priority**: P2. **Independent test**: docs validators green; the changelog names `52rem` and `--dk-width-content: 45rem`.
**Dependencies**: WP02.

T016 ADR-0052 and the regenerated ADR index (WP04)
T017 Theming page: both tokens, the restore line, the opt-out (WP04)
T018 CHANGELOG `[Unreleased]` Changed entry (WP04)
T019 Docs gates (WP04)
