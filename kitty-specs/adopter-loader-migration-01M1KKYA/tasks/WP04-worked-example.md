---
work_package_id: WP04
title: Worked example demonstrations
dependencies:
- WP01
- WP02
requirement_refs:
- FR-006
- FR-012
- NFR-004
planning_base_branch: feat/adopter-loader-migration
merge_target_branch: feat/adopter-loader-migration
branch_strategy: Planning artifacts for this mission were generated on feat/adopter-loader-migration. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/adopter-loader-migration unless the human explicitly redirects the landing branch.
subtasks:
- T019
- T020
- T021
- T022
- T023
history:
- '2026-09-03: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: example/docs/
create_intent:
- src/tests/example-adopter.test.ts
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- example/docs/**
- src/tests/example-adopter.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

- Run `/ad-hoc-profile-load implementer-ivan` (role: implementer); adopt its identity and boundaries.
- Load doctrine: `spec-kitty charter context --action implement --json`.
- Then read this prompt.

## Objective

Prove each capability against **real build output** in the worked example, so the mission's success criteria are demonstrated, not asserted:

1. An `index.md`-indexed section (SC-001).
2. A renamed section using the registry `subtypes` field, with a rendered sidebar group (SC-002).
3. A redirect map + committed baseline + the coverage gate passing, plus both failure modes captured as focused tests (SC-003).

## Context

- Spec FR-012; SC-001..004; US1/US2/US3. Depends on WP01 (basename + subtypes) and WP02 (redirect gate + `example/astro.config.mjs` + baseline).
- **Ownership boundaries**: you own `example/docs/**` and a new `src/tests/example-adopter.test.ts`. `example/astro.config.mjs` and `example/url-baseline.txt` belong to WP02 — coordinate the redirect entries and baseline URLs with WP02 rather than editing its files (a small, well-justified out-of-map edit with a one-line rationale is acceptable if unavoidable, but prefer asking WP02 to include your URLs).
- `assert-build-artifacts.mjs` is WP01-owned; put your example build assertions in `example-adopter.test.ts`, not in that gate.

### Subtask T019 — `index.md` section in a mixed build [P]

- Add an example section whose index is `index.md`. The basename config (`indexBasename: ['README','index']`) is set by WP02 in `example/astro.config.mjs` (E-08) — you supply the content only.
- **Assert in a build that ALSO contains README-indexed sections** (anti-laziness M2 — prove SC-001 coexists with the README corpus, NFR-003): the `index.md` section slug resolves to the section root (not `/…/index/`) while README sections are unchanged.
- **Also run `node src/scripts/validate-frontmatter.mjs` over this `index.md` section** and assert the root-index exemption fires (anti-laziness m1 — proves the new `.mjs` twin is actually reached, not just parity-matched).

### Subtask T020 — Renamed section with subtypes + sidebar + link integrity [P]

- Rename an example section per the frozen E-08 datum (`plans/features` → `plans/missions`, or the real section WP04 confirms) and declare its `subtypes` in `example/docs/_meta/sections.yaml`. The edit is registry-data + `git mv` only — **no derivation-code change** (SC-002).
- Assert: (a) derived subtype follows the folder; (b) the sidebar group renders its **hub link + child pages** against **built output** (ADR-0029 survival — not merely a non-empty group); (c) **zero dangling `related:`/internal links after the rename** — run `node src/scripts/check-links.mjs` (and the referential-integrity guard) over the renamed tree and assert clean (anti-laziness B1 — this is FR-006 + NFR-004, previously unasserted).

### Subtask T021 — Redirect pass fixture

- Extend WP02's baseline + redirect map (E-08) with the T020 rename's old→new URLs so the old `plans/features/…` paths redirect to the new `plans/missions/…` pages you created. Assert the coverage gate **passes** against the built example (WP02's fixture was already green standalone; this adds the real rename coverage).

### Subtask T022 — Failure-mode fixtures (focused tests, not red gates)

- Encode the two failure modes (uncovered URL; redirect→dead target) as **focused tests** in `example-adopter.test.ts` that invoke the gate on crafted inputs and assert it fails — **never** a permanently-red CI gate. (Follow the repo's behavior-assert-not-baseline discipline.)

### Subtask T023 — Example build assertions

- `src/tests/example-adopter.test.ts`: assert the example builds and that SC-001..004 hold (no index renames needed; rename is data-only; gate passes on covered + fails on uncovered). Keep the existing example green (NFR-003).

## Branch Strategy

- Base/merge target: `feat/adopter-loader-migration`. Enter the lane workspace from `lanes.json`; `spec-kitty agent action implement WP04 --agent <name>`.

## Test Strategy

The example IS the test. Prefer asserting against built `dist/` output. Failure-mode fixtures must be self-contained focused tests, never a standing red gate.

## Definition of Done

- Example demonstrates `index.md` indexing, a data-only rename (subtypes + sidebar), and the coverage gate pass + both failure modes.
- `example-adopter.test.ts` green; existing example unaffected (NFR-003).

## Reviewer Guidance (opus)

- Confirm the rename in the example required **only** registry-data edits (SC-002), no derivation-code change.
- Confirm failure-mode fixtures are focused tests, not a permanently-red CI gate (would red-main the merge).
- Confirm the sidebar group actually renders post-rename in the built output (not just unit-level).

## Activity Log

- 2026-09-03T18:38:48Z – claude – shell_pid=82526 – Implementation complete and committed (f8982f8): worked example demonstrates index.md section (plans/, coexists with README corpus), section rename plans/features->plans/missions via registry subtypes (data-only, no derivation-code edit, SC-002), sidebar hub+children render in built HTML (ADR-0029), zero dangling links post-rename (check-links.mjs), redirect-coverage gate passes with rename URLs baselined (SC-003), both failure modes as focused tests (T022). 17 new tests in src/tests/example-adopter.test.ts; full suite 725/725 green; lint/typecheck/markdownlint clean; validate-frontmatter/check-links/check-redirect-coverage/assert:artifacts all pass against a real build. Subtasks T019-T023 marked done. BLOCKED on move-task WP04 --to for_review: the lane-d branch guard reports kitty-specs/ files committed on this lane branch (status.json, status.events.jsonl, snapshot-latest.json, WP01/WP02 task files) from EARLIER merge commits (9166b19/c4ffa62/17d9fc6, merges of lane-a/lane-b/mission branch into lane-d, predating this WP04 session) — not from my WP04 commit, which touches only example/docs/**, src/tests/example-adopter.test.ts, and .gitignore. Per instructions, not touching kitty-specs/ to resolve this; reporting for the orchestrator/user to clean the lane-d branch's kitty-specs contamination and retry move-task.
