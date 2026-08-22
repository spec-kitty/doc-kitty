# Implementation Plan: Path-Scoped CI/CD Pipeline

**Branch**: `feat/ci-cd-pipeline` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/ci-cd-pipeline-01M0N1DZ/spec.md`

## Summary

Make the structure-first repo provably green locally, then wire a path-scoped
GitHub Actions pipeline on top of it. A `detect-changes` classifier turns a diff
into per-group booleans (the binding change-surface map in the spec); four lanes
(code-quality, doc-sanity, build-example, deploy) run conditionally on those
booleans; one always-running `ci-ok` aggregate is the sole required check. Pages
deploys from mainline using the same build definition the PR build lane uses, and a
git-ref-gated nightly smoke (lychee + Lighthouse CI) watches the live site without
gating merges. The tools and parameters are settled by
[ADR-0007](../../docs/adr/0007-ci-cd-path-scoped-lanes.md) and the
[design doc](../../docs/architecture/ci-cd-pipeline.md); this plan sequences the
build and pins the seams the post-spec squad surfaced.

## Technical Context

**Language/Version**: TypeScript 5.7 (toolkit `src/`), Node.js 22 (CI floor; ESM
`.mjs` scripts), Astro 5 (example build). YAML for GitHub Actions workflows.
**Primary Dependencies**: pnpm 11 workspace; Vitest 2 (toolkit unit tests);
Astro 5 + Starlight 0.30 (example). New CI tooling: `dorny/paths-filter` (change
classifier), `markdownlint-cli2`, Vale (prose lint), `lychee` (link check),
Lighthouse CI (`@lhci/cli` / `treosh/lighthouse-ci-action`), plus GitHub-native
`actions/*` (checkout, setup-node, upload-pages-artifact, deploy-pages). `zod` and
`gray-matter` already vendored.
**Storage**: N/A — files only. Durable pipeline state is one git ref
(`smoke/last-run`) recording the last-smoked deployment SHA.
**Testing**: Vitest for toolkit units (`src/tests/`); a Node assertion script over
`example/dist/` for build-integration (artifact existence + shape/count);
lane-selection and gate semantics verified against the change-surface map via the
acceptance scenarios (throwaway PRs during E2E). No Playwright (deferred to M2).
**Target Platform**: GitHub Actions `ubuntu-latest`; GitHub Pages hosting; Node 22.
**Project Type**: single — pnpm workspace with two packages (`@commondocs-kitty/toolkit`
in `src/`, `example/`), plus `.github/workflows/`.
**Performance Goals**: doc-only PR = 0 Astro builds + 0 test runs; ≤1 in-progress
CI run per ref (cancel superseded); nightly = 0 checks on a no-deploy night;
doc-sanity is build-free (fail-fast before any build).
**Constraints**: Node 22 only, no version matrix; markdownlint + Vale (`error`
severity) from day one; Pages deploys on mainline only, no PR previews; `ci-ok` is
the sole required check and must be red on any lane failure or detect-changes
failure; any design deviation needs a new ADR (charter amend-via-ADR).
**Scale/Scope**: ~20 toolkit source files, 2 packages; 3 workflow files (ci,
deploy, nightly) reshaped/added from 2 stubs; 4 conditional lanes + 1 aggregate.

**Supply-chain posture (DIRECTIVE_051)**: All added tooling resolves from official
registries (npm for `markdownlint-cli2`/`@lhci/cli`; GitHub Marketplace for
actions). Third-party actions (`dorny/paths-filter`, `treosh/lighthouse-ci-action`,
`lycheeverse/lychee-action`) are pinned to a commit SHA (or at minimum a major
tag) — never a floating `@master`. No package requires a `postinstall` lifecycle
script; deny-by-default stands. Node 22 is the Active LTS line (satisfies the LTS
awareness control). Freshness and authenticity notes recorded in
[research.md](./research.md).

## Charter Check

*GATE: passed before Phase 0; re-checked after Phase 1 (no new violations).*

- **DIRECTIVE_030 / DIRECTIVE_034 (test/typecheck gate, test-first)**: the pipeline
  *is* the quality gate; the classifier and the artifact-assertion script are built
  test-first (fixtures that must fail before the check exists). ✅
- **DIRECTIVE_042 / DIRECTIVE_037 (Common Docs standard, living docs)**: doc-sanity
  validates frontmatter across `docs/` and `example/docs/`; the branch-protection
  activation step is documented (FR-022). ✅
- **DIRECTIVE_003 (decision documentation)**: settled decisions live in ADR-0007;
  any deviation is a new ADR (C-008). ✅
- **DIRECTIVE_051 (supply-chain safety)**: addressed in Technical Context +
  research.md; actions SHA-pinned, deny-by-default lifecycle scripts. ✅
- **DIRECTIVE_024 / DIRECTIVE_025 (locality, boy-scout)**: changes are confined to
  build config, `.github/workflows/`, and small toolkit scripts; the "make it green"
  work fixes the touched baseline rather than papering over it. ✅
- **Charter pillars (structure, maintainability, agent-interoperability)**: the
  build lane asserts the agent-facing artifacts (`llms.txt`, agent index JSON) stay
  valid. ✅

No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/ci-cd-pipeline-01M0N1DZ/
├── plan.md              # This file
├── research.md          # Phase 0 output — tool confirmation + supply-chain evidence
├── data-model.md        # Phase 1 output — pipeline config structures
├── quickstart.md        # Phase 1 output — local green + branch-protection activation
├── contracts/           # Phase 1 output — workflow interface contracts
│   ├── detect-changes.contract.md
│   ├── ci-ok.contract.md
│   ├── build-artifacts.contract.md
│   ├── build-example-action.contract.md
│   └── nightly-smoke.contract.md
├── reviews/             # Adversarial squad records (post-spec, post-tasks)
├── acceptance.md        # WP08 output — offline evidence + live checklist
└── tasks.md             # Phase 2 output (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
.github/
├── filters.yml          # NEW — single source of change-surface globs (ci + deploy)
├── actions/build-example/action.yml  # NEW — shared pure-build composite action
├── scripts/             # NEW — committed, table-tested classifier + ci-ok decision helpers
└── workflows/
    ├── ci.yml           # detect-changes + code-quality + doc-sanity + build-example + ci-ok
    ├── deploy.yml       # path-gated Pages deploy from main, reuses the build composite
    └── nightly.yml      # git-ref-gated lychee + Lighthouse CI, issue reporting

src/                     # @commondocs-kitty/toolkit
├── lib/ … routes/ …     # existing toolkit (unchanged behavior)
├── scripts/
│   ├── validate-frontmatter.mjs   # extended to cover docs/ AND example/docs/
│   └── assert-build-artifacts.mjs # NEW — build-integration assertions over example/dist/
└── tests/               # Vitest units (existing + any added for scripts)

.markdownlint.jsonc      # NEW — shared markdownlint config
.vale.ini + .vale/       # NEW — Vale config + minimal style
lychee.toml              # NEW — link-check config (nightly)
lighthouserc.json        # NEW — Lighthouse CI thresholds (nightly)
pnpm-lock.yaml           # NEW — committed lockfile (the local-green deliverable)

docs/ops/ci-cd.md        # NEW — branch-protection activation + operating notes (FR-022)
```

**Structure Decision**: single pnpm workspace, unchanged. All new files are build
config, workflow YAML, two Node scripts, and one ops doc. No toolkit runtime
behavior changes — this mission is delivery harness, not product code.

## Complexity Tracking

*No Charter Check violations — section intentionally empty.*

## Implementation Concern Map

> Concerns are NOT work packages. `/spec-kitty.tasks` translates these into WPs;
> some concerns merge, some split. IDs are concern IDs, not sequencing.

### IC-01 — Local green baseline

- **Purpose**: Make a fresh checkout install, test, and build on Node 22 and commit the lockfile, so CI has something trustworthy to gate.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, NFR-008.
- **Affected surfaces**: root `package.json`, `src/package.json`, `example/package.json`, `pnpm-lock.yaml` (new), `src/tests/`, `example/`.
- **Sequencing/depends-on**: none (foundational prerequisite for all lanes).
- **Risks**: peer-dep resolution on Astro 5/Starlight 0.30; example build must be genuinely clean (no tolerated error output); test suite must be non-trivial, not vacuously green.

### IC-02 — Change-surface classifier (detect-changes)

- **Purpose**: Emit per-group booleans from a diff using the binding change-surface map, constructing first-match-wins over the multi-match path filter; always runs.
- **Relevant requirements**: FR-005, FR-006, C-006; NFR-006 (concurrency).
- **Affected surfaces**: `.github/workflows/ci.yml` (detect-changes job), a `dorny/paths-filter` filter spec encoding the exact globs + precedence.
- **Sequencing/depends-on**: none structurally; feeds IC-03/04/05/06/07.
- **Risks**: `dorny/paths-filter` is multi-match — first-match precedence must be built in the boolean derivation; overlap cases (a `.github/workflows/*.md`, `example/*.mjs` config) must resolve correctly; ignored-only must still let ci-ok run.

### IC-03 — code-quality lane

- **Purpose**: typecheck + lint + unit tests for `code`/`workflows`; a real typecheck gate and lint config so an injected type/lint error fails.
- **Relevant requirements**: FR-007; US2.8 (failure path).
- **Affected surfaces**: `src/package.json` (`typecheck` script exists; add real `lint`), root `package.json` scripts, `ci.yml` code-quality job.
- **Sequencing/depends-on**: IC-01, IC-02.
- **Risks**: current root `lint` is a no-op (`-r --if-present`); must not stay fakeable-green.

### IC-04 — doc-sanity lane (build-free)

- **Purpose**: frontmatter (docs/ + example/docs/), link/`related` integrity, markdownlint, Vale (`error`) — each defect class turns the lane red.
- **Relevant requirements**: FR-008, FR-009, C-002; US2.9 (failure path).
- **Affected surfaces**: `src/scripts/validate-frontmatter.mjs` (extend scope), new link-check step, `.markdownlint.jsonc`, `.vale.ini` + `.vale/styles/`, `ci.yml` doc-sanity job.
- **Sequencing/depends-on**: IC-02.
- **Risks**: current `validate` only covers `example/docs`; extending to `docs/` may surface existing violations to fix (boy-scout); Vale style must start minimal to avoid noise.

### IC-05 — build-example lane + artifact assertions

- **Purpose**: build the example and assert produced artifacts (sitemap, RSS, llms.txt, agent index JSON shape+count, README-as-index routing, a rendered page); malformed/missing → red. Defines the shared build step.
- **Relevant requirements**: FR-010, FR-011, FR-015 (shared build definition), SC-010; US2.10.
- **Affected surfaces**: `src/scripts/assert-build-artifacts.mjs` (new), `ci.yml` build-example job, `.github/actions/build-example` composite consumed by deploy.
- **Sequencing/depends-on**: IC-01, IC-02.
- **Resolved (post-tasks squad)**: the composite is the **pure build**; artifact
  assertions run in the build-example *job*, so deploy reuses the build without
  inheriting the PR-gate assertion. Contract: `contracts/build-example-action.contract.md`.
- **Risks**: artifact shape/count pinned to today's example output (cross-checked against an independent count), not M1.

### IC-11 — Acceptance & activation

- **Purpose**: own end-to-end acceptance (SC-001..SC-010) — offline-provable checks executed in-mission (local green, committed table tests, failure demos, actionlint), live checks a tracked post-activation checklist.
- **Relevant requirements**: SC-001..SC-010; FR-006/FR-012/FR-013/FR-016 (live-verified).
- **Affected surfaces**: `kitty-specs/ci-cd-pipeline-01M0N1DZ/acceptance.md`.
- **Sequencing/depends-on**: all workflow concerns (IC-02..IC-10).
- **Risks**: over-claiming a live-only SC from an offline proxy — label live-pending honestly.

### IC-06 — ci-ok aggregate gate

- **Purpose**: one always-running aggregate that needs detect-changes + the three lanes, passes on pass/skip, fails on any failure/cancellation or a detect-changes failure.
- **Relevant requirements**: FR-012, C-005, NFR-003; US2.11, US2.12; SC-004, SC-005.
- **Affected surfaces**: `ci.yml` ci-ok job (`if: always()`, explicit result checks).
- **Sequencing/depends-on**: IC-02, IC-03, IC-04, IC-05.
- **Risks**: the classic `always()` false-green if result checks are wrong; must include detect-changes in needs and check its result explicitly.

### IC-07 — Pages deploy (path-gated, shared build)

- **Purpose**: deploy the example to Pages on mainline only, path-gated, reusing IC-05's build definition; serialize publishes.
- **Relevant requirements**: FR-013, FR-014, FR-015, C-003, NFR-007.
- **Affected surfaces**: `.github/workflows/deploy.yml` (add path gate + reuse build; keep `concurrency: pages, cancel-in-progress: false`).
- **Sequencing/depends-on**: IC-05 (shared build), IC-02.
- **Risks**: push-context diff base differs from PR base — path detection in the push context must stay consistent; must not author a second divergent build.

### IC-08 — Nightly smoke (gated, reporting)

- **Purpose**: schedule + workflow_dispatch; run only when the newest successful github-pages deployment SHA differs from the git-ref marker; lychee + Lighthouse CI with thresholds; update marker; issue only on failure; never gate.
- **Relevant requirements**: FR-016, FR-017, FR-018, FR-019, FR-021, C-007, C-009, NFR-005.
- **Affected surfaces**: `.github/workflows/nightly.yml` (new), `lychee.toml`, `lighthouserc.json`, marker read/write logic (`contents: write`).
- **Sequencing/depends-on**: IC-07 (needs a live deployment).
- **Risks**: marker write must not retrigger workflows; Deployments-API query must filter to newest *successful* deployment; Lighthouse thresholds must be tuned to avoid nightly noise.

### IC-09 — Fork-safety & secret scoping (cross-cutting)

- **Purpose**: PR CI triggers on `pull_request` (never `pull_request_target`); least-privilege `permissions:` per workflow; deploy/nightly base-repo-only by trigger.
- **Relevant requirements**: FR-020; edge case fork-PR.
- **Affected surfaces**: trigger + `permissions:` blocks across `ci.yml`, `deploy.yml`, `nightly.yml`.
- **Sequencing/depends-on**: cross-cuts IC-02..IC-08 (verified as each workflow is authored).
- **Risks**: accidental `pull_request_target` reintroduces the fork-secret exfiltration class; default token scope should be tightened.

### IC-10 — Branch-protection activation docs

- **Purpose**: document the out-of-band repo-admin step that makes `ci-ok` the single required check — the setting the whole design hinges on.
- **Relevant requirements**: FR-022, NFR-003.
- **Affected surfaces**: `docs/ops/ci-cd.md` (activation + operating notes).
- **Sequencing/depends-on**: IC-06 (ci-ok must exist to require it).
- **Risks**: none technical; risk is silently omitting it and shipping an ungated pipeline.
