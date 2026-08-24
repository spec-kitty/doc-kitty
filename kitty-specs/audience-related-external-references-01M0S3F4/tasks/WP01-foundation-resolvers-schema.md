---
work_package_id: WP01
title: 'Foundation: resolvers + schema surface'
dependencies: []
requirement_refs:
- FR-007
- FR-010
- FR-016
- FR-018
planning_base_branch: feat/audience-related-external-references
merge_target_branch: feat/audience-related-external-references
branch_strategy: Planning artifacts for this mission were generated on feat/audience-related-external-references. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/audience-related-external-references unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/
create_intent:
- src/tests/resolvers.test.ts
execution_mode: code_change
owned_files:
- src/lib/metadata.ts
- src/lib/schema.ts
- src/tests/resolvers.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its
initialization, boundaries, directives, and tactics. Then read this WP,
[../spec.md](../spec.md), [../plan.md](../plan.md),
[../data-model.md](../data-model.md),
[../contracts/catalog-and-citation.contract.md](../contracts/catalog-and-citation.contract.md),
and `docs/adr/0018-citation-catalog-collections.md` +
`docs/adr/0019-persona-attribute-fields.md`.

## Objective

Build the Astro-free **resolution core** and the **schema additions** every later
WP consumes. Pure functions in `src/lib/metadata.ts`; schema/loader/field additions
in `src/lib/schema.ts`. No `.astro`, no rendering — this WP is the foundation the
block, catalog, persona, and agent WPs build on.

This WP leaves `ci-ok` green on its own: it adds code + unit tests only; it does not
yet wire anything into a page, so `build-example`/`a11y` are unaffected.

## Subtasks

### T001 — `resolveRelated(ref, index)`
Pure function in `metadata.ts`. Input: a `related` entry (bare slug **or**
`{ ref, note }`) + the docs index (a map/list of `{ slug, title, kind, doc_status, description }`).
Output: `{ ref, title, kind, doc_status, note? }`. **Precedence**: the resolved
card text is the entry `note` when present, else the target `description`.
**Miss**: throw / return a typed error the caller turns into a **build failure**
(FR-004) — never silently drop. Do not import Astro.

### T002 — `resolveProfile(profile, index)` [P]
Pure function. Input: a `profile` slug + the docs index. Output:
`{ href, title } | null`. Resolution target is `context/audience/<profile>.md`.
**Soft**: return `null` on miss (the caller renders the humanized slug + warns — the
warn channel lands in WP04). Provide a `humanizeProfile(slug)` helper.

### T003 — `resolveCitation(extRef, catalog)` [P]
Pure function. Input: an `external_references` entry + the loaded catalog
`{ bibliography, tools }`. Inline `{ url, title, note? }` returns as-is. Catalog
`{ type, id }`: catalog `type: biblio` → `bibliography[id]`, `type: tool` →
`tools[id]`. **Miss or unknown catalog `type`** → typed error → **build failure**
(FR-008). Always qualify the catalog `type` distinctly from the frontmatter `type`.

### T004 — `DocKittyFrontmatter` type sync [P]
Extend the `DocKittyFrontmatter` interface in `metadata.ts` with `audience`,
`external_references`, and `moscow` so the framework-agnostic model matches the zod
schema it feeds. Do **not** change `toAgentRecord` (kept pure; WP05 composes the
route enrichment).

### T005 — Schema surface in `schema.ts`
Two additive changes (behind ADR-0018 / ADR-0019 — no frozen shape re-litigated):
1. **Catalog collections**: export a zod schema + a content-layer `file()` loader for
   `bibliography` and `tools` (mirroring `docKittyDocsSchema()`/`docKittyDocsLoader()`),
   so a consumer wires them in one step. Shapes per the data-model.
2. **Lenient persona fields**: add optional `role: string`, `goals: string[]`,
   `responsibilities: string[]` to the doc-kitty field set. Keep them **optional** in
   zod — `kind` is open `z.string()`; requiredness is the validator's job (WP03).

### T006 — Resolver unit tests
`src/tests/resolvers.test.ts` (vitest): `resolveRelated` hit + note-over-description
precedence; `resolveRelated` miss throws; `resolveProfile` hit + miss→null +
`humanizeProfile`; `resolveCitation` inline pass-through + biblio hit + tool hit +
missing id throws + unknown catalog type throws.

## Branch Strategy

Planning branch and final merge target: `feat/audience-related-external-references`.
`/spec-kitty.implement` allocates this WP's worktree from the computed lane
(`lanes.json`). Completed changes merge back into the mission branch.

## Definition of Done

- `resolveRelated` / `resolveProfile` / `resolveCitation` implemented, pure, exported.
- `DocKittyFrontmatter` carries `audience`/`external_references`/`moscow`;
  `toAgentRecord` unchanged.
- `schema.ts` exports catalog schema + loader and carries optional persona fields.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all green (resolver suite passes).
- `doc-sanity`, `build-example`, `a11y` unaffected (no page wiring yet).

## Risks & reviewer guidance

- **Purity**: the resolvers must not import Astro — the build-free gates
  parity-duplicate them (WP02/WP03), so a hard Astro import would break that.
- **Miss posture**: verify `related`/citation miss is fatal (throws) and profile miss
  is soft (null) — the asymmetry is the whole point (spec Assumptions).
- Reviewer: confirm no frozen field shape changed; only additive fields + resolvers.
