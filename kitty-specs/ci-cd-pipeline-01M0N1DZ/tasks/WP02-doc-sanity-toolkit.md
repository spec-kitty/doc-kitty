---
work_package_id: WP02
title: Doc-sanity toolkit (validators + configs)
dependencies:
- WP01
requirement_refs:
- C-002
- FR-008
- FR-009
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
- T011
- T012
- T013
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: node-norris
authoritative_surface: src/scripts/validate-frontmatter.mjs
create_intent:
- src/scripts/check-links.mjs
- .markdownlint.jsonc
- .vale.ini
- .vale/styles/DocKitty/Hedges.yml
execution_mode: code_change
owned_files:
- src/scripts/validate-frontmatter.mjs
- src/scripts/check-links.mjs
- .markdownlint.jsonc
- .vale.ini
- .vale/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

```
/ad-hoc-profile-load node-norris
```

Apply its identity, boundaries, directives, and tactics; state which you applied.

## Objective

Deliver the four **build-free** doc-sanity checks as runnable tools that each turn
red on their defect class: frontmatter validation across `docs/` **and**
`example/docs/`, internal link/`related` integrity, markdownlint, and a Vale prose
stylecheck gated at `error`. WP04 wires these into the CI doc-sanity lane; this WP
owns the scripts and configs, not `ci.yml`.

## Context

- `src/scripts/validate-frontmatter.mjs` exists but is invoked today only over
  `example/docs` (via `example` `validate`). The design requires it to cover
  `docs/` too (a schema/validator change can invalidate repo docs).
- Frontmatter contract lives in ADR-0005 / `src/lib/schema.ts` (`doc_status`,
  `kind`, `type`-by-path, bounded `description`). Reuse the toolkit schema; do not
  re-implement it.
- The design orders checks cheap→thorough (fail fast). Vale starts **minimal** to
  avoid noise, expands over time.

## Subtasks

### T008 — Extend frontmatter validation to docs/ and example/docs/
- Make `validate-frontmatter.mjs` accept one or more roots and validate all `.md`
  under each. Reuse `@commondocs-kitty/toolkit` schema (`gray-matter` + `zod`).
- Required fields, `doc_status` enum, `kind` enum, `type`-by-path, bounded
  `description` length. Non-zero exit on any violation, with a clear file:line-ish
  message.

### T009 — Link & reference integrity
- Add `src/scripts/check-links.mjs`: resolve internal `.md`/route links and
  `related` frontmatter refs across `docs/` and `example/docs/`. **Fail on dangling**
  (mirrors the client's build-fail guarantee). External URLs are out of scope here
  (lychee covers those in the nightly).
- **Zero new dependencies**: WP01 owns all manifests and vendors no markdown parser;
  do link extraction with string/regex-level scanning, not a new dependency.

### T010 — markdownlint config
- Add `.markdownlint.jsonc` with a shared, boring ruleset (heading increments, list
  style, no bare URLs, sentence-case not enforced here). This is the config
  `markdownlint-cli2` (dep added in WP01) consumes.

### T011 — Vale config + minimal style
- Add `.vale.ini` (MinAlertLevel = error) and a minimal custom style under
  `.vale/styles/DocKitty/` encoding a few plain-language rules (e.g. a banned-hedges
  list). Keep it small; gate only `error` severity.

### T012 — Fix violations surfaced under docs/ (boy-scout)
- Running the extended validators over `docs/` may surface real violations. Fix them
  (DIRECTIVE_025). Edits to `docs/**` content are out-of-map but expected here —
  record a one-line rationale per the ownership rules.

### T013 — Prove each defect class fails
- Demonstrate locally that a malformed frontmatter, a dangling `related`, a
  markdownlint violation, and a Vale `error` each make their check exit non-zero;
  and a clean tree passes all four.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. Worktree
allocated per lane from `lanes.json`.

## Definition of Done

- `validate-frontmatter.mjs` covers both roots; `check-links.mjs` fails on dangling;
  `.markdownlint.jsonc`, `.vale.ini`, and a minimal `.vale/` style exist; each defect
  class demonstrably fails; `docs/` passes clean.

## Risks

- Extending validation to `docs/` may surface many pre-existing issues — fix, don't
  silence; if a fix is genuinely large/out-of-domain, file it and note the deferral.
- Vale noise: keep the starter style tiny; over-strict prose rules will swamp PRs.

## Reviewer guidance

- Confirm both roots are validated; confirm the four failure demos; confirm Vale is
  gated at `error` and the style is minimal; confirm no `ci.yml` edits (that's WP04).
