# Tasks: Generic Doc-Kitty MCP Server

**Mission**: doc-kitty-mcp-server-01M6BAQX
**Branch**: planning base `feat/doc-kitty-mcp-server`; merge target `main` (via PR)
**Generated**: 2026-11-01 from plan.md (4 Implementation Concerns, post-squad-amended)
**Total**: 8 work packages, 29 subtasks (WP05 split by the post-tasks squad; WP08 carries T022/T023)

## Subtask Index

| Subtask | Description | WP | Parallel |
|---------|-------------|----|----------|
| T001 | Dependency-free artifact contract-types module + subpath export | WP01 | - |
| T002 | Retype the three generator routes against the contract types | WP01 | - |
| T003 | Emit `sections[]` from the section registry into the machine index | WP01 | - |
| T004 | Per-artifact `buildId` (source-input hash) in index + pages + scenarios, with determinism test | WP01 | - |
| T005 | Config-gated MCP wiring pointer in `_links.mcp` + `llms.txt`; example snapshots updated | WP01 | - |
| T006 | `mcp/` workspace package scaffold (private, bin, tsc emit, tsconfig types:["node"], workspace + filters.yml + root scripts) | WP02 | - |
| T007 | Named error taxonomy module | WP02 | - |
| T008 | CorpusSource port + HTTPS adapter (bounded parallelism, retry policy) | WP02 | - |
| T009 | Filesystem adapter + link re-origining | WP02 | - |
| T010 | Snapshot loader (handshake, buildId compare-all, gating detection) + CLI arg parse/exit codes + unit tests | WP02 | - |
| T011 | MCP server wiring over stdio (SDK v2) | WP03 | - |
| T012 | `get_site_info` + `list_pages` tools | WP03 | - |
| T013 | `get_page` tool (+ `uri` in outputs) | WP03 | - |
| T014 | `search_pages` tool (registry order, published fields, cap 25) | WP03 | - |
| T015 | `list_scenarios` tool + unavailability reporting | WP03 | - |
| T016 | Hand-rolled validation guards for all tool inputs/outputs | WP03 | [P] T012-T015 |
| T017 | Site-slug canonical derivation + URI minting | WP04 | - |
| T018 | `resources/list` + `resources/read` + template, size gate both branches | WP04 | - |
| T019 | Resource surface unit tests (listed and gated modes) | WP04 | - |
| T020 | Golden byte-derivation conformance suite (two modes, in-test expectations, full matrix) | WP05 | - |
| T021 | Failure-matrix fixtures + named-error tests (six errors + controls) | WP05 | [P] T020 |
| T022 | No-HTTP-imports boundary test + BUILD_SUITES serialized lane entry | WP08 | [P] T020/T021 |
| T023 | NFR verifications: start budgets (incl. 1000-page bound with latency injection), memory measure+extrapolate, fs network-off, snapshot immutability, HTTPS negative control | WP08 | [P] T020/T021 |
| T024 | Pack-closure audit script + CI assertion (one declared dep, <=5 lockfile entries, zero install scripts) | WP06 | - |
| T025 | Clean-room tarball consumption test (pack, install, stdio smoke) | WP06 | [P] T024 |
| T026 | mcp README (supported spec revision, wiring) + quickstart sync + pointer e2e via tarball | WP06 | - |
| T027 | ADR: Shape A decision, B rejection + re-trigger, pass-through invariant, R4 fork, Q-P1 outcome | WP07 | - |
| T028 | Changelog fragment + generators.md fifth-surface paragraph + guides quickstart page | WP07 | [P] T027 |
| T029 | Final spec checklist sweep + cross-artifact consistency pass (spec/plan/contract IDs, thresholds) | WP07 | [P] T028 |

---

## WP01 — Toolkit contract: types, sections, buildId, pointer [IC-01]

**Goal**: the emitted corpus becomes self-describing, and its published shape gains an exported, dependency-free type contract the server can `import type` without dragging Astro virtual modules.
**Priority**: P1 (blocks clean server implementation).
**Independent test**: `pnpm --filter @spec-kitty/doc-toolkit test` green; the example build emits `sections[]`, `buildId` on all three artifact kinds; a dependency-free `tsc --noEmit` compile of a throwaway file importing only `@spec-kitty/doc-toolkit/contract` types passes outside Astro.
**Estimated prompt size**: ~420 lines.

