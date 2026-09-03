---
work_package_id: WP03
title: Collapse parity tests to single-impl unit tests (#49 IC-03)
dependencies:
- WP02
requirement_refs:
- NFR-001
- NFR-003
planning_base_branch: feat/metadata-vocab-hub-consolidation
merge_target_branch: feat/metadata-vocab-hub-consolidation
branch_strategy: Planning artifacts were generated on feat/metadata-vocab-hub-consolidation. Branch from the WP02 result during /spec-kitty.implement; completed changes merge back into feat/metadata-vocab-hub-consolidation unless the human redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/
create_intent: []
execution_mode: code_change
owned_files:
- src/tests/vocabulary-resolver.test.ts
- src/tests/section-type-parity.test.ts
- src/tests/schema-validator-parity.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Guiding rule: **preserve coverage** — these tests move from "two implementations agree" to "the one implementation is correct". Do not weaken assertions to make them pass.

## Objective

After WP02 there is a single vocabulary/type-derivation implementation, so the three twin-parity guards no longer have a second side to compare. Rewrite each as an ordinary unit test that pins the single core's behavior — keeping the resolved-output, path-corpus, and shape assertions. Read `../research.md` (D1 done-bar, C-003: "rewritten as ordinary unit tests, not deleted") and WP01's `vocabulary-core.test.ts` (avoid duplicating what it already covers; these three retain their own distinctive assertions). **Depends on WP02.**

## Critical context (file:line)

- `src/tests/vocabulary-resolver.test.ts` — today imports `loadVocabulary` from both `../lib/sections.js` (`:5`) and `../scripts/validate-frontmatter.mjs` (`:6-10`); the `NFR-004 — mjs and ts twins resolve the SAME YAML identically` block (`:227-258`) writes a temp `_meta/vocabulary.yaml` (non-default `ALIAS_YAML`, `:45-50`) and asserts both sides agree on `effective`, forbidden verdict, and kind axis. **Rewrite**: load the ONE resolver (via the core/loader) and assert the SAME resolved outputs on the SAME non-default YAML — keep the alias/forbidden/kind assertions; drop the second import.
- `src/tests/section-type-parity.test.ts` — imports `SECTION_TYPE`/`expectedDocType` from `metadata.ts` and `SECTION_TYPE`/`expectedType` from the gate (`:21-36`), asserts the two frozen maps `toEqual` (`:38-40`) and runs a shared path CORPUS (`:44+`). **Rewrite**: assert the single `SECTION_TYPE` + run the same corpus through the single `expectedDocType`; drop the twin comparison.
- `src/tests/schema-validator-parity.test.ts` — binds gate `validate()` (arm A) to `z.object(docKittyFields)` from `schema.ts` (arm B). **Rewrite**: since both arms now derive from the same core shape, assert the single validation behavior over the accept/reject fixture set; keep the fixtures.

## Subtasks

### T013 — Rewrite `vocabulary-resolver.test.ts`
Single-resolver unit test over the non-default alias YAML; retain `effective`/forbidden/kind-axis assertions. Remove the `validate-frontmatter.mjs` twin import.

### T014 — Rewrite `section-type-parity.test.ts`
Single `SECTION_TYPE` + `expectedDocType` corpus test (adr/plans/operations/unknown→null). Remove the twin map compare. (If it now overlaps `vocabulary-core.test.ts`, keep the richer corpus here and trim the duplicate in the core test, or rename this file's `describe` to reflect it's the corpus suite — coordinate so coverage is retained, not doubled or dropped.)

### T015 — Rewrite `schema-validator-parity.test.ts`
Single-shape validation unit test over the existing accept/reject fixtures; add a `durable`-accepts case (ties to #39). Remove the dual-arm comparison.

### T016 — Confirm no coverage lost + full green
Diff old vs new assertions; every distinctive check (alias resolution, forbidden verdict, kind axis, path corpus, accept/reject fixtures) still exists somewhere. Run the full vitest suite green (or CI-verify with a note if local `node_modules` is broken).

## Definition of Done
- The three test files no longer import a second implementation; each pins the single core.
- Every pre-existing assertion is preserved (retargeted, not deleted); a `durable`-accepts case added.
- Full vitest suite green (or CI-verified).
- `spec-kitty agent tasks mark-status T013 T014 T015 T016 --status done`.

## Risks / reviewer guidance
- Reviewer: confirm this is coverage-preserving — compare the new assertions against the deleted parity blocks line-by-line. Deleting an assertion because "there's only one impl now" is only valid when the property is structurally guaranteed; the resolved-output/corpus/fixture properties are NOT structural and must stay.
- Do not fold all three into one file — keep the three distinct suites (resolver, section-type, schema/validator) for locality.
