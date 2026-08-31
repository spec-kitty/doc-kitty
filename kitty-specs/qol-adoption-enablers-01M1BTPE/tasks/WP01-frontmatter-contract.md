---
work_package_id: WP01
title: 'Frontmatter contract: optional, derived, overridable (#38 + #40 mechanism + #41 guard)'
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-011
- NFR-001
- NFR-002
- NFR-003
- NFR-004
planning_base_branch: feat/qol-adoption-enablers
merge_target_branch: feat/qol-adoption-enablers
branch_strategy: Planning artifacts for this mission were generated on feat/qol-adoption-enablers. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/qol-adoption-enablers unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/
create_intent:
- _meta/vocabulary.yaml
- src/tests/vocabulary-resolver.test.ts
- docs/adr/0031-vocabulary-override.md
execution_mode: code_change
owned_files:
- src/scripts/validate-frontmatter.mjs
- src/lib/metadata.ts
- src/lib/schema.ts
- src/lib/sections.ts
- _meta/vocabulary.yaml
- src/tests/schema-validator-parity.test.ts
- src/tests/section-type-parity.test.ts
- src/tests/metadata-sections.test.ts
- src/tests/type-registry-authority.test.ts
- src/tests/vocabulary-resolver.test.ts
- docs/adr/0004-amend-common-docs-as-extensible-variation.md
- docs/adr/0009-*.md
- docs/adr/0031-vocabulary-override.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`). State which you applied. You are a Node/TypeScript implementer working under ATDD/TDD discipline (DIRECTIVE_034/041): write the failing test first, then the smallest code that passes.

## Objective

Make the doc-kitty `type`/`kind` frontmatter contract **optional, section-derived, and vocabulary-overridable** — on BOTH the bare-Node gate (`src/scripts/validate-frontmatter.mjs`) and the Astro-side twin (`src/lib/metadata.ts` / `src/lib/schema.ts`) — and pin era-tolerant ADR typing. This is the foundational spine; WP02/WP03/WP04 depend on it. Read `../spec.md` (FR-001..005, FR-011, NFR-001..004), `../plan.md` (IC-01, IC-02), `../research.md` (Decisions 1–4, 7), `../contracts/vocabulary-override.md`, `../data-model.md`, and `../decisions/post-spec-squad.md`.

## Critical context (brownfield, squad-verified)

- The zod schema (`src/lib/schema.ts:139,142`) is **already** `type`/`kind` optional. The strictness is entirely in the standalone gate: `validate-frontmatter.mjs:277-278` (missing-type problem) and `:100` (`kind: z.string().min(1)`).
- Type derivation is **not total**: `expectedType`/`expectedDocType` (`metadata.ts:223-243`, mjs twin `:215-229`) returns `null` for root/orphan/unregistered sections. For `kind` there is **no** derivation.
- The gate returns a **structured** `{problems, warnings}`. Authored-vs-derived mismatch is a `warnings` entry (`:283-286`) today (advisory). Keep it advisory; assert on the structured `warnings[]`.
- `Feature` STAYS a valid default type. The `plans/features/* → Feature` subtype is hardcoded (`metadata.ts:236`, mjs twin) — **do NOT change it** (that's the reviewer/planner MAJOR; blanket re-type is out of scope).
- The gate parses `_meta/*.yaml` via `gray-matter` (`:174-200`) — reuse it for `vocabulary.yaml`; **no new dependency**.
- mjs and ts are hand-mirrored twins pinned by `section-type-parity.test.ts` + `schema-validator-parity.test.ts`. Every change here must land on both and keep parity green.

## Subtasks

### T001 — Retarget + add fixtures (test-first)
- The `err/missing-kind.md` fixture lives in the `PRESENCE_LENIENT[]` array (~`:90-99`) iterated by one loop asserting rejection. **Retarget, do NOT delete** (NFR-001): MOVE it into the accept path (e.g. `SHAPE_PARITY` with `reject: false`, per the existing pattern) so there is an **explicit positive assertion** that the gate now ACCEPTS missing-kind (`validatorRejects===false` AND `buildRejects===false`). Removing the array element to make the loop green is deletion-to-pass and is forbidden — the retarget must leave a clearly-labelled accept case that reds if `kind` ever becomes required again.
- Add fixtures/cases: (a) a doc under a registered section with NO `type` and NO `kind` → passes, effective `type` == section-derived; (b) a doc authoring a `type` that conflicts with the derived type → `problems == []` AND `warnings[]` contains the specific mismatch entry (assert on the return value, never console text — FR-003); **(c) an orphan/root doc with NO `type` where derivation yields `null` → the deterministic "untyped" outcome (`problems == []` with the explicit untyped marker, no crash, no garbage type) — US1 AS-3, currently pinned by nothing.**
- Run: these fail now (red).

### T002 — Relax the gate (make it green)
- This is a **branch restructure** of `validate()` (`:271-293`), not a one-liner: today derivation runs only inside the canonical-authored `else` branch. Rewrite so it computes a single `effective = ('type' in data) ? data.type : expectedType(...)`, THEN resolves (T005), THEN warns/forbids — the contract order derive-if-absent → resolve → validate.
- Make `type` optional; absent → derive (fill ONLY the absent case). When derivation yields `null` (root/orphan), accept as "untyped" deterministically (the T001(c) fixture pins this; document the choice in T006's ADR). Make `kind` optional (`:100`). Authored `type` always wins; a mismatch stays an advisory `warnings[]` entry.
- `src/lib/schema.ts` is already optional (confirm no regression). Do NOT add authored-vs-derived enforcement to the ts side — it has none today (see T005 scope note).
- Green T001.

### T003 — #41 depth-tolerance guard (test-first, both twins)
- Add a regression test (in `section-type-parity.test.ts` and/or `metadata-sections.test.ts`) asserting on BOTH the ts (`metadata.ts`) and mjs (`validate-frontmatter.mjs`) derivations: `adr/3.x/0001-foo.md` → `ADR`; `adr/3.x/template.md` → `Template` (basename-keyed). This is guard-ONLY: do NOT change the mapping; do NOT broaden to an `adr/**` glob (C-003).

### T004 — Vocabulary fixtures (test-first)
- Add `src/tests/vocabulary-resolver.test.ts`. **The fixture `vocabulary.yaml` MUST diverge from the shipped default** (at least one alias `Feature→Mission` AND one `forbidden` entry) — otherwise "resolved" and "static default" produce identical output and the parity test passes vacuously (NFR-004 would be fakeable).
- Cases: (a) alias `Feature→Mission`, authored `type: Feature` → effective `Mission`; (b) forbidden `Feature`, authored `Feature` → failure naming the replacement; (c) alias `Feature→Mission`, a `plans/features/` doc with NO `type` → derived `Feature` resolves to `Mission`, no warning (the derived-path case, FR-004); (d) no `vocabulary.yaml` → default vocab, `Feature` valid; (e) parity: for the SAME non-default YAML, assert `mjs.resolveType('Feature') === ts.resolveType('Feature') === 'Mission'` (RESOLVED output on both twins — NFR-004, not static arrays).

### T005 — Vocabulary resolver + wiring (make green)
- **SCOPE (post-tasks feasibility — read carefully).** The ONLY runtime authored-vs-derived enforcement surface is the mjs `validate()` (`:277-293`). `metadata.ts` is deliberately **fs-free** (`:211` "Never imports `./sections.ts`") and `schema.ts` has **no** authored-vs-derived `superRefine` and no runtime callers for its advisory `expectedTypeForPath*` utilities. So:
  - Add `loadVocabulary(docsRoot)` to `src/lib/sections.ts` beside `loadSectionRegistry` (API in `../contracts/vocabulary-override.md`): reads `<docsRoot>/_meta/vocabulary.yaml` via `gray-matter`, `default → consumer`, exposes `resolveType`/`resolveKind` (alias-then-forbid). This is a **standalone unit** pinned by the T004(e) parity test.
  - Add a **hand-mirrored twin** in `validate-frontmatter.mjs` and apply `resolve*` there — to BOTH the authored value and the derived `effective` value — inside `validate()` (the single wiring point). Order: derive-if-absent → resolve (alias then forbid) → validate.
  - **Do NOT thread `loadVocabulary` through `expectedDocType`/`metadata.ts`** — that would break its fs-free boundary and ripple through every call site + both parity tests for no behavioral gain (the ts side does not enforce). "Both twins" here means: the sections.ts resolver unit and the mjs gate resolver agree (T004e), NOT that vocab is injected into the ts derivation.
- Create a default `_meta/vocabulary.yaml` (shipped defaults; `Feature` valid). Absent-file → defaults; malformed → clear error.
- **Mid-WP checkpoint**: before T006/T007, self-review the resolver + T004(e) parity slice (the subtlest, most-fakeable piece) — confirm the fixture is non-default and both twins are asserted on resolved output.
- Green T004.

### T006 — Decision records
- Amend `docs/adr/0004-*.md` (OKF/non-empty-type → optional + registry-derived; record the absent-derivation behavior chosen in T002) and `docs/adr/0009-*.md` (frontmatter contract: `type`/`kind` optional). Add `docs/adr/0031-vocabulary-override.md` (new; status accepted): the `_meta/vocabulary.yaml` seam, default→consumer, authored+derived, mjs/ts twin, why-not-theme-merge. Keep ADR frontmatter shape consistent with siblings (title/doc_status/updated/type: ADR/kind). (The ADR index is regenerated by WP03 — do not hand-edit `docs/adr/README.md` here.)

### T007 — Full sweep
- `pnpm --filter @commondocs-kitty/toolkit test` (all parity + fixtures green), `node src/scripts/validate-frontmatter.mjs docs` (corpus green, no new warnings), `pnpm --filter @commondocs-kitty/toolkit typecheck` if present. Confirm NFR-001 (no test deleted/weakened), NFR-002 (corpus unchanged passes), NFR-003 (bare-Node), NFR-004 (resolved-vocab parity).

## Branch strategy
Planning/base branch: `feat/qol-adoption-enablers`. Final merge target: `feat/qol-adoption-enablers` (mission), PR to `main` later. Execution worktree/lane is allocated by `finalize-tasks` (`lanes.json`) — enter the workspace the implement command prints; do not create branches by hand.

## Definition of Done
- FR-001/002/003/004/005/011 satisfied; SC-001/002/006 fixtures pass.
- NFR-001..004 hold; the `missing-kind` fixture is retargeted (not deleted); parity asserts RESOLVED vocab.
- mjs and ts twins agree; `Feature` remains valid; the `plans/features→Feature` subtype is unchanged.
- ADR-0004/0009 amended, ADR-0031 added; `docs/adr/README.md` NOT hand-edited (WP03 regenerates it).
- All existing gates green.

## Reviewer guidance
Verify: the warning is asserted via structured `warnings[]` (not console); the override reaches DERIVED values (T004c); parity compares resolved output (T004e); no test was deleted to pass (T001 retarget); the ADR mapping was not broadened (C-003); `Feature` is still valid. Confirm the absent-derivation (root/orphan) behavior is deterministic and documented in ADR-0004.
