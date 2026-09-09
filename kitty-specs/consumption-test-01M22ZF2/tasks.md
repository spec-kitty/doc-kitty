# Tasks: Consumption Test + Consumer-Layer Proof

Mission: `consumption-test-01M22ZF2` · Branch: `feat/release-0.1.0-consumption-readiness`
Derived from plan.md (IC-01..IC-08) + contracts/consumption-test-contract.md (C-0..C-6),
refined by the post-plan brownfield squad (research.md dispositions).

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Fixture `package.json` (`file:./toolkit.tgz` + astro/starlight/sitemap peers), own empty `pnpm-workspace.yaml`, tsconfig | WP01 | |
| T002 | `astro.config.mjs` — `defineDocKittyIntegrations` (title/description/base/markua:true/diagrams:false/indexBasename); no theme yet | WP01 | |
| T003 | `src/content.config.ts` (docs/bibliography/tools loaders from `/schema`, base match) + `src/pages/**` route endpoints from `/routes` | WP01 | |
| T004 | Seed root index `docs/README.md` + minimal buildable content + `url-baseline.txt` | WP01 | |
| T005 | `run-consumption-test.mjs` — pack→toolkit.tgz; install `--ignore-workspace --frozen-lockfile`; realpath/not-symlink/not-under-src/v0.1.0 + `../src` grep; source-hidden build; run 4 portable gates + auto-discover `assert-consumer-*.mjs`; aggregate exit | WP01 | |
| T006 | Generate + commit the fixture `pnpm-lock.yaml` (one-time pack+install) | WP01 | |
| T007 | Local green run of the orchestrator — the clean-room MVP proof (SC-001) | WP01 | |
| T008 | `src/theme/index.ts` — `pressTheme` extends `specKittyTheme`, object `--dk-*` tokens only | WP02 | [P] |
| T009 | `src/theme/press.css` — mode-varying colour in `:root` + `:root[data-theme='dark']` | WP02 | [P] |
| T010 | Wire `theme: pressTheme` into `astro.config.mjs` (documented one-line out-of-map edit) | WP02 | |
| T011 | `assert-consumer-theme.mjs` — ≥5 `--dk-*` = press value AND ≠ default (dark-block aware) | WP02 | [P] |
| T012 | Copy rhetoric slice docs (index, introduction, preamble, about-and-license, book-one/index, chapter-01..03) | WP03 | [P] |
| T013 | Copy personas (`context/audience/rhetoric-student`, `rhetoric-practitioner`) | WP03 | [P] |
| T014 | `.contextive/definitions.yaml` (rhetoric context) + fixture `.gitignore` for generated `glossary/` | WP03 | [P] |
| T015 | `_meta/sections.yaml` (rhetoric/context/glossary) + `_meta/bibliography.yaml` (the 2 cited ids) | WP03 | [P] |
| T016 | Verify CC-BY-SA-4.0 attribution preserved; supersede WP01 seed placeholders | WP03 | |
| T017 | `assert-consumer-artifacts.mjs` — rss/llms/sitemap well-formed (real XML scanner) | WP04 | [P] |
| T018 | agent-API shape — `pages[]` (not `entries`), `version==='2'`, `count===pages.length`, per-page keys | WP04 | [P] |
| T019 | favicon-output presence + `api/bibliography.json` records shape | WP04 | [P] |
| T020 | Self-verify the checker against WP01's built `dist/` (green) | WP04 | |
| T021 | `consumption-gap.test.ts` — positive control: unmodified crafted fixture builds green | WP05 | [P] |
| T022 | Fail-closed arm: remove a real imported ∩ allowlisted ∩ static file → build fails naming the specifier (not favicon) | WP05 | |
| T023 | Clean setup/teardown (no standing red gate); derive removed file from real imports ∩ `files` | WP05 | |
| T024 | `consumption-test.yml` triggers — `paths: src/**, tests/consumption/**, .github/workflows/consumption-test.yml` + `workflow_dispatch` | WP06 | |
| T025 | Node/pnpm setup (corepack, setup-node@pinned node 22 cache pnpm) → run orchestrator | WP06 | |
| T026 | Run the vitest self-test; assert NO `services:`/PlantUML/Chromium; ≤8-min budget | WP06 | |
| T027 | `docs/guides/consumer-setup.md` — install→configure→theme→build, published entrypoints only | WP07 | [P] |
| T028 | Link the guide from roadmap "Where we are now" (documented one-line out-of-map edit) | WP07 | |
| T029 | Guide-path lint — assert no `../src`/repo-internal toolkit paths in the guide | WP07 | [P] |

