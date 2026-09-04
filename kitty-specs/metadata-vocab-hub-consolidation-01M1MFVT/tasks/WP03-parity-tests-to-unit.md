---
work_package_id: WP03
title: 'Retarget parity tests to the single core (keep coverage, keep genuine two-arm guards) (#49 IC-03)'
dependencies:
- WP02
requirement_refs:
- NFR-001
- NFR-003
planning_base_branch: feat/metadata-vocab-hub-consolidation
merge_target_branch: feat/metadata-vocab-hub-consolidation
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-vocab-hub-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-vocab-hub-consolidation unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
history:
- created by /spec-kitty.tasks
- amended by post-tasks adversarial squad (F1, F2, F3, F4 — premise corrected)
agent_profile: node-norris
role: implementer
agent: claude
authoritative_surface: src/tests/
execution_mode: code_change
owned_files:
- src/tests/vocabulary-resolver.test.ts
- src/tests/section-type-parity.test.ts
- src/tests/schema-validator-parity.test.ts
create_intent: []
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. **Guiding rule: PRESERVE COVERAGE.** These tests move from "two implementations agree" to "the one implementation is correct" — but only where the second implementation actually went away. Do NOT weaken or delete assertions to make tests pass.

## Objective

After WP02 there is a single vocabulary/type-derivation implementation, so the twin-comparisons that compared metadata.ts-vs-gate go tautological. Retarget them to pin the single core's behavior **with literal oracles** — and KEEP the two guards that are still genuinely two-armed. Read `../research.md` (D1 done-bar; **D4 findings F1–F4**, which correct the naive "collapse everything" plan) and WP01's `vocabulary-core.test.ts` (avoid duplicating; these three keep their distinctive assertions). **Depends on WP02.**

> **Premise correction (squad F1):** WP02 single-sources only the enums / `SECTION_TYPE` / `expectedType` / resolver / index-basename. It does **NOT** merge the two zod **field-shape** objects — `docKittyFields` (schema.ts) and the gate's `frontmatterSchema` stay independent. So `schema-validator-parity` is **still a genuine two-arm guard** and must NOT be collapsed.

## Critical context (file:line)

- `vocabulary-resolver.test.ts`: the `NFR-004 mjs-vs-ts twins` block (`:227-258`, non-default `ALIAS_YAML` `:45-50`) becomes tautological → retarget to the ONE resolver, keeping `effective`/forbidden/kind assertions. **BUT** also KEEP the gate-wiring assertions US2-1 (`:153-169`, authored forbidden→aliased term fails naming the replacement) and US2-3 (`:190-207`, a `plans/features` page with NO `type` resolves to the overridden type through `validate()`): these prove `validate()` APPLIES the resolver to DERIVED values (FR-004/FR-005) — single-sourcing the resolver does NOT structurally guarantee the gate still calls it, so these are not redundant (F4).
- `section-type-parity.test.ts`: the `SECTION_TYPE toEqual` (`:38-40`) and "both derivations agree" (`:109-113`) ARE now structurally guaranteed → those specific compares may drop. **Everything else must gain literal oracles** (F2): the 19-row path CORPUS (`:67-77`) asserts only `A===B` today with **no per-row literal** — add an explicit expected type to every row; the era-partitioned depth cases (`:87-114`, #41/FR-011); the DOC_TYPES-coupling guard (`:124-131`); and the index-basename/collision/registry-subtypes parity blocks (`:138-196`) — several of these compared metadata.ts helpers to gate helpers and are non-tautological ONLY if rewritten with literal expectations.
- `schema-validator-parity.test.ts` (F1): **KEEP two-arm.** `docKittyFields` (schema.ts) and `frontmatterSchema` (gate) remain independently hand-maintained field shapes; the PRESENCE_LENIENT block (`:98-119`, build-lenient vs gate-strict) is an INTENTIONAL divergence that cannot be a single-impl test. Only the enum-derived rows (`bad-doc-status`, and a NEW `durable`-accepts row) are now single-sourced. Change nothing structural here except adding the `durable`-accepts case.

## Subtasks

### T013 — Retarget `vocabulary-resolver.test.ts`
Replace the twin-parity block with single-resolver assertions over the non-default alias YAML (keep `effective`/forbidden/kind). **KEEP US2-1 and US2-3** gate-wiring assertions (validate() applies override to derived values). Remove only the second-implementation import, not the wiring checks.

### T014 — Retarget `section-type-parity.test.ts` with literal oracles
Add an explicit expected value to every CORPUS row and every era-depth case. Retain (as single-impl, literal-asserted): DOC_TYPES-coupling, index-basename root/collision behavior, registry-subtypes rule firing vs built-in fall-through. Drop only the now-structural `SECTION_TYPE toEqual` / "derivations agree" compares. If this overlaps WP01's `vocabulary-core.test.ts`, keep the richer corpus in ONE place and reference it — do not double-maintain or drop.

### T015 — `schema-validator-parity.test.ts`: keep two-arm, add `durable` (F1)
Do NOT collapse. Keep both arms and the PRESENCE_LENIENT divergence intact. Add a `durable`-accepts fixture row (accepted by both the gate and the build schema). That is the only change.

### T016 — Confirm no coverage lost + full green
Diff old vs new assertions across all three files: every distinctive property (alias resolution, forbidden verdict, kind axis, full path corpus with literals, era cases, DOC_TYPES coupling, index-basename/collision, registry-subtypes, the two-arm field-shape divergence, accept/reject fixtures, `durable`) still exists. Full vitest green (or CI-verified with a note).

## Definition of Done
- `vocabulary-resolver` + `section-type-parity` retargeted to the single core **with literal oracles**; gate-wiring (validate-applies-to-derived) assertions preserved.
- `schema-validator-parity` remains a genuine two-arm guard; only a `durable`-accepts row added.
- No assertion silently dropped except the two provably-structural `section-type-parity` compares; a written note in the PR/DoD lists exactly what was dropped and why it is now structural.
- Full vitest green (or CI-verified).
- `spec-kitty agent tasks mark-status T013 T014 T015 T016 --status done`.

## Risks / reviewer guidance
- Reviewer: this is the highest coverage-loss-risk WP. Compare new assertions against the deleted parity blocks line-by-line; a literal-less `A===A` retarget is deletion-in-disguise.
- Reviewer: verify `schema-validator-parity` was NOT collapsed (F1) and the resolver-wiring US2-1/US2-3 assertions survive (F4).
- Keep the three suites separate (resolver / section-type / schema-validator) for locality.
