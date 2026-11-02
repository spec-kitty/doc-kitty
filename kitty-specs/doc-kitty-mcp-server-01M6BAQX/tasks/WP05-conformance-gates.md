---
work_package_id: WP05
title: Conformance, failure matrix, NFR and fake-path gates
dependencies:
- WP03
requirement_refs:
- FR-010
- SC-002
- SC-003
- SC-004
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-doc-kitty-mcp-server-01M6BAQX
base_commit: 5ea9ff1d19bfa3e3a27bea1cc60b32f568be51a7
created_at: '2026-11-01T19:55:14.155722+00:00'
subtasks:
- T020
- T021
history:
- '2026-11-01 planned: created from IC-03 of plan.md after post-plan squad amendments (reviewer lens: fakeable-criteria closure)'
authoritative_surface: mcp/tests/
create_intent: []
execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- mcp/tests/conformance/**
- mcp/tests/fixtures/**
tags: []
tracker_refs: []
---

# WP05 - Conformance, failure matrix, NFR and fake-path gates

## Objective

Prove the pass-through invariant by construction and kill every fake path the reviewer lens enumerated. This WP is the mission's acceptance heart: it exists so that a dishonest implementation CANNOT pass. Scope after the planner-lens split: the golden suite (T020) and failure matrix (T021); the boundary test, serialized lane and NFR verification matrix moved to WP08, which depends only on WP03 and runs in parallel. Resource-branch coverage in T020 activates if and when WP04 merges (no hard dependency - Q-P1 must never block the critical path).

Squad context you must respect (reviewer lens, all must-fix):

- **V4**: the assertion mechanism is pinned: every expected value is computed IN-TEST by independently re-reading the artifact file through the documented projection. Vitest output-generated snapshots (`toMatchSnapshot` style) are excluded. Freshness anchors in a fresh example build served over HTTP in the serialized lane, with committed fixtures as the fast-lane copies.
- **V6**: torn-detection proof needs a mixed-buildId fixture WITH buildId emission enabled (else the migration allowance silently no-ops the test).
- **V8**: the failure matrix is enumerated per named error; an untested taxonomy entry fails review by absence of evidence.
- **V1**: search needs three discriminating controls (keyword-only hit / body-only miss / known-K recall).
- **FR-010 vs FR-007 (D1)**: run the golden comparison in BOTH input modes; fs mode = content byte-identity + documented link-rewrite assertions.

## Subtask guidance

### T020 - Golden byte-derivation conformance suite

Matrix (SC-003, minimum): all 5 tools (+ resources both branches when WP04 landed), over a sample of >= 10 example pages INCLUDING the empty-slug home page, BOTH input modes, one pages-links-gated run, AND the three SC-002 discriminating controls spelled out, each with its own fixture term: a keyword-only term produces a hit; a body-only term produces zero hits; a known-K term returns exactly those K pages, none missing.

- In-test expectation: read the artifact from the served/built fixture, apply the documented projection, assert field-level byte equality with the tool output (per output field, not whole-object diffing alone).
- Seeded-fault self-test (auto-vacuity control), writable mechanism (implementer lens): a dev-only launch-config fault hook `createServer(snapshot, { faults: { uppercaseTitles: true } })` read by the projection; one fast-lane test re-runs the field-level comparisons with the flag on and asserts they go red. If the suite stayed green, the suite itself fails review.
- HTTPS mode byte-identity; fs mode content-identity + link-delta rule (contract carve-out).

### T021 - Failure matrix fixtures + tests

One fixture+assertion per named error (SC-004):
- UNKNOWN_CONTRACT_MAJOR: `version: "99"` fixture AND a non-numeric-version fixture.
- UNREACHABLE_ENDPOINT: server pointed at a listening socket that returns 500 / at a dead port.
- MALFORMED_CORPUS: fixture with a required field removed.
- PAGES_LINKS_GATED: fixture with per-page links disabled; assert degrade announcement.
- BUILD_IDENTITY_MISMATCH: mixed-buildId fixture, emission enabled.
- PAGE_NOT_FOUND: unknown id via `get_page` and `resources/read`.
Every failure must surface within the retry policy's bounds - assert no-hang with a hard time budget per test (e.g. 2 s fs / 35 s https worst case, lower if cheap).

## Definition of Done

- [ ] SC-003 minimum matrix green; seeded-fault self-test demonstrated red.
- [ ] SC-004: six named errors, one test each, all within time budgets.
- (moved to WP08) Boundary test - see tasks/WP08-boundary-lane-nfr.md
- (moved to WP08) NFR-001/002 evidence - see tasks/WP08-boundary-lane-nfr.md
- (moved to WP08) serialized-lane CI wiring - see tasks/WP08-boundary-lane-nfr.md

## Risks / reviewer guidance

- Reject any expectation derived from server output (V4).
- Reject committed-only fixtures with no fresh-build anchoring (fossilization).
- Reviewer: re-run the seeded-fault proof personally before approving.

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Depends on WP03 + WP04.

Implementation command: `spec-kitty agent action implement WP05 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
