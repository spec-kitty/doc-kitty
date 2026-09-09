# Implementation Plan: Consumption Test + Consumer-Layer Proof

**Branch**: `feat/release-0.1.0-consumption-readiness` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/consumption-test-01M22ZF2/spec.md`

## Summary

Build a net-new **consumer-site fixture** (a repo test resource, outside `src/`
and outside the pnpm workspace) that installs the **packed** `@commondocs-kitty/toolkit@0.1.0`
tarball — never the workspace symlink — wires it through the toolkit's public
`exports` exactly as `example/` does, applies a new **editorial/press consumer
theme** via the `default → brand → consumer` merge, and carries a representative
ars-rethorica book slice. A dedicated **`consumption-test.yml`** workflow packs
the toolkit, installs the `.tgz`, builds the fixture, and runs the toolkit's
**four tarball-portable gate scripts** plus a small consumer-owned artifact check
against the fixture's output, failing closed on any packaging gap. A focused
packaging-gap self-test proves the fail-closed behavior.

Brownfield note: the reconnaissance (see [research.md](./research.md)) found that
two existing gate scripts (`assert-build-artifacts.mjs`, `assert-markua-builds.mjs`)
are **not** tarball-portable (they assume the repo layout and hardcode the
`example` corpus), so the plan reuses only the four portable scripts and adds one
small consumer-owned artifact checker rather than bending the corpus-pinned gate.

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript (ESM); Node 22 (Active LTS, matches `ci.yml`)
**Primary Dependencies**: the packed `@commondocs-kitty/toolkit@0.1.0` tarball (`file:` install); Astro `^5`, `@astrojs/starlight` `0.32.x`, `@astrojs/sitemap` `^3` (toolkit peers, installed by the fixture); Vitest (self-test)
**Storage**: N/A — static site generation; content is Markdown files
**Testing**: the toolkit's four tarball-portable gate scripts (`validate-frontmatter.mjs`, `check-links.mjs`, `check-redirect-coverage.mjs`, `assert-no-broken-links.mjs`) run against the fixture's `docs/`/`dist/`; two small consumer-owned checkers — `assert-consumer-artifacts.mjs` (feeds + the shipped `pages[]` agent-API shape/version/count/keys + favicon output) and `assert-consumer-theme.mjs` (≥5 `--dk-*` tokens = press value ≠ default); a two-arm Vitest packaging-gap self-test; the `consumption-test.yml` workflow. Isolation is enforced by a fixture-local `pnpm-workspace.yaml` + `--ignore-workspace` + a realpath assertion (contract C-0)
**Target Platform**: GitHub Actions Linux runner (`ubuntu-latest`); output is a static docsite
**Project Type**: web (static docsite consumer fixture) + CI workflow
**Performance Goals**: `consumption-test.yml` completes in **≤ 8 min** on the standard runner excluding cache-cold install (NFR-002)
**Constraints**: fixture resolves the toolkit **only** from the tarball — 0 repo-relative toolkit imports (NFR-001); **0** files added to the published toolkit tarball (NFR-003); no PlantUML service / no Chromium (C-003); deterministic pinned peers + committed fixture lockfile, exact `0.1.0` toolkit (NFR-004); no npm-registry publish (C-002); reuse existing gate scripts where portable (C-004); CC-BY-SA-4.0 attribution preserved (C-005)
**Scale/Scope**: 1 fixture site (~10–12 slice docs + 2 personas + glossary), 1 editorial consumer theme, 1 CI workflow, 1 packaging-gap self-test, 1 adopter guide page

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`software-dev-default`). No violations introduced:

- **DIRECTIVE_001 (Architectural Integrity / separation of concerns)**: the fixture
  and editorial theme are **test resources** with a hard boundary from the toolkit
  source — the fixture consumes only published `exports`; nothing in `src/` depends
  on the fixture. ✅
- **DIRECTIVE_010 (Specification Fidelity)**: plan traces every IC to FR/NFR/C rows. ✅
- **DIRECTIVE_024 (Locality of Change)**: net-new files under `tests/consumption/`
  and one new workflow; the only edits to shipped code are optional small
  portability fixes to gate scripts, each justified in research.md. ✅
- **DIRECTIVE_035 (Bulk edit)**: N/A — no cross-file rename; all new identifiers. ✅
- **DIRECTIVE_051 (Supply-chain install safety)**: no NEW third-party package is
  introduced to the org — the fixture re-declares already-locked peers
  (astro/starlight/sitemap); Node 22 is Active LTS; the toolkit tarball ships no
  install lifecycle scripts. See research.md §Supply-chain. ✅
- **Brownfield point-cut squads**: per operator direction, an adversarial
  `brownfield` squad runs post-plan and again pre-PR; findings dispositioned in
  research.md per the adversarial-evidence contract.

## Project Structure

### Documentation (this mission)

```
kitty-specs/consumption-test-01M22ZF2/
├── plan.md              # This file
├── research.md          # Phase 0: decisions (gate-reuse split, fixture placement, theme, supply-chain)
├── data-model.md        # Phase 1: entities (fixture, theme, tarball, workflow)
├── quickstart.md        # Phase 1: run the consumption test locally + adopter repro
├── contracts/           # Phase 1: consumption-test sequence + fail-closed + artifact-check contracts
└── tasks.md             # Phase 2 (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
tests/consumption/                      # NEW — test resource; NOT a pnpm workspace member, NOT in the toolkit tarball
├── consumer-fixture/                   # the net-new consumer site
│   ├── package.json                    # deps: "@commondocs-kitty/toolkit": "file:./toolkit.tgz" + astro/starlight/sitemap peers
│   ├── pnpm-lock.yaml                   # committed — deterministic peer pin (NFR-004)
│   ├── astro.config.mjs                # defineDocKittyIntegrations({ theme: pressTheme, markua:true, diagrams:false, base })
│   ├── src/
│   │   ├── content.config.ts           # docs/bibliography/tools loaders from toolkit /schema (copied from example)
│   │   ├── theme/                       # the editorial/press CONSUMER theme (extends spec-kitty brand)
│   │   │   ├── index.ts                #   DocKittyTheme { extends: specKittyTheme, tokens, customCss }
│   │   │   └── press.css               #   mode-varying colours (:root + [data-theme='dark'])
│   │   └── pages/                       # rss.xml.ts, llms.txt.ts, api/*.json.ts, presentations/[...].astro (from toolkit /routes)
│   ├── docs/                            # the ars-rethorica representative slice (copied, attribution preserved)
│   │   ├── _meta/{sections.yaml,bibliography.yaml}
│   │   ├── rhetoric/{index,introduction,preamble,about-and-license}.md
│   │   ├── rhetoric/book-one/{index,chapter-01,chapter-02,chapter-03}.md
│   │   └── context/audience/{rhetoric-student,rhetoric-practitioner}.md
│   ├── .contextive/definitions.yaml    # rhetoric glossary source (on-switch for the glossary seam)
│   └── url-baseline.txt                 # redirect-coverage baseline for the fixture
├── scripts/
│   ├── run-consumption-test.mjs        # NEW — pack → install tgz → build → gates (shared by CI + local)
│   └── assert-consumer-artifacts.mjs   # NEW — small consumer-owned rss/llms/sitemap/agent-API presence + well-formedness check
└── consumption-gap.test.ts             # NEW — Vitest packaging-gap self-test (crafted fixture; fail-closed proof)