- [ ] T001 Contract-types module + subpath export (WP01)
- [ ] T002 Retype generator routes against contract (WP01)
- [ ] T003 sections[] emission from registry (WP01)
- [ ] T004 buildId stamps + determinism test (WP01)
- [ ] T005 Config-gated pointer emission (WP01)

**Dependencies**: none.
**Parallel opportunities**: none internal (files share the routes module); T005 may not start before T001 lands.
**Risks**: example snapshot expectations churn; contract module must stay dependency-free (zero imports outside its file); determinism test must rebuild twice and compare.
**Prompt**: `tasks/WP01-toolkit-contract-additions.md`

---

## WP02 — Corpus IO, snapshot loader, launch CLI [IC-02]

**Goal**: two corpus sources (HTTPS, filesystem) behind one port; launch-time immutable snapshot with version handshake and per-artifact buildId comparison; link re-origining in fs mode; CLI with exit codes; the workspace package, CI path filters and root-script widening that make any of it runnable in CI.
**Priority**: P1 (blocks everything server-side).
**Independent test**: `pnpm --filter @spec-kitty/doc-kitty-mcp test` green over fixtures; CLI exits 2 on unknown major against a fixture with `version: "99"`.
**Estimated prompt size**: ~430 lines.

- [ ] T006 Package scaffold + wiring (workspace member, filters.yml, root scripts) (WP02)
- [ ] T007 Error taxonomy module (WP02)
- [ ] T008 HTTPS adapter (WP02)
- [ ] T009 Filesystem adapter + rewrite (WP02)
- [ ] T010 Snapshot loader + CLI + unit tests (WP02)

**Dependencies**: WP01 (contract types for compile-level coupling; fixtures suffice to start).
**Parallel opportunities**: T007/T008/T009 lightly parallel after T006.
**Risks**: NFR-001 latency budget (bounded parallelism >= 8); empty-slug identity trap (identity from records only); hand-rolled guards only (no schema lib).
**Prompt**: `tasks/WP02-corpus-io-and-cli.md`

---

## WP03 — MCP server core: tools [IC-03, surface half]

**Goal**: stdio MCP server over SDK v2 exposing the five read-only tools with the named error taxonomy, hand-rolled validation guards, and tool outputs byte-derived from the snapshot.
**Priority**: P1.
**Independent test**: in-process SDK client (stdio or in-memory transport) drives all five tools against the example fixture; responses match documented projections.
**Estimated prompt size**: ~460 lines.

- [ ] T011 Server wiring (stdio only) (WP03)
- [ ] T012 get_site_info + list_pages (WP03)
- [ ] T013 get_page + uri field (WP03)
- [ ] T014 search_pages (registry order) (WP03)
- [ ] T015 list_scenarios + unavailability (WP03)
- [ ] T016 Validation guards (WP03)

**Dependencies**: WP02.
**Parallel opportunities**: T016 parallel with T012-T015.
**Risks**: SDK v2 API drift (pin 2.4.0; re-check latest at WP start per DIRECTIVE_048); C-001 fence: no ranking, no body search.
**Prompt**: `tasks/WP03-mcp-server-tools.md`

---

## WP04 — Resource surface (size-gated) [IC-03, FR-011]

**Goal**: `docs://<site-slug>/pages/<id>` (+ sections) resources with canonical site-slug derivation, resource template registration, size gate at 1000 with URI emission in tool outputs.
**Priority**: P2. **Q-P1 ruled hybrid by the operator on 2026-11-01 - this WP is live.**
**Independent test**: gated vs listed runs on the example corpus (threshold above and below 68 pages) both conform.
**Estimated prompt size**: ~280 lines.

- [ ] T017 Site-slug derivation + URI minting (WP04)
- [ ] T018 resources/list, resources/read, template, size gate (WP04)
- [ ] T019 Resource surface tests, both branches (WP04)

**Dependencies**: WP03.
**Parallel opportunities**: none internal.
**Risks**: two-behavior conformance (both branches must be exercised); client resource-support variance (documented escape hatch: tools carry uris).
**Prompt**: `tasks/WP04-resource-surface.md`

---

## WP05 — Conformance and failure gates [IC-03, proof half]

