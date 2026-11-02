# Squad Finding Dispositions

**Mission**: doc-kitty-mcp-server-01M6BAQX
**Squads**: pre-spec shape squad (2026-11-01), post-plan review squad (2026-11-01)
**Contract**: every squad finding gets exactly one disposition: accepted / changed / deferred_with_rationale. None dropped silently.

## Pre-spec squad (shape decision)

| # | Finding (lens) | Disposition | Evidence |
|---|---|---|---|
| P1 | Shape A over B (all 4 lenses, unanimous) | accepted | spec.md "Design basis"; C-004 ADR obligation in plan IC-04 |
| P2 | Stack: TypeScript/Node 22, workspace package (4 lenses) | accepted | plan.md Technical Context; C-005 |
| P3 | SDK divergence v1 vs v2 | changed (adjudicated from npm registry: v2 current, 2.4.0) | research.md R1 |
| P4 | Pass-through fence + fail-closed + snapshot-at-start preconditions | accepted | spec C-001/FR-005/FR-006; research R2 |
| P5 | stdio-only v1, single trust-root package | accepted | C-003, C-002 |
| P6 | B-rejection re-trigger (>=3 consumer demands) | deferred_with_rationale | C-004 ADR scope (plan IC-04) |
| P7 | Publish posture | changed (operator ruled: no registry publish; GitHub Packages documented as token-walled) | spec C-002; research R6 |

## Post-plan squad

### architect-alphonso

| # | Finding | Disposition | Evidence |
|---|---|---|---|
| A1 | Type-only coupling not achievable today (no exported artifact types; root entry drags astro:content) -> dependency-free contract module, routes retyped | accepted | plan.md IC-01(a) + project structure adds src/lib/contract.ts + subpath export |
| A2 | `search_pages` "ranked" contradicts C-001 | changed (word): registry-order output, cap 25 | contracts/mcp-surface.md tool table; spec FR-004 |
| A3 | FR-008 index-only scope + emitted-bytes hash self-reference | accepted: per-artifact buildId from canonical source-input serialization; determinism assertion committed | research.md R3 amended; spec FR-008; plan IC-01(c), IC-03 |
| A4 | Seam map wrong: filters.yml not ci.yml; pnpm-workspace.yaml; root scripts; tsc emit toolchain | accepted | plan.md Technical Context + structure tree |
| A5 | FR-007 rewrite vs C-001/FR-010 never reconciled | accepted: rewritten field set enumerated, default fixed, markdown untouched, re-origining classified as link-field projection -> ADR | research.md R4; contracts carve-out; plan IC-02 |
| A6 | keywords not in index records (data-model phantom field) | accepted: source corrected to per-page artifacts | data-model.md PageRecord |
| A7 | Pin SDK exactly 2.4.0; closure count documented | accepted | plan.md Technical Context (budget of record: <=5 new lockfile entries) |
| A8 | site-slug derivation unspecified; /page/ singular drift | accepted: canonical derivation rule + `/pages/` fixed | contracts/mcp-surface.md Resources |
| A9 | US-3 test unexecutable under C-002 | accepted: tarball-launch verification, registry snippet textual-only | spec FR-009, US-3 Independent Test |

### researcher-robbie

| # | Finding | Disposition | Evidence |
|---|---|---|---|
| R1 | quickstart leads with unpublished npx form | accepted: tarball-first | quickstart.md |
| R2 | R2's ETag sentence factually wrong for GitHub Pages | accepted: reworded, decision unchanged | research.md R2 note |
| R3 | No latency bound at 1000-page HTTPS case | accepted: NFR-001 gains <= 60 s bound | spec.md NFR-001 |
| R4 | Above-threshold resources unreachable (dead surface) | accepted: `uri` field in tool outputs + resource template | contracts/mcp-surface.md |
| R5 | tsconfig types:["node"] from day one | accepted | plan.md Technical Context |
| R6 | SDK release cadence -> re-pin at tasks (DIRECTIVE_048) | deferred_with_rationale: re-check performed inside tasks phase | plan.md Technical Context note |

### randy-reducer

