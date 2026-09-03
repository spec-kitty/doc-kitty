---
work_package_id: WP01
title: Flexible section identity (basename + subtypes)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- NFR-001
- NFR-003
- NFR-004
planning_base_branch: feat/adopter-loader-migration
merge_target_branch: feat/adopter-loader-migration
branch_strategy: Planning artifacts for this mission were generated on feat/adopter-loader-migration. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/adopter-loader-migration unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
- T008
history:
- '2026-09-03: authored by /spec-kitty.tasks'
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/tests/index-basename.test.ts
- src/tests/section-rename.test.ts
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/lib/metadata.ts
- src/lib/sections.ts
- src/lib/schema.ts
- src/lib/config.ts
- src/lib/routes/shared.ts
- src/lib/routes/llms-txt.ts
- src/lib/deck/deck-slug.ts
- src/scripts/validate-frontmatter.mjs
- src/scripts/check-links.mjs
- src/scripts/scaffold.mjs
- src/scripts/new-doc.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/section-type-parity.test.ts
- src/tests/schema-validator-parity.test.ts
- src/tests/index-basename.test.ts
- src/tests/section-rename.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile:

- Run `/ad-hoc-profile-load node-norris` (role: implementer) and adopt its identity, boundaries, and governance scope.
- Then load action-scoped doctrine: `spec-kitty charter context --action implement --json`.
- Only then read this prompt and begin.

## Objective

Make doc-kitty's **section identity** flexible without breaking today's corpus:

1. The section-index **basename is configurable** — accept `index.md` as well as `README.md` (case-insensitive), default `README`, threaded through **every** index-detecting surface.
2. A **section-folder rename** (top-level id *and* sub-path subtype) follows the folder through a new registry **`subtypes`** field — a data edit, not a per-rename code edit.

