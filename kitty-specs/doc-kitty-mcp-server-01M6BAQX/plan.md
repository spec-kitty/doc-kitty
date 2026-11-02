# Implementation Plan: Generic Doc-Kitty MCP Server

**Branch**: `feat/doc-kitty-mcp-server` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/doc-kitty-mcp-server-01M6BAQX/spec.md`

**Branch contract**: planning and implementation commits land on `feat/doc-kitty-mcp-server`; the mission's recorded merge target is `main`, reached via pull request.

## Summary

Ship one generic, runtime-configured MCP server that serves any doc-kitty site's published discovery artifacts (`/api/index.json`, `/api/pages/*.json`, `/api/scenarios.json`) to MCP clients over stdio. Shape A (runtime service) won the pre-spec adversarial squad 4-0; Shape B (per-consumer template factory) is rejected, re-trigger recorded for the ADR (C-004). The corpus is loaded once at start as an immutable snapshot (FR-006), capabilities are negotiated from the index `version` field with fail-closed refusal on an unknown major (FR-005), and every tool output byte-derives from the published artifacts (FR-010) so the pass-through invariant (C-001) is enforced by construction, not convention.

## Technical Context

**Language/Version**: TypeScript (ESM) on Node >= 22.22, inside the existing pnpm workspace; `mcp/` package builds with `tsc` emit (the toolkit ships raw `.ts`; a bin executable driven by npx cannot), tsconfig sets `compilerOptions.types: ["node"]` explicitly.
**Primary Dependencies**: exactly one declared runtime dependency, `@modelcontextprotocol/server` pinned at 2.4.0 (verified 2.4.0, published 2026-10-23; re-check latest at tasks per DIRECTIVE_048). Closure budget of record: at most 5 new lockfile entries total (server + core + zod dedupes against the toolkit's existing zod ^4.6.6), zero install scripts, asserted by a pack-closure CI audit. Validation via hand-rolled presence/shape guards (no schema-library import).
**Storage**: none (in-memory corpus snapshot).
**Testing**: Vitest fast lane (unit over fixture JSON); one serialized build-suite entry in `src/vitest.workspace.ts` BUILD_SUITES (build `example/`, serve `dist`, drive an SDK client over stdio); `tests/consumption/` clean-room pack/install smoke (pattern: `tests/consumption/charter-cleanroom.test.ts`); entry-point boundary test asserting no HTTP listener imports (C-003); assertion mechanism pinned: expectations computed in-test by independently re-reading artifacts (vitest output-generated goldens excluded).
**Target Platform**: developer machines and CI agents on any OS with Node 22+; launched by MCP clients via stdio (npx once publishing is ruled on).
**Project Type**: new pnpm workspace member (`mcp/`, working package name `@spec-kitty/doc-kitty-mcp`) plus minimal additive changes to the toolkit generators (`buildId` FR-008, wiring pointer FR-009).
**Performance Goals**: start-to-ready <= 5 s local / <= 15 s HTTPS on the 68-page example (NFR-001); < 512 MB RSS at a 10k-page synthetic corpus (NFR-002).
**Constraints**: stdio only, no HTTP listener code (C-003); pass-through only (C-001); one toolchain (C-005); type-only coupling to the artifact contract (C-006).
**Scale/Scope**: any single doc-kitty site; resources listed only when pages <= 1000 (Q-P1 default).

## Charter Check

*Checked against `.kittify/charter/charter.md`, 2026-11-01.*

- **Scope** (`charter.md` Scope): hosting a retrieval/embedding index is out - the server hosts no index; pass-through adapter over published artifacts is inside "agent interoperability", one of the four chartered outcomes. PASS with the C-001 fence.
- **Three separated axes**: untouched; the MCP server consumes registry-ordered JSON, nothing hardcodes sections. PASS.
- **Quality and delivery**: new package joins Node 22+/pnpm, Vitest topology respected (no Playwright needed), CI path filters gain the package path. PASS, one CI-lane edit required.
- **Amendment rule**: structural component addition and the Shape A/B decision require an ADR before merge -> C-004 is a hard gate, planned as a work item, not an afterthought. PASS (with tracked obligation).
- **GitHub Pages deploy posture**: no runtime is added to the deployed site. PASS.

No violations; nothing for Complexity Tracking.

## Project Structure

### Documentation (this mission)

```
kitty-specs/doc-kitty-mcp-server-01M6BAQX/
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/mcp-surface.md  # Phase 1 output
└── tasks/               # /spec-kitty.tasks output (phase 2, not yet)
```

### Source Code (repository root)

```
mcp/                                 # NEW workspace member (@spec-kitty/doc-kitty-mcp, private:true until C-002 ruling)
├── package.json                     # ESM, Node>=22.22, bin doc-kitty-mcp, tsc emit to dist/
├── src/
│   ├── cli.ts                       # arg parse + exit codes (owned by IC-02: launch configuration)
│   ├── server.ts                    # MCP server wiring (stdio only; boundary-tested)
│   ├── corpus/
│   │   ├── source.ts                # CorpusSource port
│   │   ├── http-source.ts           # HTTPS adapter
│   │   ├── fs-source.ts             # local dir adapter + base-URL rewrite (FR-007)
│   │   └── snapshot.ts              # load-once, buildId compare-all, version handshake
│   ├── surface/
│   │   ├── tools.ts                 # get_site_info, list_pages, get_page, search_pages, list_scenarios
│   │   └── resources.ts             # docs:// resources + size gate + URI emission
│   └── errors.ts                    # named error taxonomy (NFR-005)
└── tests/                           # vitest unit over committed example fixtures

src/lib/contract.ts                  # NEW: dependency-free exported artifact contract types
                                     # (AgentIndex incl. sections[]/buildId/_links.mcp,
                                     #  AgentPagePayload incl. buildId/keywords, ScenarioIndex);
                                     # exported as @spec-kitty/doc-toolkit/contract, import-type only
src/lib/routes/agent-index.ts        # retyped against contract; + sections[] from sections.yaml;
                                     # + buildId (FR-008); + optional _links.mcp pointer (FR-009)
src/lib/routes/agent-page.ts         # retyped; + buildId stamp
src/lib/routes/scenario-index.ts     # retyped; + buildId stamp
src/lib/routes/llms-txt.ts           # + one-line MCP mention when pointer enabled (FR-009)

pnpm-workspace.yaml                  # + mcp member
.github/filters.yml                  # + mcp/** and tests/consumption/** path groups (ci-ok is fail-closed)
package.json (root)                  # widen test/lint/typecheck filters so the mcp package runs in CI
tests/consumption/mcp-package.test.ts  # pack tarball -> clean room install -> stdio smoke
```

**Structure Decision**: a separate workspace package (not a subtree of `src/`) keeps the toolkit's build-time library free of the runtime dependency; generator changes are additive and config-gated. One package boundary, no new axis.

## Implementation Concern Map

*Folded from six to four concerns by the post-plan squad (reducer lens): conformance is the server's acceptance suite, not a separate concern; packaging is a bin stanza plus one test in the existing clean-room pattern.*

### IC-01 — Toolkit contract additions (types, sections, buildId, pointer)

- **Purpose**: the corpus becomes self-describing enough for a generic server: (a) a dependency-free exported contract-types module (`src/lib/contract.ts`, subpath export `@spec-kitty/doc-toolkit/contract`) exporting `AgentIndex` (incl. new `sections[]`, `buildId`, `_links.mcp`), `AgentPagePayload` (incl. `buildId`, `keywords`), `ScenarioIndex`, with the three generator routes retyped against it so emitted JSON and published type cannot diverge; (b) sections listing emitted from `docs/_meta/sections.yaml` (today's index has no `sections[]`); (c) `buildId` stamped into index + per-page + scenarios artifacts, hashed over a canonical source-input serialization (never over emitted bytes: self-referential and split-brain); (d) opt-in MCP wiring pointer in `_links.mcp` and `llms.txt` (default off; advertises the tarball path until the C-002 ruling).
- **Relevant requirements**: FR-003 (sections), FR-008, FR-009, C-006 enabler
- **Affected surfaces**: `src/lib/contract.ts` (new), `src/lib/routes/agent-index.ts`, `agent-page.ts`, `scenario-index.ts`, `llms-txt.ts`, src package.json exports map, generator config schema, example snapshot expectations.
- **Sequencing/depends-on**: none (server tolerates pre-FR-008 corpora with a warning).
- **Risks**: emitted-contract change ripples into example snapshot tests; contract.ts must stay dependency-free so `import type` never drags Astro virtual modules into the mcp package's `tsc`.

### IC-02 — Corpus source adapters, snapshot loader, launch CLI

- **Purpose**: the two input modes (HTTPS, local fs) behind one port, launch-time snapshot loading, version handshake, compare-every-artifact buildId check, base-URL rewrite for the fs mode (rewritten set: `links`/`source`/`url`/`_links`; default target: the site's declared deploy origin from the index), and the CLI (arg parse, exit codes) as launch configuration.
- **Relevant requirements**: FR-001, FR-002, FR-005, FR-006, FR-007; edge cases.
- **Affected surfaces**: `mcp/src/corpus/`, `mcp/src/cli.ts`.
- **Sequencing/depends-on**: IC-01 for the new fields (graceful without them).
- **Risks**: N+1 fetch performance over HTTPS (mitigate: bounded fetch parallelism >= 8; measured vs NFR-001 incl. the 60s/1000-page bound); home-page empty-slug identity trap (identity from records only); validation is hand-rolled guards (no schema library import - NFR-003).

### IC-03 — MCP server core, conformance proof, packaging

- **Purpose**: the protocol surface (tools always; resources size-gated per FR-011 pending Q-P1), the named error taxonomy, its own acceptance suite: FR-010 two-mode golden byte-derivation against a freshly built `example/dist` (expectations computed in-test by independently re-reading artifacts; output-generated goldens excluded; minimum matrix per SC-003), the entry-point no-HTTP boundary test, bin entry, `pnpm pack` tarball, clean-room install + stdio smoke, pack-closure audit (NFR-003), NFR-002 measure-and-extrapolate note, README naming the supported spec revision (NFR-004).
- **Relevant requirements**: FR-003, FR-004, FR-010, FR-011; NFR-002/003/004/005; C-001, C-002, C-003; SC-001..SC-004.
- **Affected surfaces**: `mcp/` (all), `src/vitest.workspace.ts` (BUILD_SUITES entry), `tests/consumption/mcp-package.test.ts`, `.github/filters.yml`, root `package.json` scripts, `mcp/README.md`.
- **Sequencing/depends-on**: IC-02.
- **Risks**: SDK semantics drift across spec revisions (pin + in-process client assertions); substring matching must include the recall-floor and field-discriminating controls (SC-002); CI serialized-lane budget.

### IC-04 — Governance artifacts

- **Purpose**: the ADR (Shape A vs B + re-trigger; pass-through invariant; the relative-at-build fork from R4; the Q-P1 resource decision) and the changelog fragment; docs updates (`generators.md` fifth-surface paragraph, quickstart guide page).
- **Relevant requirements**: C-004; repo process (changelog fragment, ADR index hands-off).
- **Affected surfaces**: `docs/adr/<next>-*.md`, `docs/changelog/unreleased/<issue>-*.md`, `docs/architecture/generators.md`, `docs/guides/`.
- **Sequencing/depends-on**: IC-01..IC-03 (ADR records final shapes).
- **Risks**: ADR number race with open PRs (rule: pick against main + open PRs at writing time).

## Risks (plan-level)

- **Q-P1 override**: if the operator rules tools-only, IC-03 shrinks by the resources module and the conformance plan simplifies; no other change.
- **SDK v2 transition window**: hosts pinned to the 2025-11-25 spec revision may negotiate down imperfectly; documented, deliberately unmeasured in this mission (spec Assumptions).
- **CI serialized-lane budget**: the build-suite addition must stay inside the existing budget; the consumption test stays within its <= 8-minute pattern.
