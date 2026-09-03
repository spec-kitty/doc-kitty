---
work_package_id: WP02
title: Redirect-coverage primitive
dependencies:
- WP01
requirement_refs:
- FR-008
- FR-009
- FR-010
- FR-011
- NFR-002
- NFR-005
planning_base_branch: feat/adopter-loader-migration
merge_target_branch: feat/adopter-loader-migration
branch_strategy: Planning artifacts for this mission were generated on feat/adopter-loader-migration. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/adopter-loader-migration unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
- T012
- T013
history:
- '2026-09-03: authored by /spec-kitty.tasks'
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/scripts/check-redirect-coverage.mjs
- src/tests/redirect-coverage.test.ts
- example/url-baseline.txt
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/scripts/check-redirect-coverage.mjs
- src/tests/redirect-coverage.test.ts
- example/astro.config.mjs
- example/url-baseline.txt
- .github/workflows/ci.yml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

- Run `/ad-hoc-profile-load node-norris` (role: implementer); adopt its identity and boundaries.
- Load doctrine: `spec-kitty charter context --action implement --json`.
- Then read this prompt.

## Objective

Ship the toolkit's first **redirect-coverage primitive** so a migrating adopter cannot serve a live 404 on cutover:

1. A **committed URL baseline** (pre-change snapshot).
2. **Redirect emission** via Astro's native `redirects` config.
3. A **bare-Node, target-aware coverage gate** that fails when a baselined URL has neither a live page nor a redirect whose target chain terminates at a live page — including the rename churn from WP01/US2.

## Context

- Spec: US3; FR-008/009/010/011; NFR-002/005. Design: `research.md` (D-04, D-05, D-07), `data-model.md` (E-03, E-04, E-07), `contracts/redirect-coverage-gate.md`.
- **Depends on WP01** — capture the baseline against the settled URL scheme (basename + rename).
- Pattern sources (read, don't own): `src/scripts/check-links.mjs` (~75-86, link-walk + index-candidate resolution) and `src/scripts/assert-build-artifacts.mjs` (dist/ HTML assertion pattern). Your gate is a sibling bare-Node script.
- Astro redirects: `defineConfig({ redirects: { '/old/': '/new/' } })` produces static redirects; optionally emit `_redirects`.

### Subtask T009 — Red-first gate test

`src/tests/redirect-coverage.test.ts` (failing first):
- pass: every baselined URL resolves or redirects to a live page.
- fail: a baselined URL with no page and no redirect → named uncovered.
- fail: a redirect whose target 404s → named dead target (the B1 defect).
- chain: a redirect to an itself-redirected URL resolves to the live terminus.

### Subtask T010 — Committed URL baseline (self-consistent at WP02)

- Create `example/url-baseline.txt` (or `.json`) — a committed list of pre-change site URLs that must keep resolving. Version-controlled, **never** regenerated from the current build (NFR-005).
- **Seed a self-contained, green-at-WP02 fixture** (anti-laziness M4 / `data-model.md` E-08): baseline + redirects must reference **only URLs that already exist in the example at WP02 time** (e.g. redirect one old alias to an existing page). Do **not** hardcode a URL for the WP04 rename that does not exist yet — that would red the gate between the WP02 and WP04 merges. WP04 extends this fixture for its rename using the frozen E-08 datum.

### Subtask T011 — Redirect emission + example `indexBasename`

- Add a `redirects` map to `example/astro.config.mjs` covering the self-contained fixture from T010 (and, per E-08, the frozen new-URL prefix WP04 will realise). Keep the existing config intact. Optionally emit `_redirects`.
- **Also set `indexBasename: ['README','index']`** in the example's `defineDocKittyIntegrations(...)` config (anti-laziness M3) so WP04's `index.md` section collapses while README sections stay green in the same build. This resolves the ownership gap — the basename config lives in this WP02-owned file; WP04 supplies the `index.md` content only.

### Subtask T012 — Coverage gate

- `src/scripts/check-redirect-coverage.mjs` per `contracts/redirect-coverage-gate.md`:
  - inputs: baseline file, `dist/`, redirect map (default: Astro-emitted / `_redirects` in dist).
  - per-URL verdict per E-07; **target-aware** — follow redirect chains to a live terminus; a dead/looping target is `uncovered` and named.
  - exit 0 iff all covered; non-zero prints each uncovered URL (+ failing target).
  - bare Node, no Astro build spawned, deterministic (NFR-002).

### Subtask T013 — CI wiring

- Add a step running the gate to the appropriate CI lane (alongside doc-sanity / the example build). Keep the single `ci-ok` aggregate the only required check (ADR-0007). Ensure the gate runs after the example build produces `dist/`.

## Branch Strategy

- Base/merge target: `feat/adopter-loader-migration`. Enter the lane workspace from `lanes.json`; run `spec-kitty agent action implement WP02 --agent <name>`. Do not hand-create a branch.

## Test Strategy

ATDD red-first (T009). The gate is pure bare-Node I/O over `dist/` — keep it deterministic and dependency-free (Node stdlib only). Complexity ≤ 15; extract a chain-resolver helper with its own test if needed.

## Definition of Done

- `redirect-coverage.test.ts` green (pass + uncovered-fail + dead-target-fail + chain).
- Baseline committed and not build-derived; redirects emitted; gate wired into CI and green on the example.
- No new runtime dependency; bare-Node; deterministic.

## Reviewer Guidance (opus)

- Confirm the gate is genuinely **target-aware** — construct a redirect→404 and verify it fails (the whole reason #42 exists).
- Confirm the baseline is committed and the gate does not regenerate it from the current build (NFR-005) — otherwise it can never fail.
- Confirm no Astro build is spawned by the gate (NFR-002) and there is no network access.