**Goal**: golden byte-derivation suite with in-test independent expectations (both input modes, full SC-003 matrix), the six-error failure matrix (SC-004), the no-HTTP boundary test (C-003), the serialized BUILD_SUITES lane entry, and the NFR verifications (latency budgets incl. the 1000-page bound, memory measure+extrapolate, fs network-off control, snapshot immutability under mid-process source mutation, HTTPS network-negative control).
**Priority**: P1.
**Independent test**: new lane entries fail when run against a deliberately mutated server (one seeded derivation fault) - the suite is its own positive control against vacuity.
**Estimated prompt size**: ~440 lines.

- [ ] T020 Byte-derivation conformance suite (WP05)
- [ ] T021 Failure matrix fixtures + named-error tests (WP05)

**Dependencies**: WP03 only (resources branch coverage activates if WP04 merges - never blocks).
**Parallel opportunities**: parallel with WP04 and WP08.
**Risks**: seeded-fault mechanism must be demonstrably red-on-fault; fixtures fossilize without WP08's fresh-build lane.
**Prompt**: `tasks/WP05-conformance-gates.md`

---

## WP08 - Boundary, serialized lane, NFR verification [IC-03, proof half]

**Goal**: no-HTTP boundary test (C-003), serialized BUILD_SUITES lane against a freshly served example build, and the NFR verification set (latency budgets with latency-injection discrimination, memory measure+extrapolate, and the fs/snapshot/negative-endpoint controls).
**Priority**: P1.
**Independent test**: boundary test goes red on a seeded HTTP import; lane drives the packed binary against the SERVED site.
**Estimated prompt size**: ~330 lines.

- [ ] T022 Boundary test + serialized lane (WP08)
- [ ] T023 NFR verifications + fake-path-killer controls (WP08)

**Dependencies**: WP03 only.
**Parallel opportunities**: parallel with WP05 and WP04.
**Risks**: serialized runtime budget; localhost latency too fast to discriminate without artificial injection.
**Prompt**: `tasks/WP08-boundary-lane-nfr.md`

---

## WP06 — Packaging, supply chain, consumption [IC-03, tail]

**Goal**: pack-closure audit with CI assertion (exactly one declared runtime dep, at most 5 new lockfile entries, zero install scripts), clean-room tarball consumption test on the charter-cleanroom pattern, README naming the supported spec revision, quickstart/wiring-sync, pointer e2e via tarball.
**Priority**: P1.
**Independent test**: clean-room install of the packed tarball launches and answers over stdio; closure audit prints the count and fails if exceeded.
**Estimated prompt size**: ~350 lines.

- [ ] T024 Closure audit + CI assertion (WP06)
- [ ] T025 Clean-room consumption test (WP06)
- [ ] T026 README + quickstart + pointer e2e (WP06)

**Dependencies**: WP03 (packagable server), WP05 + WP08 (conformance and lanes green first).
**Parallel opportunities**: T024 and T025 parallel.
**Risks**: bin/exports correctness verified only pre-publish via tarball (C-002); npm provenance discussion deliberately excluded.
**Prompt**: `tasks/WP06-packaging-consumption.md`

---

## WP07 — Governance artifacts [IC-04]

**Goal**: the ADR mandated by C-004 (Shape A decision, Shape B rejection + re-trigger, pass-through invariant, R4 record of the relative-at-build fork, Q-P1 outcome), one changelog fragment, the generators.md fifth-surface paragraph, a guides quickstart page, and the final cross-artifact consistency sweep.
**Priority**: P2 (but merge-blocking via C-004).
**Independent test**: `spec-kitty status` and repo doc-sanity checks pass; ADR number picked against main + open PRs at writing time; no edit to docs/adr/README.md (bot-owned).
**Estimated prompt size**: ~260 lines.

- [ ] T027 ADR authored (WP07)
- [ ] T028 Changelog fragment + docs (WP07)
- [ ] T029 Final consistency sweep (WP07)

**Dependencies**: WP01, WP02, WP03, WP05, WP06, WP08 (not WP04 - contingent on Q-P1).
**Parallel opportunities**: T027/T028/T029 parallel.
**Risks**: ADR number race with open PRs; T029 must re-run after any late T0xx amendment.
**Prompt**: `tasks/WP07-governance-artifacts.md`