Both derivation paths are hand-mirrored in the TS lib (`src/lib/metadata.ts`) and the bare-Node validator (`src/scripts/validate-frontmatter.mjs`); they MUST stay parity-identical (gated). The full mjs↔ts consolidation (#49) is **out** — you add guarded twins, not a single source.

This is ATDD: the failing tests land first (T001), then the implementation makes them green.

## Context

- Spec: `kitty-specs/adopter-loader-migration-01M1KKYA/spec.md` (US1, US2; FR-001..007; NFR-001/003/004).
- Design: `research.md` (D-01..D-03, D-06), `data-model.md` (E-01, E-02, E-05, E-06), `contracts/index-basename-and-subtypes.md`.
- **Grounded seam map** (verify line numbers on current main — they drift):
  - `src/lib/metadata.ts` — `readmeToIndexId` (~374, `withoutExt.replace(/(^|\/)README$/i, '$1')`); `SECTION_TYPE` frozen map (~188); `expectedDocType` sub-path switch (~231-242, `case 'plans': if (parts[1]==='features') return 'Feature'`); `ROOT_ENTRY_ID = 'index'` (~385).
  - `src/lib/sections.ts` — `sectionTypes(registry)` (~199); deferred `subtypes` seam note (~585); `registryToSidebar` (~527-576); ADR-0029 coupling doc (~420-446).
  - `src/lib/schema.ts` — loader `generateId: ({entry}) => readmeToIndexId(entry) || ROOT_ENTRY_ID` (~261); sections.yaml zod.
  - `src/lib/config.ts` — `draftRoutes` reuses `readmeToIndexId` (~207).
  - `src/lib/routes/shared.ts` (~72), `src/lib/routes/llms-txt.ts` (~60-72), `src/lib/deck/deck-slug.ts` (~26) reuse README-as-index shape.
  - `src/scripts/validate-frontmatter.mjs` — `isRootReadme = relPath === 'README.md'` (~340), root exemption (~384-388), `expectedType` twin (~224-233). **No `readmeToIndexId` helper exists here — you create the twin.**
  - Literals: `scaffold.mjs` (~169,175), `new-doc.mjs` (~89), `assert-build-artifacts.mjs` (~142 `'example/docs/adr/README.md'`), `check-links.mjs` (~86 `existsSync(join(candidate,'README.md'))`).
  - Parity tests: `src/tests/section-type-parity.test.ts`, `src/tests/schema-validator-parity.test.ts`.

### Subtask T001 — Red-first tests

Write **failing** tests first (they define done):

- `src/tests/index-basename.test.ts`:
  - `index.md` in a section folder → id collapses to the section slug (`guides/index.md` → `guides`, not `guides/index`) when `indexBasename` includes `index`.
  - `README.md` behaviour unchanged with the default; a stray `index.md` stays an ordinary page under the default (NFR-003).
  - case-insensitivity (`Index.md`, `readme.md`).
  - both-file collision → configured basename wins + a warning is surfaced.
  - **per-surface (FR-003 — anti-laziness M1, do NOT skip):** a focused, ideally table-driven test asserting EACH index-detecting surface recognises `index.md`: the content-loader id/route slug, `routes/llms-txt.ts` description detection, `deck/deck-slug.ts`, the `.mjs` validator root-index exemption, `check-links.mjs` directory-link resolution, and the `scaffold.mjs`/`new-doc.mjs` target. A missed literal must red here, not survive to review.
  - **array form:** `indexBasename: ['README','index']` collapses both in one run (M2).
- `src/tests/section-rename.test.ts`:
  - a registry section with a `subtypes` entry (`match: missions → Mission`) derives `Mission` for `plans/missions/x.md`.
  - absent `subtypes` → built-in table still applies (backward-compat).
  - unknown section id → documented default + warning.

Run them; confirm they FAIL for the right reason. Commit red (or keep red within the WP per the repo's red-first discipline).

### Subtask T002 — Configurable basename (TS surfaces)

- Broaden `readmeToIndexId` to match `/(^|\/)(README|index)$/i`; add an `indexBasename` option typed **`string | string[]`** (default `README`) so only the configured basename(s) collapse (see `data-model.md` E-01, `contracts/index-basename-and-subtypes.md` C-IB). Keep `ROOT_ENTRY_ID` handling.
- Thread the option through `schema.ts` (`generateId`), `config.ts` (`draftRoutes`), `routes/shared.ts`, `routes/llms-txt.ts` (description detection), `deck/deck-slug.ts`.
- Default (`README` only) must reproduce today's behaviour exactly — a stray `index.md` stays an ordinary page (NFR-003). Only the array/opt-in form collapses `index.md`.

### Subtask T003 — Bare-Node twin + literals

- In `validate-frontmatter.mjs`, add an index-detection twin mirroring `readmeToIndexId` (there is none today) and extend the root-index exemption (`isRootReadme`) to the configured basename incl. a root `index.md`.
- Update the hardcoded `README.md` literals in `check-links.mjs`, `scaffold.mjs`, `new-doc.mjs`, `assert-build-artifacts.mjs` to honour the basename (accept `index.md`). Do not break their current README behaviour.

### Subtask T004 — Collision behaviour

- A folder with both `README.md` and `index.md`: the configured `indexBasename` wins as the section index; the other is a normal page; emit a warning naming the collision. Implement identically in the TS loader path and the `.mjs` gate. Assert via T001.

### Subtask T005 — Registry `subtypes` field

- Add an optional `subtypes` field to the sections.yaml zod schema (`schema.ts`) and a resolver in `sections.ts` (the deferred seam). Shape per `data-model.md` E-02.
- `expectedDocType` (ts) and `expectedType` (mjs twin) consult `subtypes` **before** the built-in sub-path table; resolution order per E-06 (authored > registry subtypes > built-in table > section default). Built-in table stays as fallback (doc-kitty's own tree = no-op).

### Subtask T006 — Sidebar survival (ADR-0029)

- Ensure `registryToSidebar` keeps the renamed section's group (hub + children) rendering — the `docs/<id>` autogenerate prefix must track the registry id after a rename. Do not change the Starlight peer cap. (The example asserts this in WP04; here, keep the unit-level derivation correct and add coverage if feasible without a full build.)

### Subtask T007 — Parity twin extension

- Extend `section-type-parity.test.ts` and `schema-validator-parity.test.ts` so the TS lib and the `.mjs` validator agree on: basename detection (incl. root + collision) and the registry-`subtypes` derivation. 0 drift. This is the C-003-honest guard for the twins you just enlarged.

### Subtask T008 — Backward-compat verification

- Run `pnpm test`, `node src/scripts/validate-frontmatter.mjs docs`, `check-links`, and the example build + `assert-build-artifacts` locally (or via the env's available runner). Confirm the current corpus is a no-op (NFR-003) and all gates stay green. Note any env limitation (see Risks) and rely on CI as the verifier.

## Branch Strategy

- Planning/base branch: `feat/adopter-loader-migration`. Final merge target: `feat/adopter-loader-migration` (the mission branch; the PR to `main` is opened later).
- Do **not** create your own branch. `finalize-tasks` computes execution lanes; enter the workspace/branch the lane assigns (see `lanes.json`). Implement with `spec-kitty agent action implement WP01 --agent <name>`.

## Test Strategy (ATDD, red-first)

Tests land first (T001) and gate done. New helpers/branches get tests in the same commit (Sonar new-code gate). Keep cyclomatic complexity ≤ 15 per function; if the basename/subtypes branching pushes past it, extract a small resolver. **Parity is the crown jewel** — a green parity test is the definition of "the twins didn't drift."

## Definition of Done

- `index-basename.test.ts` + `section-rename.test.ts` + extended parity twins all green.
- `indexBasename` default reproduces today's behaviour; `index.md` works across every listed surface; collision warns; case-insensitive.
- Registry `subtypes` derivation works in both twins with built-in fallback; unknown-id warns.
- Existing suite + doc-sanity/build gates green on the current corpus (NFR-003).
- No new runtime dependency. Complexity ≤ 15.

## Reviewer Guidance (opus)

- Verify the `.mjs` twin genuinely mirrors the TS index-detection and subtypes logic — the parity test must exercise the *new* cases, not just the old ones.
- Confirm every FR-003 surface (loader, route slug, mjs gate + root exemption, check-links, scaffold, new-doc, llms.txt, assert-build-artifacts) actually honours the basename — hunt for a missed literal (the partial-adoption trap).
- Confirm the built-in subtype table still fires when `subtypes` is absent (doc-kitty's own tree unaffected).
- Confirm no per-rename code edit is needed for the registry path (SC-002).
