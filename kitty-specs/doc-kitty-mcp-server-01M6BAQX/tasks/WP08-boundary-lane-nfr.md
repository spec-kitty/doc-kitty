---
work_package_id: WP08
title: Boundary, serialized build lane, NFR verification
dependencies:
- WP03
requirement_refs:
- FR-001
- FR-002
- FR-006
- NFR-001
- NFR-002
- C-003
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-doc-kitty-mcp-server-01M6BAQX
base_commit: 863601125d0a6c61072c8fde31351c79f729ac75
created_at: '2026-11-01T19:55:39.086531+00:00'
subtasks:
- T022
- T023
history:
- '2026-11-01 planned: split out of WP05 by the post-tasks squad (planner lens: WP05 carried ~5 verification programmes and sat twice on the critical path)'
authoritative_surface: mcp/tests/
create_intent: []
execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- src/vitest.workspace.ts
- .github/workflows/**
- mcp/tests/perf/**
---

# WP08 - Boundary, serialized build lane, NFR verification

## Objective

Everything structural about proof that is not the golden/failure matrix: the no-HTTP boundary test, the serialized BUILD_SUITES lane (fresh example build served statically, conformance run against the SERVED site - kills the FR-001 fixture-fake), and the NFR verification set.

### T022 - Boundary test + serialized lane

- C-003 boundary test: scan/guard that the built server graph contains no HTTP listener import (follow the repo's existing module-boundary test precedent: static import-graph assertion over `mcp/dist`).
- BUILD_SUITES lane entry in `src/vitest.workspace.ts`: build `example/` once, serve `dist` statically, spawn the packed dev server binary over stdio, drive the SDK client through the conformance suite against the SERVED site (kills the FR-001 fake: bytes must come from the served site).
- Keep the serialized runtime within budget; the example build is ~fast today - measure and record.

### T023 - NFR verifications + fake-path-killer controls

- NFR-001: assert start-to-ready budgets with timers around load (local <= 5 s; https example <= 15 s); a scripted 1000-page synthetic corpus (fs-generated JSON fixtures, cheap to mint programmatically - NOT a committed 1000-page fixture) proves <= 60 s HTTPS-bound behavior using the local static server... acceptable mechanism: generated fixture dir served by the local static server.
- NFR-002: measure RSS at example scale, record per-page snapshot cost, extrapolate 10k in a documented note file `mcp/tests/fixtures/MEMORY-NOTES.md` (no 10k fixture machinery).
- FR-002 control: fs mode with network blocked (test asserts zero outgoing sockets / uses a proxy fail trap) - kills the silent-network-fallback fake.
- FR-006 control: mutate the served corpus mid-process (swap fixture content under the static server) and assert answers stay pinned to the launch-time snapshot.
- FR-001 negative control: server against an endpoint returning nothing -> UNREACHABLE_ENDPOINT/MALFORMED_CORPUS, never fixture content.

## Definition of Done

- [ ] Boundary test green, and demonstrably red when an HTTP import is seeded.
- [ ] Serialized lane green within the existing runtime budget; numbers recorded.
- [ ] NFR-001 budgets asserted with timers; the 1000-page synthetic corpus is generated programmatically at test time, with artificial per-request latency injected so the 60 s bound actually discriminates (reviewer lens: localhost fetches are too fast to discriminate c=1 from c>=8 - either assert the concurrency parameter in a unit test or make latency real).
- [ ] NFR-002 evidence recorded (measure at example scale, documented extrapolation note).
- [ ] Fake-path-killer controls demonstrated: fs mode with network blocked opens zero sockets; a mid-process corpus mutation under the static server leaves answers pinned to the launch snapshot; an endpoint returning nothing yields a named error, never fixture content.
