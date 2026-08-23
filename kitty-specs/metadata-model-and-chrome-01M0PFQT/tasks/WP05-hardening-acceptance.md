---
work_package_id: WP05
title: Test & assertion hardening + acceptance
dependencies:
- WP03
- WP04
requirement_refs:
- FR-021
- FR-022
- NFR-002
- NFR-006
planning_base_branch: feat/metadata-model-and-chrome
merge_target_branch: feat/metadata-model-and-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-model-and-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-model-and-chrome unless the human explicitly redirects the landing branch.
subtasks:
- T027
- T028
- T029
- T030
- T031
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: reviewer-renata
authoritative_surface: src/scripts/
create_intent:
- src/scripts/assert-chrome-artifacts.mjs
execution_mode: code_change
owned_files:
- src/scripts/assert-chrome-artifacts.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load reviewer-renata` (role: implementer — anti-laziness hardening).
Apply it, then read this WP, [../spec.md](../spec.md) (SC-001…SC-006),
[../contracts/chrome-and-build-assertions.contract.md](../contracts/chrome-and-build-assertions.contract.md),
and [../quickstart.md](../quickstart.md).

> Ownership note: this WP **owns a new module** `src/scripts/assert-chrome-artifacts.mjs`
> that holds the chrome/pagefind assertions, invoked from `assert-build-artifacts.mjs`
> (which WP01 owns — add the one-line invocation as a recorded out-of-map edit).
> WP01 set the agent-index keys/count; WP02 added the sitemap assertion out-of-map.
> Keep the chrome assertions in the new module so lane ownership stays clean.

## Objective

Make the build-artifact assertions specific enough that a **stubbed** chrome
element fails them, then prove the whole mission green against the success
criteria. This is the anti-laziness gate the post-spec squad demanded (FR-011 /
FR-017 must not be satisfiable by a hand-written stub).

## Subtasks

### T027 — Chrome build assertions (new module)

- Create `src/scripts/assert-chrome-artifacts.mjs` (WP-owned) and invoke it from
  `assert-build-artifacts.mjs` (one-line recorded out-of-map edit). It must assert,
  over `example/dist`:
  - the metadata band + a **text-labelled** status token on a known published page;
  - an optimized hero `<img>` (hashed `/_astro/…` src) with a non-empty `alt` on
    the hero demonstrator;
  - complete head share tags (`og:*`, `twitter:card`, `twitter:image`, canonical),
    and the resolved `og:image` is **three distinct values** across the hero /
    social_thumb / site-default demonstrator pages (WP03 T022);
  - the four carriers present, and the emitted CSS declares **every token name**
    from an enumerated `REQUIRED_DK_TOKENS` list (derived from theming.md:
    surfaces, text, accent + accent-text, state + `-bg` pairs, type scale/leading/
    weights/caps, spacing, radius, elevation, widths) — **completeness, not just
    presence** — plus its `--dk-* → --sl-*` bridge assignments;
  - **AA by construction**: the emitted CSS contains a `min-height`/`min-width`
    ≥24px rule on interactive chrome targets and a `:focus-visible` rule (grep);
  - the Hub page's body text present in the pagefind index (from WP04).
- **Each assertion must fail if its element is stubbed/missing** — prove this
  per-class (see DoD), not once.

### T028 — Full local `ci-ok` sweep + no-new-deps (NFR-006)

- Run every lane from [../quickstart.md](../quickstart.md): code-quality
  (test/lint/typecheck), doc-sanity (validate-frontmatter + links + markdownlint +
  vale), build-example (build + assert:artifacts). All green.
- **NFR-006**: assert `pnpm-lock.yaml` and the package manifests added no new
  runtime/build dependency vs the mission base (a lockfile diff check).

### T029 — Atomic-cutover + occurrence-map verification

- Verify C-010 with **depth-inclusive** pathspecs (`docs/*.md 'docs/**/*.md'
  example/docs/*.md 'example/docs/**/*.md'`): no legacy `status:` key remains; every
  page has doc_status + kind; **explicitly** confirm `docs/README.md` **and**
  `example/docs/README.md` carry doc_status + kind (the naive glob misses them).
- Confirm the migrated set is **85** files (72 + 13); the `agent-page.ts` HTTP
  `status: 404` decoy is intact; ADR bodies keep `## Status`. Run the
  occurrence_map.yaml `verification` block.

### T030 — Reconcile assertion notes + pins (three writers)

- `assert-build-artifacts.mjs` has three writers (WP01 keys/count/note, WP02
  sitemap, WP05 chrome-module invocation). Confirm `EXPECTED_INDEX_ENTRY_COUNT == 12`,
  `EXPECTED_PAGE_KEYS` includes doc_status+kind, the stale "out of scope" note is
  gone, and there are **no dead or duplicate** sitemap/count/pagefind checks after
  the three edits merge.

### T031 — Acceptance walkthrough + AA checklist

- Write `acceptance.md` in the mission dir mapping SC-001…SC-006 to the concrete
  command/assertion that proves each, with the observed result, **including the
  per-class stub-and-confirm-fail evidence** (T027).
- Add a **manual AA checklist** (NFR-001 residual): the computed contrast ratio for
  each `--dk-*` state/`-bg` and status-pill pair actually used by the chrome, each
  ≥4.5:1, plus a note that ≥24px targets and `:focus-visible` are grep-asserted.
- Confirm the branch is ready to open a PR into `spec-kitty/doc-kitty` `main`.

## Branch Strategy

Base/merge: `feat/metadata-model-and-chrome`. Depends on WP03 + WP04 (asserts their
outputs). Work in your lane's worktree.

## Definition of Done

- `pnpm assert:artifacts` fails when **each** asserted class is stubbed —
  demonstrate stub-and-confirm-fail **per class** (band, hero, each head-tag family,
  three-branch image, carriers, token-catalog completeness, ≥24px/focus CSS,
  pagefind), each recorded in `acceptance.md`; then restore.
- All three `ci-ok` lanes green; NFR-006 lockfile check passes; SC-001…SC-006 each
  backed by a passing check in `acceptance.md`; the AA checklist is present.
- The atomic-cutover invariant holds (depth-inclusive verification, both READMEs
  confirmed); the occurrence-map verification passes.

## Risks & reviewer guidance

- **Fakeable assertions** — reviewer temporarily stubs one chrome element and
  confirms the assertion actually fails.
- **Assertion coherence** — reviewer confirms the three WPs' edits to
  assert-build-artifacts.mjs merged cleanly (no dead/duplicate checks).
