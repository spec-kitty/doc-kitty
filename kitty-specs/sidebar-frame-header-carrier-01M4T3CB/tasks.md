# Tasks: Sidebar, TOC rail and page-frame remediation with Header carrier

**Mission**: `sidebar-frame-header-carrier-01M4T3CB`
**Branch**: planning and merge target `fix/sidebar-frame-header-carrier` (draft PR to `main`, owner merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/public-surface.md](contracts/public-surface.md), [quickstart.md](quickstart.md)

Seven work packages. Two lanes can run in parallel from the start: layout (WP01 → WP02 → WP03) and build behaviour (WP04 → WP05 → WP06). WP07 closes the mission.

```
WP01 ─► WP02 ─► WP03 ─┐
                      ├─► WP07
WP04 ─► WP05 ─► WP06 ─┘
```

The second lane is serial because all three packages wire into `src/lib/config.ts`. WP04 owns that file; WP05 and WP06 make small recorded edits to it after WP04 lands.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Add `--dk-width-frame` to `theme.css` and `DEFAULT_BASE` | WP01 | |
| T002 | Register the token and replace the frame rule | WP01 | |
| T003 | Frame gutter; sidebar and header follow the frame | WP01 | |
| T004 | Pin the rail column to a definite width | WP01 | |
| T005 | CSS-contract unit test | WP01 | [P] |
| T006 | Align the chrome-artifact gate and token docs comment | WP01 | [P] |
| T007 | Mount the toggle beside the rail; `aria-controls` | WP02 | |
| T008 | Anchor the toggle with logical properties | WP02 | |
| T009 | Collapsed recentre without a left sidebar | WP02 | |
| T010 | TOC link target size; re-enable the demonstrator TOC | WP02 | [P] |
| T011 | Update toggle unit and interaction tests | WP02 | |
| T012 | Geometry measurement helper | WP03 | |
| T013 | Five-width assertions, expanded and collapsed | WP03 | |
| T014 | Capped, invalid-token and right-to-left variants | WP03 | |
| T015 | No-horizontal-scroll check at eight widths | WP03 | [P] |
| T016 | Fail-first evidence against the pre-mission layout | WP03 | |
| T017 | Regenerate moved baselines deliberately | WP03 | |
| T018 | Spike: route middleware can rewrite sidebar and TOC | WP04 | |
| T019 | Directory metadata map from the docs index | WP04 | |
| T020 | Pure sidebar shaping function | WP04 | |
| T021 | Near-empty table of contents removal | WP04 | [P] |
| T022 | Wire the middleware into the integration | WP04 | |
| T023 | Reveal the current sidebar entry | WP04 | [P] |
| T024 | Give the example's nested sections titles and order | WP04 | [P] |
| T025 | Unit and built-HTML tests for shaping | WP04 | |
| T026 | Pure resolver for `DK_PUBLISH_DRAFTS` | WP05 | |
| T027 | Resolve the setting in the integration, env files included | WP05 | |
| T028 | Filter drafts where the docs collection loads | WP05 | |
| T029 | `noindex` for published drafts | WP05 | [P] |
| T030 | Teach the gate scripts the setting | WP05 | |
| T031 | Env file, CI lanes and the live deployment | WP05 | |
| T032 | Tests for both setting values | WP05 | |
| T033 | `Header.astro` carrier | WP06 | |
| T034 | Slot, carriers map and package export | WP06 | |
| T035 | Update the carrier-count invariant tests and comments | WP06 | |
| T036 | Neutrality and theme-header tests | WP06 | |
| T037 | ADR-0044: Header carrier | WP07 | [P] |
| T038 | ADR-0045: frame-width token and retired constraint | WP07 | [P] |
| T039 | Consumer documentation for token, setting and header | WP07 | |
| T040 | Token catalog entry and changelog | WP07 | [P] |
| T041 | Packed-consumer coverage | WP07 | |
| T042 | Full gate run and draft PR | WP07 | |

## Phase 1 — Layout lane

### WP01 — Frame, sidebar, header and rail geometry

**Prompt**: [tasks/WP01-frame-and-rail-geometry.md](tasks/WP01-frame-and-rail-geometry.md)
**Priority**: P1 · **Dependencies**: none · **Profile**: frontend-freddy
**Goal**: full-width frame by default with one public token for a cap; sidebar, header content and rail stay attached to the frame.
**Independent test**: the CSS-contract test passes; at 1920px the frame spans the viewport and the reading column is at least 720px.

T001 Add `--dk-width-frame` to `theme.css` and `DEFAULT_BASE` (WP01)
T002 Register the token and replace the frame rule (WP01)
T003 Frame gutter; sidebar and header follow the frame (WP01)
T004 Pin the rail column to a definite width (WP01)
T005 CSS-contract unit test (WP01)
T006 Align the chrome-artifact gate and token docs comment (WP01)

**Risks**: specificity ties against Starlight 0.32; every desktop baseline moves (regenerated in WP03).

### WP02 — Collapse toggle placement and semantics

