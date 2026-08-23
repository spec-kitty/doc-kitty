---
work_package_id: WP09
title: Playwright accessibility lane
dependencies:
- WP07
requirement_refs:
- FR-016
- NFR-001
- NFR-003
- NFR-005
- NFR-006
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T038
- T039
- T040
- T041
- T042
- T043
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
role: implementer
authoritative_surface: tests/a11y/
create_intent:
- playwright.config.ts
- tests/a11y/
execution_mode: code_change
owned_files:
- playwright.config.ts
- tests/a11y/**
- .github/workflows/**
- package.json
- pnpm-lock.yaml
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile: run `/ad-hoc-profile-load`
for **frontend-freddy** (browser-side implementer: accessibility and frontend
testing). Adopt its identity, scope, and boundaries for the whole work package. Do
not begin the subtasks until the profile is loaded.

## Objective

Stand up the accessibility/visual test harness (Playwright + axe-core) that this
mission introduces, wired as a **new CI lane that `ci-ok` requires** — not an
addendum bolted on beside it. The lane runs axe-core against the branded example in
**both** light and dark across an enumerated page set and fails the build on any
serious or critical WCAG 2.2 AA violation, and it carries a bounded, deterministic
visual-regression baseline. The three existing lanes (code-quality, doc-sanity,
build-example) stay unbroken, and a clean `--frozen-lockfile` install runs the whole
`ci-ok` set green.

This work package satisfies the mission's Definition-of-Done clause "WCAG 2.2 AA
verified by Playwright" and closes the testability findings the post-spec squad
raised (enumerated pages, both-modes drive mechanism, target-size/focus not
attributed to axe, `ci-ok` membership).

## Context

- Playwright arrives with **this** mission by charter design (component-system checks
  are M2). It is a NEW code-quality-side gate; nothing like it exists yet.
- CI is live and gating: branch protection on `main` requires the single `ci-ok`
  check, which today aggregates `code-quality`, `doc-sanity`, and `build-example`
  (ADR-0007 path-scoped lanes). Your lane becomes a fourth member of that
  aggregation. See `.github/workflows/` for the existing lane + `ci-ok` shape.
- The example is branded (WP07) and its `dist/` is the deploy artifact. Your lane
  **consumes that build artifact** rather than rebuilding, to stay path-efficient.
- Supply-chain: research.md Decision 2 evaluated the two new dev deps against the
  DIRECTIVE_051 five threat classes. Both are dev-only (NFR-005) — never shipped in
  the toolkit runtime. Playwright's browser binaries are fetched by an **explicit**
  `playwright install` step, never a silent postinstall.
- axe-core does not machine-verify target-size (WCAG 2.5.8) or visible-focus; those
  stay CSS construction checks owned by WP08. This lane owns the axe run + the
  both-modes drive + the visual baseline.

## Subtasks

### T038 — Add the dev dependencies with supply-chain discipline

**Purpose**: Bring in `@playwright/test` and `@axe-core/playwright` as dev-only
dependencies, pinned and vetted, without a silent lifecycle-script download and
without disturbing the pnpm `sharp`/`@img/*` hoist (C-003).

**Steps**:
1. Add to `package.json` `devDependencies` (toolkit workspace): `@playwright/test`
   and `@axe-core/playwright`, each pinned to an established minor (not a same-day
   release — freshness threat class).
2. Record in the PR/commit body the DIRECTIVE_051 five-threat-class notes from
   research.md Decision 2: official-registry authenticity + integrity hash; publish
   freshness; deny-by-default lifecycle scripts; Node Active-LTS awareness;
   incident/IoC posture.
3. Do NOT rely on any `postinstall` to fetch browsers. The only browser download is
   an explicit, allowlisted CI step (T042): `playwright install --with-deps chromium`
   — Chromium only.
4. Regenerate `pnpm-lock.yaml` with `pnpm install`; confirm the `sharp`/`@img/*`
   hoist entries in `pnpm-workspace.yaml` are untouched.

**Files**: `package.json`, `pnpm-lock.yaml`.

**Validation**:
- `@playwright/test` and `@axe-core/playwright` appear only under `devDependencies`.
- `grep` the toolkit's shipped runtime surface — neither package is imported from
  any `src/` runtime module (NFR-005).
- `pnpm-workspace.yaml` diff is empty.

**Edge cases**: a transitive bump that changes the hoist → revert and pin; a
CI runner without system libs → `--with-deps` installs them in the allowlisted step.

### T039 — Playwright config targeting the built example in both modes

**Purpose**: Configure Playwright to serve the already-built `example/dist`
statically and to drive both colour modes deterministically, so "both modes" is a
real, asserted contract rather than words.

**Steps**:
1. Create `playwright.config.ts` at repo root. Use a static file server (Playwright
   `webServer` running a static server over `example/dist`, or the `use.baseURL`
   pointing at a served dist) — never a fresh `astro dev`.
2. Define two projects (or a mode fixture): **light** and **dark**. Dark is driven by
   setting `data-theme="dark"` on `<html>` (Starlight's mechanism) and by
   `colorScheme: 'dark'` (`prefers-color-scheme`). Each test asserts the mode is
   actually applied (read the resolved `data-theme`/computed background) before
   running axe, so a config that silently runs light twice fails.
3. Pin viewport, disable animations, and set `reducedMotion: 'reduce'` for
   deterministic visual snapshots (T041).

**Files**: `playwright.config.ts`.

**Validation**:
- Running `pnpm test:a11y` with no built `example/dist` fails fast with a clear
  message (the lane depends on the build artifact).
- A probe test asserts the dark project truly renders dark (computed background
  matches the dark token), proving the both-modes drive.

**Edge cases**: base-path (`/doc-kitty`) — the served routes must honour the site
`base` so navigation resolves; mirror the example's `base`.

### T040 — axe-core across the enumerated page set, both modes

**Purpose**: Run axe-core with the `wcag22aa` tag over a fixed, enumerated set of
pages in both modes and fail on any serious/critical violation (NFR-001, SC-002).

**Steps**:
1. Create `tests/a11y/` specs using `@axe-core/playwright` (`AxeBuilder`).
2. Enumerate the page set explicitly (mirror how the M1 assertions pin exact routes):
   the **Persona fixture route** (the WP06 draft persona page), a **Hub page** (e.g.
   `/context/`), and a **prose page** (e.g. `/guides/getting-started/`). Do not run
   against "a representative page" — the routes are named constants.
3. For each page × each mode: `AxeBuilder().withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa'])`,
   analyze, and assert **zero** violations of impact `serious` or `critical`.
4. On failure, print the violation id, help URL, and the offending node so a
   reviewer can act.
5. **Guard against a vacuous pass**: before calling `analyze`, assert the axe `include`
   scope target exists and is non-trivial — e.g. `expect(page.locator(<chrome/content
   root>)).toHaveCount()` ≥1 — so an empty or mismatched `include` selector fails the
   test rather than reporting a clean zero violations against nothing.

**Files**: `tests/a11y/*.spec.ts`.

**Validation**:
- All enumerated pages × both modes report 0 serious/critical on the shipped brand.
- Removing a page from the enumerated list is a visible diff (the list is the
  coverage surface).

**Edge cases**: third-party/injected markup outside doc-kitty's control — scope the
axe run with `include`/`exclude` to the doc-kitty chrome + content region so the gate
measures what this mission owns.

### T041 — Bounded visual-regression baseline

**Purpose**: Give the "visual" half of the gate a measurable contract: a small,
deterministic screenshot baseline for the brand home in both modes with a defined
pixel-diff threshold, so a no-op visual check cannot pass.

**Steps**:
1. Add a `toHaveScreenshot` assertion for the brand home page in light and dark.
2. Set an explicit `maxDiffPixelRatio` (small, e.g. 0.01) and store baselines under
   `tests/a11y/__screenshots__/`.
3. Keep it deterministic: fixed viewport, reduced motion, fonts loaded (await
   `document.fonts.ready`) before the snapshot.

**Files**: `tests/a11y/visual.spec.ts`, `tests/a11y/__screenshots__/**`.

**Validation**:
- A deliberate token colour change shifts the diff beyond threshold → red.
- Re-running without changes is stable (no flaky diff).

**Edge cases**: font loading race → gate on `document.fonts.ready`; OS font
rendering differences → run the baseline in the same CI container as the check.

### T042 — Wire the lane into CI as a required `ci-ok` member

**Purpose**: Make the accessibility lane a member of `ci-ok` (so a red lane blocks
merge), consuming the `build-example` artifact, without breaking the three existing
lanes.

**Steps**:
1. In `.github/workflows/`, add an `a11y` job: download/reuse the `build-example`
   `dist` artifact, run `playwright install --with-deps chromium` (the allowlisted
   download), then `pnpm test:a11y`.
2. Add `test:a11y` to `package.json` scripts.
3. Update the `ci-ok` aggregation so it **requires** the `a11y` job (add it to the
   `needs:` / gate list) — it is a member, not a parallel optional job (scope finding
   #1). Confirm the branch-protection `ci-ok` contract still resolves to a single
   required check.
4. Do not alter the three existing lanes' triggers or steps.

**Files**: `.github/workflows/**`, `package.json`.

**Validation**:
- `ci-ok` does not go green unless the `a11y` job is green.
- The three existing lanes run and pass unchanged (diff shows only additive `a11y`
  wiring + the `needs` edge).

**Edge cases**: path-scoped triggers (ADR-0007) — ensure the a11y lane runs on the
changes that affect rendered chrome; artifact retention/naming must match
`build-example`'s upload.

### T043 — Prove the gate bites, and a clean two-way run

**Purpose**: Demonstrate the lane is non-fakeable and that the whole `ci-ok` set runs
green from a cold install (NFR-003).

**Steps**:
1. Stub-and-fail: temporarily regress a brand contrast or a target size, run
   `pnpm test:a11y`, confirm it fails with the specific axe rule; revert; confirm
   green. Record the evidence in the WP acceptance notes.
2. From an empty `node_modules`, run `pnpm install --frozen-lockfile` then the full
   local `ci-ok` (code-quality, doc-sanity, build-example) + `pnpm test:a11y`;
   confirm all green.

**Files**: acceptance notes (no shipped change from the stub — it is reverted).

**Validation**:
- The stub-and-fail transcript shows red→green on the exact rule.
- The cold `--frozen-lockfile` run is green end to end.

**Edge cases**: lockfile drift → `--frozen-lockfile` fails fast (that is the point);
resolve by committing the regenerated lockfile from T038.

## Branch Strategy

Planning artifacts for this mission were generated on `feat/component-system-and-theme`;
that is the planning/base branch and the merge target for this work package. At the
mission landing sequence the feature branch is rebased onto `origin/main` and a
same-repo PR is opened into `main`. During `/spec-kitty.implement`, execution
worktrees are allocated per computed lane from `lanes.json`; do not hand-create
branches — enter the workspace the lane resolves to. This WP depends on **WP07**
(the branded example build must exist for the lane to consume).

## Definition of Done

- `@playwright/test` + `@axe-core/playwright` are dev-only, pinned, with the
  supply-chain notes recorded; `pnpm-workspace.yaml` hoist unchanged.
- `playwright.config.ts` serves `example/dist` and drives both modes with an asserted
  mode check.
- axe-core (`wcag22aa`) runs across the enumerated pages (Persona fixture, Hub, prose)
  in both modes with 0 serious/critical on the shipped brand.
- A bounded visual baseline (brand home, both modes) with an explicit diff threshold
  is in place and deterministic.
- The `a11y` lane is a **required member of `ci-ok`**, consumes the build artifact,
  and the three existing lanes pass unchanged.
- Stub-and-fail evidence recorded; a cold `--frozen-lockfile` run of the full
  `ci-ok` + a11y is green.

## Risks

- **`ci-ok` membership mis-wired** (the scope-lens finding): if the lane runs beside
  `ci-ok` instead of inside it, a red a11y result would not block merge. Verify the
  branch-protection required check actually depends on the a11y job.
- **Flaky visual diffs** across environments: mitigate with reduced motion, font
  readiness, fixed viewport, and running the baseline in the CI container.
- **Silent single-mode run**: mitigate with the asserted mode check in T039.
- **Supply-chain**: an unpinned or same-day dep version — pin an established minor and
  keep the browser download an explicit Chromium-only step.

## Reviewer Guidance

- Confirm the two deps are dev-only and pinned, and that no `src/` runtime module
  imports them.
- Confirm the enumerated page list is explicit constants and includes the Persona
  fixture, a Hub page, and a prose page — in both modes.
- Confirm the dark project genuinely renders dark (the asserted mode check), not light
  twice.
- Confirm `ci-ok` will not pass with a red a11y job, and the three existing lanes are
  byte-unchanged apart from the additive `needs` edge.
- Ask for the stub-and-fail transcript and the cold `--frozen-lockfile` run evidence.
