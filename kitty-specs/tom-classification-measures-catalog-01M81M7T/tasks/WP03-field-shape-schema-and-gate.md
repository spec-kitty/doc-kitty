---
work_package_id: WP03
title: tom_classification field shape in the build schema and the frontmatter gate
dependencies: []
requirement_refs:
- FR-002
- FR-014
- C-001
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
- T012
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/schema.ts
create_intent:
- src/tests/tom-classification-shape.test.ts
- src/tests/fixtures/valid/tom-classification.md
- src/tests/fixtures/err/tom-classification-bad-scope.md
- src/tests/fixtures/err/tom-classification-no-measure.md
- src/tests/fixtures/err/tom-classification-not-list.md
- src/tests/fixtures/warn/tom-classification-case-variant.md
execution_mode: code_change
owned_files:
- src/lib/schema.ts
- src/lib/metadata.ts
- src/scripts/validate-frontmatter.mjs
- src/tests/schema-validator-parity.test.ts
- src/tests/tom-classification-shape.test.ts
- src/tests/fixtures/valid/tom-classification.md
- src/tests/fixtures/err/tom-classification-*.md
- src/tests/fixtures/warn/tom-classification-case-variant.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 - tom_classification field shape

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Declare the optional `tom_classification` field with one identical shape in the build schema (`docKittyFields`) and in the standalone gate (`frontmatterSchema`). Add its TypeScript types, and make the gate warn on a case variant of the key. Id resolution is **not** here: WP02 owns it, and WP04–WP06 call it.

Requirements: FR-002, FR-014, C-001. Depends on: none.

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP03 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- `src/lib/schema.ts` `docKittyFields`: see how `related` and `external_references` are declared (`z.union` of string and object). The build schema drops undeclared keys, which is why the field must be declared here or every route sees `undefined`.
- `src/scripts/validate-frontmatter.mjs` `frontmatterSchema`: the gate twin, built with the same Zod primitives. `.passthrough()` keeps unknown keys, so the case-variant check can read them from `data`.
- `src/tests/schema-validator-parity.test.ts` runs both arms over fixtures in `src/tests/fixtures/{valid,err,warn}`. Read how it lists fixtures, which may be an explicit list or a directory walk, and add the new ones the same way.
- `src/lib/metadata.ts` `DocKittyFrontmatter` (around line 120–156) is the TS shape routes read.
- Contract: `kitty-specs/.../contracts/frontmatter-and-catalog.md`.

## Subtasks

### T009: Types in `src/lib/metadata.ts`

- Add `export type TomScope = 'system' | 'organisation';` and `export type TomClassificationRef = string | { measure: string; scope?: TomScope; note?: string };`.
- Add `tom_classification?: TomClassificationRef[];` to `DocKittyFrontmatter`, next to `related` and `external_references`, with a one-line comment citing ADR-0080.
- Nothing else in this file. WP06 adds the payload type in `src/lib/contract.ts`, not here.

### T010: Build schema field

In `docKittyFields` add:

```ts
// TOM classification (ADR-0080): a bare measure id or { measure, scope?, note? }.
// Ids are resolved against the measures catalog by the content-graph and agent-page
// routes (build-fatal on a miss); this only shapes the entries.
tom_classification: z
  .array(
    z.union([
      z.string().min(1),
      z.object({
        measure: z.string().min(1),
        scope: z.enum(['system', 'organisation']).optional(),
        note: z.string().optional(),
      }),
    ]),
  )
  .optional(),
```

Use `.strict()` on the object only if the parity fixtures show `related`'s object arm does the same. Match the existing posture. Import the scope tuple from `measures-core.mjs` **only if** WP02 has landed in your lane base; otherwise inline the literal tuple. The literals are the contract, so inlining is fine.

### T011: Gate field and case-variant warning

1. Add the identical shape to `frontmatterSchema` in `validate-frontmatter.mjs` (zod, not astro/zod).
2. In `validate()`, after the schema parse, warn on any key that is not exactly `tom_classification` but equals it case-insensitively (for example `TOM_classification` or `Tom_Classification`). Use the contract wording: ``unknown key `<key>`: did you mean `tom_classification`?``. It is a warning, never a problem (FR-014, C-001).

### T012: Fixtures and tests (write first)

- `src/tests/fixtures/valid/tom-classification.md`: a complete valid page whose field mixes a bare id and an object with scope `organisation` and a note.
- `src/tests/fixtures/err/tom-classification-bad-scope.md` (`scope: global`), `err/tom-classification-no-measure.md` (`- note: x`), `err/tom-classification-not-list.md` (`tom_classification: events-logging`).
- `src/tests/fixtures/warn/tom-classification-case-variant.md` uses `TOM_classification: [events-logging]`.
- Register them in `schema-validator-parity.test.ts` so the valid one passes both arms and each err fixture fails both arms.
- `src/tests/tom-classification-shape.test.ts`:
  - the gate `validate()` gives zero problems and zero warnings on the valid fixture;
  - one problem naming `tom_classification` on each err fixture;
  - exactly one warning containing `did you mean \`tom_classification\`` on the case-variant fixture, and zero problems from it;
  - `z.object(docKittyFields).safeParse` drops `TOM_classification` and keeps `tom_classification`.

Make sure no existing fixture or real docs page starts warning: run `pnpm validate:docs` and `pnpm validate:example`.

## Definition of done

- Parity and shape tests green (red first). `pnpm lint`, the toolkit typecheck and `pnpm validate:docs` / `validate:example` are clean.
- No suppressions.

## Risks

- Parallel runner (#330 pack reader) may touch `schema.ts`. Keep the hunk additive and isolated next to `external_references`.

## Reviewer guidance

- Both schema arms are byte-for-byte the same shape; the warning is a warning.