**Prompt**: [tasks/WP02-toggle-placement.md](tasks/WP02-toggle-placement.md)
**Priority**: P1 · **Dependencies**: WP01 · **Profile**: frontend-freddy
**Goal**: the toggle sits on the rail edge in both states and next to the rail in focus order.
**Independent test**: the interaction spec passes; the toggle is not the second-to-last focusable element.

T007 Mount the toggle beside the rail; `aria-controls` (WP02)
T008 Anchor the toggle with logical properties (WP02)
T009 Collapsed recentre without a left sidebar (WP02)
T010 TOC link target size; re-enable the demonstrator TOC (WP02)
T011 Update toggle unit and interaction tests (WP02)

**Risks**: the collapsed sheet disables pointer events and display on rail descendants.

### WP03 — Multi-width geometry guard and baselines

**Prompt**: [tasks/WP03-geometry-guard.md](tasks/WP03-geometry-guard.md)
**Priority**: P1 · **Dependencies**: WP01, WP02 · **Profile**: frontend-freddy
**Goal**: numeric layout assertions at five widths that fail on the old layout and pass on the new one.
**Independent test**: the new spec is green on this branch and red when pointed at a pre-mission build.

T012 Geometry measurement helper (WP03)
T013 Five-width assertions, expanded and collapsed (WP03)
T014 Capped, invalid-token and right-to-left variants (WP03)
T015 No-horizontal-scroll check at eight widths (WP03)
T016 Fail-first evidence against the pre-mission layout (WP03)
T017 Regenerate moved baselines deliberately (WP03)

**Risks**: baselines must come from the project container.

## Phase 2 — Build-behaviour lane

### WP04 — Sidebar and table-of-contents shaping

**Prompt**: [tasks/WP04-route-shaping.md](tasks/WP04-route-shaping.md)
**Priority**: P2 · **Dependencies**: none · **Profile**: node-norris
**Goal**: nested groups labelled and ordered from index metadata, index first, current entry revealed, no rail for a near-empty TOC.
**Independent test**: the built example sidebar has no raw directory labels and lists books one, two, three in order.

T018 Spike: route middleware can rewrite sidebar and TOC (WP04)
T019 Directory metadata map from the docs index (WP04)
T020 Pure sidebar shaping function (WP04)
T021 Near-empty table of contents removal (WP04)
T022 Wire the middleware into the integration (WP04)
T023 Reveal the current sidebar entry (WP04)
T024 Give the example's nested sections titles and order (WP04)
T025 Unit and built-HTML tests for shaping (WP04)

**Risks**: the spike decides between middleware and the config-time fallback.

### WP05 — Draft publication setting

**Prompt**: [tasks/WP05-draft-publication.md](tasks/WP05-draft-publication.md)
**Priority**: P1 · **Dependencies**: WP04 · **Profile**: node-norris
**Goal**: one environment setting, default off, decides whether drafts are emitted, listed and indexable.
**Independent test**: a drafts-off build has zero draft routes and a clean link gate; a drafts-on build marks drafts `noindex`.

T026 Pure resolver for `DK_PUBLISH_DRAFTS` (WP05)
T027 Resolve the setting in the integration, env files included (WP05)
T028 Filter drafts where the docs collection loads (WP05)
T029 `noindex` for published drafts (WP05)
T030 Teach the gate scripts the setting (WP05)
T031 Env file, CI lanes and the live deployment (WP05)
T032 Tests for both setting values (WP05)

**Risks**: existing gates assume drafts are built; a published page that links to a draft breaks when off.

### WP06 — Header carrier

**Prompt**: [tasks/WP06-header-carrier.md](tasks/WP06-header-carrier.md)
**Priority**: P2 · **Dependencies**: WP05 · **Profile**: frontend-freddy
**Goal**: a fifth, wrapper-free carrier that renders a theme-supplied header or the stock one.
**Independent test**: header markup is byte-identical without a theme header; a fixture theme header replaces it.

T033 `Header.astro` carrier (WP06)
T034 Slot, carriers map and package export (WP06)
T035 Update the carrier-count invariant tests and comments (WP06)
T036 Neutrality and theme-header tests (WP06)

**Risks**: tests and comments that assert exactly four carriers.

## Phase 3 — Close-out

### WP07 — Decision records, documentation and packed-consumer coverage

**Prompt**: [tasks/WP07-docs-and-consumer-coverage.md](tasks/WP07-docs-and-consumer-coverage.md)
**Priority**: P2 · **Dependencies**: WP01, WP02, WP03, WP04, WP05, WP06 · **Profile**: implementer-ivan
**Goal**: two decision records, consumer documentation, catalog and changelog entries, coverage from the packed tarball, and the draft PR.
**Independent test**: the consumption test exercises the token, the setting and a theme header; all gates are green.

T037 ADR-0044: Header carrier (WP07)
T038 ADR-0045: frame-width token and retired constraint (WP07)
T039 Consumer documentation for token, setting and header (WP07)
T040 Token catalog entry and changelog (WP07)
T041 Packed-consumer coverage (WP07)
T042 Full gate run and draft PR (WP07)

**Risks**: none beyond keeping the wording consumer-oriented.