.github/workflows/consumption-test.yml  # NEW — Node/pnpm setup (no PlantUML/Chromium) → run-consumption-test.mjs

docs/guides/                            # adopter guide page (consumer setup path), linked from roadmap "Where we are now"
```

**Structure Decision**: A single new test-resource tree at `tests/consumption/`
(sibling of the existing `tests/a11y/`), explicitly outside the `src`/`example`
workspace members so `pnpm install` at the root neither symlinks nor builds it,
and outside `src/` so it never enters the toolkit tarball (NFR-003). The fixture
mirrors `example/`'s wiring but swaps `workspace:*` for a `file:./toolkit.tgz`
dependency. Gate invocation runs the shipped scripts from the installed package
path (`node_modules/@commondocs-kitty/toolkit/scripts/*.mjs`), never repo-relative.

## Complexity Tracking

*No Charter Check violations — table intentionally empty.*

## Implementation Concern Map

> Concerns, not work packages. `/spec-kitty.tasks` will translate these into WPs.

### IC-01 — Consumer fixture skeleton (tarball-wired, workspace-ISOLATED)

- **Purpose**: Stand up the net-new consumer site that depends on the packed tarball and wires the toolkit only through public `exports`, so a realistic build target exists that mirrors a real adopter. **This IC owns the workspace-isolation mechanism** — the fixture is its own boundary.
- **Relevant requirements**: FR-001, NFR-001, NFR-003, NFR-004, C-001, C-002
- **Affected surfaces**: `tests/consumption/consumer-fixture/{package.json,pnpm-lock.yaml,pnpm-workspace.yaml,astro.config.mjs,src/content.config.ts,src/pages/*}`
- **Sequencing/depends-on**: none (foundation)
- **Isolation deliverable (post-squad BLOCKER)**: because the fixture is nested under the repo `pnpm-workspace.yaml`, it MUST ship its **own** empty `pnpm-workspace.yaml` (`packages: []`) so pnpm stops there, and installs MUST use `--ignore-workspace`. Otherwise the toolkit/peers link from the repo workspace (symlink to `src/`, inert fixture lockfile) — silently defeating NFR-001/NFR-004. Contract C-0.
- **Risks**: the `file:` tarball dep + committed lockfile must stay deterministic; `base` must match between `astro.config` and the docs loader (config invariant); peers install at the fixture, not the monorepo root; `sharp`/`@img` are root-hoisted (publicHoistPattern) — the own-workspace + `--ignore-workspace` isolation also closes that residual up-resolution leak.

### IC-02 — Editorial/press consumer theme (N=2 proof)

- **Purpose**: Provide a genuinely distinct consumer-layer theme via `extends: specKittyTheme`, proving the `default → brand → consumer` merge at a second consumer, **with an automated verifier** (`assert-consumer-theme.mjs`, contract C-6) asserting ≥5 `--dk-*` tokens carry the press value AND differ from default/brand.
- **Relevant requirements**: FR-002, SC-003
- **Affected surfaces**: `tests/consumption/consumer-fixture/src/theme/{index.ts,press.css}`; `tests/consumption/scripts/assert-consumer-theme.mjs`
- **Sequencing/depends-on**: IC-01
- **Risks**: `tokens` object is `--dk-*` only (a `--sl-*` key throws); use the **object** form not string-`tokens` (a string is `@import`ed at the top of the generated sheet and would be overridden — inverting consumer precedence). Mode-invariant overrides win by source order at plain `:root` (0,1,0); but **mode-varying** colours MUST live in `press.css` under BOTH `:root` and `:root[data-theme='dark']` — the generated dark block is specificity 0,2,0 and out-ranks a bare `:root` regardless of load order, so an implementer must NOT drop the dark block.

### IC-03 — Representative book slice + attribution

- **Purpose**: Carry the minimal ars-rethorica slice that exercises Markua, glossary, personas, and per-kind layouts without PlantUML.
- **Relevant requirements**: FR-001, FR-009, C-003, C-005
- **Affected surfaces**: `tests/consumption/consumer-fixture/docs/**`, `.contextive/definitions.yaml`, `_meta/{sections,bibliography}.yaml`
- **Sequencing/depends-on**: IC-01
- **Risks**: `type: Reference` is a `Kind` not a `DOC_TYPE` → warns (must be tolerated, not gated as failure); `external_references` ids must exist in `_meta/bibliography.yaml` or catalog/link gates warn; glossary is presence-gated on `.contextive/definitions.yaml` and regenerates at build (do not hand-edit generated pages).

### IC-04 — Pack + install + build orchestration

- **Purpose**: A single script that packs the toolkit, installs the `.tgz` into the fixture, and builds it — shared by CI and local runs so the two cannot diverge.
- **Relevant requirements**: FR-003, FR-004, NFR-001, NFR-004
- **Affected surfaces**: `tests/consumption/scripts/run-consumption-test.mjs`
- **Sequencing/depends-on**: IC-01
- **Risks**: must guarantee tarball-only resolution (assert no `../src` toolkit imports; ensure resolution comes from the installed package); pack from `src/` produces a versioned filename — normalize to a stable `toolkit.tgz`.

### IC-05 — Gate reuse against consumer output (+ light artifact checker)

- **Purpose**: Validate the fixture's built output using the four tarball-portable gate scripts run from the installed package, plus one small consumer-owned artifact checker (feeds/agent-API). The corpus-pinned `assert-build-artifacts.mjs` is not reusable.
- **Relevant requirements**: FR-005, C-004, SC-002
- **Affected surfaces**: `tests/consumption/scripts/assert-consumer-artifacts.mjs`; gate invocations inside `run-consumption-test.mjs`
- **Sequencing/depends-on**: IC-03, IC-04
- **Checker correctness (post-squad)**: the agent-API top-level key is **`pages[]`** (shipped `agent-index.ts`), NOT `entries[]`; assert `version === '2'`, `count === pages.length`, and per-page required keys `slug/route/section/title/doc_status/kind`; use a real XML scanner, not a regex; add a **favicon-output presence** check (the favicon warn-path does not fail the build — contract C-2/C-3).
- **Risks**: `check-links.mjs`'s stricter URL check only fires for the hardcoded `example/docs` root — the fixture gets the looser (base-relative) source check; this is complemented by the fully-portable **`assert-no-broken-links.mjs`** strict check against `dist/`, so built-link integrity is still gated (research D8). `check-redirect-coverage.mjs` needs a fixture `url-baseline.txt`.

### IC-06 — Fail-closed packaging-gap self-test

- **Purpose**: Prove that removing a **statically-imported** file the consumer resolves from the toolkit's published set makes the workflow fail, without leaving a standing red gate.
- **Relevant requirements**: FR-006, FR-007, SC-004
- **Affected surfaces**: `tests/consumption/consumption-gap.test.ts`
- **Sequencing/depends-on**: IC-01, IC-04 (mutates a copy of the IC-01 fixture, drives the IC-04 orchestrator)
- **Two-arm (post-squad)**: assert BOTH (1) positive control — the unmodified crafted fixture builds green; (2) fail-closed — removing a file that is genuinely imported ∩ actually in the `files` allowlist ∩ statically imported (derive from real imports; **not** the favicon warn-path) fails with a message naming the specifier. Mirror `src/tests/redirect-coverage.test.ts`; construct/tear-down its own fixture (no standing red gate). Contract C-4.

### IC-07 — `consumption-test.yml` GitHub workflow

- **Purpose**: Run IC-04/05 in CI on a clean runner within the time budget, no PlantUML/Chromium.
- **Relevant requirements**: FR-003, FR-004, FR-005, FR-006, NFR-002
- **Affected surfaces**: `.github/workflows/consumption-test.yml`, possibly `.github/filters.yml`
- **Sequencing/depends-on**: IC-04, IC-05, IC-06
- **Risks**: copy only the Node/pnpm setup from `ci.yml` (SHA-pinned actions, node 22, pnpm cache); do NOT copy the `services: plantuml` block; trigger matrix (PR paths touching toolkit/fixture + manual dispatch).

### IC-08 — Adopter consumer-path guide

- **Purpose**: Document the install→configure→theme→build path using only published entrypoints, linked from the roadmap "Where we are now".
- **Relevant requirements**: FR-008, SC-005
- **Affected surfaces**: `docs/guides/<consumer-setup>.md`, `docs/plans/roadmap.md` (link)
- **Sequencing/depends-on**: IC-01, IC-02 (documents their result)
- **Risks**: every documented step must reference a published entrypoint or consumer-owned file — no doc-kitty repo-internal paths. **Add a lightweight lint** asserting the guide contains no `../src`/repo-relative toolkit path (machine-checks SC-005, mirrors INV-1). Note the `check-links` base-relative-mode caveat so adopters don't assume strict-check parity with `example/`.