| # | Finding | Disposition | Evidence |
|---|---|---|---|
| D1 | FR-010 (byte-derived) contradicts FR-007 (rewrite), conformance only tests HTTP mode | accepted: carve-out + two-mode conformance matrix | contracts carve-out; spec FR-010, SC-003 |
| D2 | Relative-at-build alternative fork | deferred_with_rationale: fork recorded for the C-004 ADR; runtime rewrite chosen for v1 (published-shape stability for existing consumers) | research.md R4 |
| D3 | buildId over-promise (index-only IC-01) | accepted (same as A3) | research.md R3 |
| D4 | Fold IC-04+IC-05 into IC-03 (conformance is the server's acceptance suite) | accepted: 6 concerns -> 4 | plan.md IC map |
| D5 | Cut allowedHosts (no confused-deputy surface on stdio) | accepted | contracts CLI; data-model LaunchConfiguration |
| D6 | NFR-002: drop 10k synthetic fixture machinery; measure + extrapolate | accepted | spec NFR-002; plan IC-03 |
| D7 | Pin no-zod-import validation decision (hand-rolled guards) | accepted | plan.md Technical Context; IC-02 risks |
| D8 | mcp package `private: true` until C-002 ruling | accepted | plan.md structure tree note |
| D9 | cli.ts ownerless | accepted: assigned to IC-02 | plan.md structure tree, IC-02 |

### reviewer-renata

| # | Finding | Disposition | Evidence |
|---|---|---|---|
| V1 | SC-002/FR-004 degenerate-pass (zero results = 100%); add recall floor + keyword-only + body-only controls | accepted | spec SC-002 rewritten with all controls |
| V2 | FR-003 sections do not exist in the emitted index | accepted: sections emission from sections.yaml added to IC-01; home-page empty-section tolerance noted | spec FR-003, Edge Cases; plan IC-01(b) |
| V3 | FR-009/SC-001 npx-vs-unpublished contradiction | accepted (same as A9) | spec FR-009, SC-001, US-3 |
| V4 | FR-010 assertion mechanism unpinned (tautology risk) | accepted: mechanism pinned, output-generated goldens banned, freshness anchored in fresh example build, minimum matrix in SC-003 | spec FR-010/SC-003; plan Testing |
| V5 | NFR-003 "documented count" never documented | accepted: <= 5 new lockfile entries + named pack-closure CI audit | spec NFR-003; plan Technical Context |
| V6 | FR-008 contract-vs-research sample-vs-all contradiction | accepted: compare-every-artifact, mixed-buildId fixture mandated | contracts handshake step 3; spec FR-008/SC-004 |
| V7 | Resources unreferenced by any FR while Q-P1 open | accepted: FR-011 added, contingent on Q-P1 | spec FR-011 |
| V8 | SC-004 failure matrix unenumerated; NFR-002 orphan | accepted: matrix enumerated per named error; NFR-002 owned by IC-03 | spec SC-004, NFR-002 |

**Escalated, awaiting operator**: Q-P1 surface mapping (hybrid resources+tools size-gated, recommended) vs tools-only. FR-011 exists only under the hybrid ruling.

## Post-tasks squad (2026-11-01; lenses: planner-priti, implementer-ivan, reviewer-renata)

| # | Finding (lens) | Disposition | Evidence |
|---|---|---|---|
| T-a | fixtures dir write-scope collision; WP02 fixtures moved inside its own scope `mcp/tests/corpus/fixtures/**`, WP05 keeps `mcp/tests/fixtures/**` | changed (from planner's lane-surgery option to the disjoint-path option) | WP02 context block |
| T-b | uri minting behind contingent WP04 while contract requires it | accepted: uris.ts created in WP03; WP04 consumes | WP03 T012 note; WP04 T017 |
| T-c | resources registration seam ownerless | accepted: WP03 ships no-op `registerOptionalSurfaces` stub in surface/optional.ts; WP04 fills it | WP03 T011 seam note; WP04 frontmatter/T017 |
| T-d | T024 CI wiring ownerless | accepted: root script in WP02, lane invocation in WP08, T024 ships only the script | WP02 T006; WP06 T024 |
| T-e | mission quickstart unowned | accepted: moved to WP07 T028 | WP06 T026; WP07 frontmatter |
| T-f | WP05 overload + double critical-path position | accepted: split -> WP05 (T020-T021), WP08 (T022-T023), both dep WP03 only | tasks.md; WP08 file |
| T-g | fully-serial mission framing | changed: parallel markers corrected; WP04/WP05/WP08 fan out after WP03 | tasks.md index + sections |
| T-h | ScenarioRecord 3-way contradiction (flattening; result.status named as "don't invent" while real) | accepted: data-model mirrors emitted envelope exactly; T015 rewritten | data-model.md; WP03 T015 |
| T-i | zod contradiction in WP03 prompt | changed: RESOLVED by verification - root-exported fromJsonSchema + bundled validator; no zod import, no deprecated overload | WP03 squad-context note |
| T-j | shebang gap (tsc preserves, never creates) | accepted: cli.ts shebang mandated; direct-exec assertion in T025 | WP02 T010; WP06 T025 |
| T-k | T001 contract enumeration incomplete (authors, generated_from, optionality) | accepted: authority-diff rule + full enumeration | WP01 T001 |
| T-l | gating detection = missing _links.self; page id derivation unpinned | accepted: both pinned in WP02 T010 + data-model | WP02; data-model.md |
| T-m | seeded-fault mechanism hand-wavy | accepted: dev-only fault flag createServer(..., {faults}) | WP05 T020 |
| T-n | wrong clean-room precedent (pack-extract vs install) | accepted: installFixture machinery, --prefer-offline | WP06 T025 |
| T-o | boundary test could be vacuous over dist graph | accepted: bare-specifier assertion named | WP08 T022 |
| T-p | NFR-004 error class contradicted taxonomy freeze (6 vs 7) | accepted: UNSUPPORTED_CLIENT_REVISION added | data-model.md; WP02 T007 |
| T-q | Q-P1 incoherence: contingent WP04 hard-blocked WP05-WP07 | accepted: WP05/WP08/WP07 depend on WP03-path only | frontmatter deps; WP07 body |
| T-r | DoD enumeration gaps (SC-002 controls, WP04 fs-read, WP05 fake-path DoD refs) | accepted | WP05 T020/DoD; WP04 DoD; WP08 DoD |
| T-s | export-map style drift, bare-string convention; siteTitle path typo | accepted | WP01 T001; data-model.md |
| T-t | fresh-clone fixture minting command missing | accepted: pnpm --filter example build | WP01 T001; WP02 context |
| T-u | latency bound non-discriminating on localhost | accepted: artificial latency injection / concurrency-param assertion | WP08 DoD |

Squad verdicts: AMEND (all three lenses) -> all amendments landed; tasks re-finalized.

## Post-implement outcomes (recorded 2026-11-02, WP07)

Implement-phase adversarial review (reviewer lenses over the lane worktrees;
per-cycle files under `tasks/<WP>/review-cycle-*.md`):

| WP | Cycles | Verdict | What the loop caught |
|---|---|---|---|
| WP01 | 1 | approved 2026-11-01T18:22Z | - |
| WP02 | 1 | approved 2026-11-01T19:21Z | - |
| WP03 | 1 | approved 2026-11-01T19:54Z | - |
| WP04 | 2 | approved 2026-11-01T20:18Z | cycle 1 blocked: `get_site_info.capabilities.resources` still reported `false` after WP04 registered the surface (client-visible lie on the shipped surface); fixed, cycle 2 approved |
| WP05 | 3 | approved 2026-11-01T20:45Z | cycle 1: WP05's own file still carried the pre-split T022/T023 scope (approval mechanically impossible); cycle 2: `golden.test.ts` gated-resources branch compared port-A expectation bytes against port-B response bytes after the WP04 merge (harness defect, root-caused and fixed); cycle 3 approved |
| WP06 | 1 | approved 2026-11-01T23:39Z | closure audit reality: 2 attributable lockfile entries (server + core; zod 4.6.7 dedupes) against the NFR-003 budget of 5 |
| WP08 | 1 | approved 2026-11-01T20:41Z | reviewer replicated the C-003 boundary test's red state live (seeded `node:http` import) and math-checked the NFR-002 extrapolations (134 KB/page -> ~1.31GB naive; 24 KB/page -> ~238MB) |

Corrections landed by WP07 itself (T029 sweep, evidence in the T029 report
below):

- `data-model.md` scenarios top level named `generated_from`; the real emitted
  key is `generated_by` (`generated_from` was removed in 0.4.0, #183) and
  `version` is a string on the wire. Corrected against
  `src/lib/contract.ts` and `src/lib/routes/scenario-index.ts`.
- `quickstart.md`'s local-build section still advertised the unpublished
  `npx -y @spec-kitty/doc-kitty-mcp` form (T-e/R1 residue). Re-synced to
  tarball-first.

### T029 final consistency report (2026-11-02)

- Mission state: WP01-WP06 and WP08 approved; WP07 (this work package) is the
  last open one (`spec-kitty agent tasks status --mission
  doc-kitty-mcp-server-01M6BAQX`).
- ID sweep: every `requirement_refs` entry in the eight WP files exists in
  `spec.md` (FR-001..FR-011, NFR-001..NFR-005, C-001..C-006, SC-001..SC-004);
  no dangling ids, no spec id unreferenced (table below).
- Contract knobs vs implementation reality: `search_pages` cap is
  `SEARCH_MATCH_CAP = 25` in `mcp/src/surface/tools.ts`; the resource listing
  threshold default is 1000 with the `--resource-threshold` override in
  `mcp/src/cli.ts` (gate in `mcp/src/surface/resources.ts`); the SDK is
  exact-pinned at 2.4.0 as the one declared runtime dependency
  (`mcp/package.json`); supported MCP spec revision named in the README:
  2025-11-25 (NFR-004).
- NFR-002 honesty note: recorded in ADR-0073 Consequences. The naive
  10k-page extrapolation of the example corpus (~134 KB/page retained) is
  ~1.31 GB, above the 512 MB anchor; the served-shape reading on the light
  synthetic corpus (~24-26 KB/page) extrapolates to ~238-250 MB, under it. The
  promotion clause (real synthetic 10k fixture when a consumer approaches that
  scale) stands; method and numbers live in `mcp/tests/perf/NOTES.md`.
- Repo-process conformance of this WP: ADR-0073 added as a new file only (no
  `docs/adr/README.md` edit; number picked free against `main` at 0072 plus
  open PRs); one changelog fragment added per the unreleased README format;
  `docs/CHANGELOG.md` untouched.

Requirement coverage (spec id -> work packages carrying it in
`requirement_refs`):

| Spec id | WP(s) |
|---|---|
| FR-001 | WP02, WP08 |
| FR-002 | WP02, WP08 |
| FR-003 | WP01, WP03 |
| FR-004 | WP03 |
| FR-005 | WP02 |
| FR-006 | WP02, WP08 |
| FR-007 | WP02 |
| FR-008 | WP01 |
| FR-009 | WP01 |
| FR-010 | WP05 |
| FR-011 | WP04 |
| NFR-001 | WP02, WP08 |
| NFR-002 | WP08 |
| NFR-003 | WP06 |
| NFR-004 | WP03 |
| NFR-005 | WP02 |
| C-001 | WP03 |
| C-002 | WP06 |
| C-003 | WP08 |
| C-004 | WP07 |
| C-005 | WP06 |
| C-006 | WP01 |
| SC-001 | WP06 |
| SC-002 | WP05 |
| SC-003 | WP05 |
| SC-004 | WP05 |

## Pre-consolidation PR squad (2026-11-02; lenses: reviewer-reducer-architect over the aggregate diff)

Pre-PR rush over `origin/main..HEAD` after the curated-history rebuild.

| # | Finding (lens) | Disposition | Evidence |
|---|---|---|---|
| P-a | boundaries hold: contract.ts import-free, mcp consumes import type only, artifacts additive, pointer default-off, determinism test real, closure audited (architect) | accepted | 6/6 checks; DIRECTIVE_083 held |
| P-b | API shape sound; openapi-optin merge-base argument settled live; UNSUPPORTED_CLIENT_REVISION never thrown pre-fold (correctness lens) | accepted: wired via normalizeHandshakeError + unit test | mcp/src/server.ts; errors.test.ts |
| P-c | package freshness verified once (DIRECTIVE_051): @modelcontextprotocol/server@2.4.0 published 2026-10-23, 9 days before mission start | accepted | npm registry live check |
| P-d | tri-encoded BuildIdEntry projection (3 hand-written shapes, invariant by comment) | accepted: toBuildIdEntries() in shared.ts, routes fixed | src/lib/routes/shared.ts |
| P-e | per-page buildId recompute O(pages x corpus) | accepted: WeakMap memoization keyed on source array identity | memoizedBuildIdForEntries |
| P-f | dead WP04-conditional test scaffolding after Q-P1 hybrid ruling | accepted: conditionals removed, resources assert unconditionally | mcp/tests/conformance/* |
| P-g | quickstart content in 3 places | accepted: README links to guide (single owner), kitty-specs quickstart frozen, guide is living doc | mcp/README.md |
| P-h | three hand-rolled local corpus HTTP servers and EXAMPLE_BAKED_ORIGIN double-defined | accepted: one mcp/tests/helpers/static-corpus-server.ts + compat shims, one origin constant | mcp/tests/helpers/, conformance/ + perf/ updated |
| P-i | LaunchConfiguration composed by hand in 4 places | accepted (deferred_with_rationale: production cli keeps its validating builder; test-side one has 2 distinct causal shapes - forcing one helper would couple transports) | noted in PR body |
| P-j | six exports unused outside own module | accepted: de-exported (6 one-word edits) | mcp/src/surface/tools.ts, uris.ts, corpus/source.ts, snapshot.ts |
| P-k | audit-closure.mjs hand-parses pnpm lockfile | accepted (deviation): zero-runtime-dependency posture is the squad ruling; kept deliberately; documented in code header | mcp/scripts/audit-closure.mjs |
| P-l | llms-txt launch string duplicated in 2 routes | accepted: mcpLaunchUsage() in shared.ts, both call it | src/lib/routes/shared.ts |
| P-m | openapi-optin byte-compare fails on additive contract fields at merge-base | changed: tolerance list documents FR-008 buildId + FR-003 sections as listed additive differences; any other payload regression still fails | tests/consumption/openapi-optin.test.ts |

All folds verified post-change: mcp 178/178 green, toolkit 3263/3263 green, typecheck/lint green.
