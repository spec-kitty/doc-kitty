---
work_package_id: WP02
title: Pure resolver (the one shared matcher)
dependencies:
- WP01
requirement_refs:
- FR-007
- FR-012
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/glossary/resolve.ts
create_intent:
- src/lib/glossary/resolve.ts
- src/tests/glossary-resolve.test.ts
execution_mode: code_change
owned_files:
- src/lib/glossary/resolve.ts
- src/tests/glossary-resolve.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../contracts/resolver.md](../contracts/resolver.md), and
`docs/adr/0027-auto-link-resolution-scoping-and-term-directive.md`.

## Objective

Implement the **one shared matcher** (D1/D6): a **pure** function that, given a matched
surface form, the page's context, and WP01's `SharedTermIndex`, decides whether it links, is
an unresolved collision, or is nothing. This is the single source of truth for four
consumers — the auto-linker (WP04), `:term` (WP05), the generator's cross-links (WP03), and
the block's fallback (WP07) — so it must be small, exhaustively tested, and free of any tree
or Astro concern (the section-walk and AST rewriting live in WP04, not here). **No build
wiring**; dormant until WP08.

## Dependency note (approved ≠ merged)

WP01 is a dependency but **an approved WP is not on `feat/glossary` until the final merge**.
As the **first step** in the lane, merge the approved WP01 lane branch into this lane so
`src/lib/glossary/{types,anchor}.ts` are present:
`git merge kitty/mission-glossary-01M0YCHB-lane-<wp01> --no-edit` (the orchestrator prints
the exact lane branch). Scope your review to **this WP's own files**.

## Subtasks

### T006 — The pure resolver
- Create `src/lib/glossary/resolve.ts` exporting:
  ```ts
  function resolveSurface(
    surface: string,
    pageContext: string | undefined,
    index: SharedTermIndex,
    ignoreList: ReadonlySet<string>,
  ): Resolution   // from ../glossary/types
  ```
- Rules (contract `resolver.md`):
  1. Lowercase `surface` before lookup (matching is case-insensitive; the **word-boundary**
     guard is WP04's — this fn receives an already-word-bounded surface).
  2. `ignoreList.has(lower)` → `{ kind: 'none' }` (FR-008).
  3. Not in `index.bySurface` → `{ kind: 'none' }`.
  4. Exactly one candidate context → `{ kind: 'link', context, anchor, termName }` (FR-007).
  5. Multiple candidates, `pageContext` is one → `{ kind: 'link', context: pageContext, … }`.
  6. Multiple candidates, `pageContext` absent/not among → `{ kind: 'unresolved', surface,
     competing }` (FR-007).
  7. Aliases resolve exactly like names — they already share `index.bySurface` (FR-012).
- `anchor` is always `slug(termName)` — import `anchor.slug` from WP01, do **not** reinvent.
- **Purity**: no I/O, no Astro imports; same inputs → same output (NFR-004).
- **Files**: `src/lib/glossary/resolve.ts` (~70 lines).

### T007 — Deterministic `competing[]` ordering
- In the `unresolved` case, `competing` is the sorted-unique list of candidate context names
  (stable, deterministic) so WP04's greppable warning
  `[glossary] unresolved collision "<name>" in <ctxA>, <ctxB> — left unlinked` is byte-stable
  across builds (NFR-004/NFR-007). Sort by the context name (locale-independent code-point
  sort).
- **Files**: within `resolve.ts`. **Validation**: covered by T008.

### T008 — Exhaustive resolver unit tests
- `src/tests/glossary-resolve.test.ts` (vitest), building a small `SharedTermIndex` inline:
  - Single-candidate surface → `link`.
  - `policy` in `hr` + `shipping`, page `glossary_context: hr` → `link` to `hr`.
  - `policy` collision, `pageContext` undefined → `unresolved`, `competing: ['hr','shipping']`
    (sorted, deterministic).
  - `policy` collision, `pageContext: 'legal'` (not a candidate) → `unresolved`.
  - Ignore-listed surface → `none`.
  - Unknown surface → `none`.
  - **Alias** (`consignment` alias of `cargo`) resolves exactly like `cargo` (FR-012).
  - Case-insensitivity: `"Cargo"` and `"cargo"` resolve identically (the fn lowercases).
- **Validation**: `pnpm test` green; `astro check` clean.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on WP01**
(merge the approved WP01 lane first — see the dependency note). Runs in parallel with WP03.
Implement with `spec-kitty agent action implement WP02 --agent claude`.

## Definition of Done

- `resolve.ts` implements all seven rules purely; `competing[]` is deterministically ordered.
- Aliases resolve like names; anchors come from the shared `anchor.slug`.
- Exhaustive vitest green (collision matrix, ignore-list, alias, case-insensitivity).
- `ci-ok` green — no build wiring; corpus byte-identical.

## Risks / Reviewer guidance

- **Purity is load-bearing** — any `getCollection`, file read, or Astro import here is a
  finding; this fn is called from unit tests, the remark passes, and the Astro block alike.
- **Section-walk is NOT here** — first-per-section belongs to WP04. Reviewer: confirm this WP
  has no notion of H2 sections or mdast traversal.
- **`competing` order** — must be deterministic (sorted), or NFR-007's greppable warning
  drifts between builds.