## Work Packages

### WP01 — Buildable isolated fixture + clean-room orchestrator (MVP)

- **Goal**: A net-new consumer site that installs the packed toolkit in genuine
  isolation and builds green from the tarball alone — the SC-001 clean-room proof.
- **Priority**: P1 (foundation + MVP). **Independent test**: `node
  tests/consumption/scripts/run-consumption-test.mjs` exits 0 with `src/` hidden.
- **Subtasks**: T001 T002 T003 T004 T005 T006 T007
- **Dependencies**: none
- **Risks**: workspace nesting (own `pnpm-workspace.yaml` + `--ignore-workspace`,
  contract C-0); `base` must match config↔loader; peers install at the fixture.
- **Est.**: ~250 lines. **Requirements**: FR-001, FR-003, FR-004, NFR-001, NFR-003, NFR-004

### WP02 — Editorial press consumer theme + verifier

- **Goal**: A distinct consumer-layer theme (N=2) with an automated distinctness verifier.
- **Priority**: P2. **Independent test**: `assert-consumer-theme.mjs` passes on the built dist.
- **Subtasks**: T008 T009 T010 T011
- **Dependencies**: WP01
- **Risks**: object `tokens` (not string); mode-varying colour needs both `:root` and
  `:root[data-theme='dark']` (0,2,0 beats 0,1,0 — research D4).
- **Est.**: ~200 lines. **Requirements**: FR-002

### WP03 — Representative book slice + attribution

- **Goal**: The ars-rethorica slice exercising Markua, glossary, personas, per-kind layouts.
- **Priority**: P2. **Independent test**: fixture build renders the slice; frontmatter validates (warnings tolerated).
- **Subtasks**: T012 T013 T014 T015 T016
- **Dependencies**: WP01
- **Risks**: `type: Reference` warns (tolerate); `external_references` ids must exist in bibliography; glossary regenerates (don't hand-edit).
- **Est.**: ~180 lines. **Requirements**: FR-001, FR-009

### WP04 — Consumer artifact checker

- **Goal**: Corpus-agnostic feed + agent-API presence/shape check (replaces the non-portable pinned gate).
- **Priority**: P2. **Independent test**: `assert-consumer-artifacts.mjs <dist>` passes on WP01's build.
- **Subtasks**: T017 T018 T019 T020
- **Dependencies**: WP01
- **Risks**: agent-API key is `pages[]` NOT `entries[]`; real XML scanner not regex; favicon output check closes the warn-path hole.
- **Est.**: ~200 lines. **Requirements**: FR-005

### WP05 — Fail-closed packaging-gap self-test (two-arm)

- **Goal**: Prove a `files`-allowlist omission of a statically-imported module fails closed.
- **Priority**: P2. **Independent test**: the vitest test passes (both arms) and leaves no standing red gate.
- **Subtasks**: T021 T022 T023
- **Dependencies**: WP01
- **Risks**: must remove a really-imported ∩ allowlisted ∩ static file (not favicon); positive control required.
- **Est.**: ~170 lines. **Requirements**: FR-006, FR-007

### WP06 — consumption-test.yml workflow

- **Goal**: Run the orchestrator + self-test in CI on a clean runner, no PlantUML/Chromium, ≤8 min.
- **Priority**: P2. **Independent test**: the workflow runs green on a PR touching `src/**`.
- **Subtasks**: T024 T025 T026
- **Dependencies**: WP01, WP04, WP05
- **Risks**: SHA-pin actions; do NOT copy the `services: plantuml` block from ci.yml.
- **Est.**: ~150 lines. **Requirements**: FR-003, FR-004, FR-005, FR-006, NFR-002

### WP07 — Adopter consumer-path guide + roadmap link + lint

- **Goal**: A reproducible adopter guide using only published entrypoints, machine-linted.
- **Priority**: P3. **Independent test**: guide-path lint passes; roadmap links the guide.
- **Subtasks**: T027 T028 T029
- **Dependencies**: WP01, WP02
- **Risks**: every step must reference a published entrypoint or consumer-owned file (SC-005).
- **Est.**: ~150 lines. **Requirements**: FR-008

## Dependency graph

```
WP01 ──┬── WP02 ──┐
       ├── WP03    ├── WP07
       ├── WP04 ──┐
       └── WP05 ──┴── WP06
```

MVP scope: **WP01** (clean-room build proven). WP02–WP05 parallelize after WP01;
WP06 after WP01/WP04/WP05; WP07 after WP01/WP02.
