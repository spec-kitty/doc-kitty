---
work_package_id: WP01
title: Theme merge and token emission
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-015
- NFR-002
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: node-norris
role: implementer
authoritative_surface: src/lib/
create_intent:
- src/lib/theme.ts
- src/tests/theme-merge.test.ts
execution_mode: code_change
owned_files:
- src/lib/theme.ts
- src/tests/theme-merge.test.ts
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile:

```
/ad-hoc-profile-load node-norris
```

You are **node-norris**, the server-side/Node.js implementer. This WP is pure
TypeScript toolkit logic — no `.astro` rendering, no CI. Apply event-loop-agnostic,
strongly-typed, test-first discipline. Write the tests to fail first (DIRECTIVE_034),
then make them pass.

## Objective

Build the theme-resolution core of the M2 theme layer: the `DocKittyTheme` type, the
`default → brand → consumer` merge, and the token-sheet emission — plus the
**no-theme byte-compatibility** path that keeps the M1 `(options)` call unchanged.
This WP is pure logic in `src/lib/theme.ts` with a `vitest` suite; it does not wire
`config.ts` (that is WP02) and does not render anything.

## Context

Settled design: ADR-0008 (theme is a layered, swappable concern), ADR-0011 (the
`--dk-*`-only rule + the `--dk-*→--sl-*` bridge), theming.md §"Wiring" (the
`DocKittyTheme` shape and the merge rules: per-key last-wins; `customCss` concatenates;
`tokens` shallow-merge), and ADR-0013 (M1 ships the complete Default `--dk-*` catalog
as one cascade-positioned stylesheet at `src/styles/theme.css`, which stays the
source of truth for the bridge pairs).

M1 today: `defineDocKittyIntegrations(options)` sets a single static
`customCss: ['@commondocs-kitty/toolkit/styles/theme.css']` (see `src/lib/config.ts`).
This WP produces the functions WP02 will call; the no-theme result must reproduce that
exact single-entry `customCss` (NFR-002).

The base sheet `src/styles/theme.css` already declares the full `--dk-*` catalog and
every `--dk-*→--sl-*` bridge assignment. Read it as the authoritative token list; the
emission code re-emits the merged `--dk-*` values and re-uses the same bridge pairs —
it does not invent new token names.

## Subtasks

### T001 — DocKittyTheme type, DkSlotName, Kind re-export

**Purpose**: Establish the public theme contract as strong types (NFR-006 stable
surface) in a new `src/lib/theme.ts`.

**Steps**:
1. Create `src/lib/theme.ts`.
2. Define `DkSlotName` as a string-literal union of the `dk:` slot names from
   theming.md §"The slot surface": `dk:head`, `dk:site-header`, `dk:site-title`,
   `dk:social-links`, `dk:site-footer`, `dk:announcement`, `dk:toc`, `dk:toc-mobile`,
   `dk:pagination`, `dk:last-updated`, `dk:edit-link`, `dk:page-hero`,
   `dk:metadata-band`, `dk:audience`, `dk:related`, `dk:external-references`.
3. Re-export `Kind` from `./schema.ts` (do not redefine the vocabulary).
4. Define the interface:
   ```ts
   export interface DocKittyTheme {
     name?: string;
     extends?: DocKittyTheme;
     tokens?: Record<string, string> | string; // --dk-* values or a css path
     customCss?: string[];
     assets?: { logo?: string; favicon?: string; socialImage?: string; fonts?: string[] };
     slots?: Partial<Record<DkSlotName, string>>;
     layouts?: Partial<Record<Kind, string>>;
   }
   ```

**Files**: `src/lib/theme.ts` (new).

**Validation**: `astro check` / `tsc` passes; `DkSlotName` includes all 16 names;
`Kind` is imported, not duplicated.

**Edge cases**: `tokens` accepts either an object or a css path string — model the union
now so downstream code branches on it.

### T002 — mergeTheme resolver

**Purpose**: Resolve the `extends` chain into a single `ResolvedTheme` with the exact
merge semantics theming.md specifies.

**Steps**:
1. Add `resolveTheme(theme?: DocKittyTheme): ResolvedTheme` and an internal
   `mergeLayers(layers: DocKittyTheme[])`.
2. Flatten the `extends` chain into an ordered list `[default, …, this]` (default is
   the shipped base; a brand `extends` default; a consumer `extends` brand). Guard
   against cycles.
3. Merge rules:
   - **`tokens`**: shallow-merge across layers — a later layer overrides only the
     `--dk-*` keys it names; un-named keys inherit. If a layer's `tokens` is a css
     path, record it for the emitter to read; object tokens win per-key.
   - **`customCss`**: concatenate in layer order (base first, then brand, then
     consumer).
   - **`assets`, `slots`, `layouts`, `name`**: per-key last-wins.
4. Return `ResolvedTheme { tokens: Record<string,string>; customCss: string[]; assets; slots; layouts }`.

**Files**: `src/lib/theme.ts`.

**Validation**: unit tests in T005 prove each rule; a consumer overriding one token
leaves the rest at brand values.

**Edge cases**: a missing `extends` means the theme merges only over the shipped
Default; `mergeTheme(undefined)` routes to the T004 no-theme path.

### T003 — emitTokenSheet

**Purpose**: Turn the resolved `--dk-*` map into the generated stylesheet that carries
the bridge, positioned so WP02 can append brand/consumer CSS after it.

**Steps**:
1. Add `emitTokenSheet(resolved: ResolvedTheme): string` returning CSS text.
2. Emit a `:root { … }` block with the merged `--dk-*` declarations, then the
   `--dk-*→--sl-*` bridge assignments (reuse the exact pairs from
   `src/styles/theme.css`; do not invent names).
3. Re-declare the **mode-varying colour subset** under the dark selector
   (`:root[data-theme='dark']`) so a brand override applies in both modes.
4. Never emit a direct `--sl-*: <value>` from theme tokens — `--sl-*` only ever appears
   as `--sl-x: var(--dk-y)` in the bridge (FR-004).

**Files**: `src/lib/theme.ts`.

**Validation**: T005 asserts the emitted sheet declares the merged tokens, carries the
bridge, re-declares the dark subset, and contains zero `--sl-*:` value assignments.

**Edge cases**: when `tokens` is a css path, the emitter references that sheet rather
than inlining; keep the bridge emission independent of that choice.

### T004 — No-theme degenerate path (byte-compat)

**Purpose**: Guarantee the M1 `(options)` call is unchanged (NFR-002).

**Steps**:
1. `resolveTheme(undefined)` must yield: `customCss = ['@commondocs-kitty/toolkit/styles/theme.css']`
   (the single static entry M1 ships), the Default catalog, and **no** generated
   sheet (generation bypassed).
2. Expose this so WP02's `config.ts` can detect the no-theme case and skip emission.

**Files**: `src/lib/theme.ts`.

**Validation**: T005 asserts `resolveTheme(undefined).customCss` deep-equals the single
M1 entry and that no generated sheet is produced.

**Edge cases**: an empty object `{}` theme is NOT the same as no theme — decide and
document (recommended: `{}` still routes through the Default merge but emits nothing
extra; only `undefined` is the pure M1 path).

### T005 — vitest suite

**Purpose**: Lock the merge, emission, and byte-compat behaviour with failing-first
tests.

**Steps**:
1. Create `src/tests/theme-merge.test.ts`.
2. Cases: per-key last-wins (consumer token over brand over default); `customCss`
   concatenation order; `tokens` shallow-merge (un-named keys inherit); no-theme
   byte-compat (single static `customCss`, no generated sheet); a brand fixture's
   emitted sheet has zero `--sl-*:` value declarations (FR-004); mode-varying tokens
   re-declared under the dark selector.
3. Use small in-file fixture themes; do not depend on the real brand (WP04).

**Files**: `src/tests/theme-merge.test.ts` (new).

**Validation**: `pnpm test` (vitest) green; each test fails if its rule is removed
(mutation-aware — assert the specific value, not mere presence).

**Edge cases**: cover a three-layer chain (default→brand→consumer) and a two-layer
chain (default→brand) to prove flattening order.

## Branch Strategy

Planning artifacts were generated on `feat/component-system-and-theme`. During
`/spec-kitty.implement` this WP may branch from a dependency-specific base; completed
changes merge back into `feat/component-system-and-theme` (which lands into
`origin/main` via the mission PR). Execution worktrees are allocated per computed lane
from `lanes.json` — do not create branches by hand. This WP has no dependencies, so it
starts from the planning base.

## Definition of Done

- `src/lib/theme.ts` exports `DocKittyTheme`, `DkSlotName`, `resolveTheme`,
  `mergeTheme`/`mergeLayers`, and `emitTokenSheet`; `astro check` passes.
- `resolveTheme(undefined)` returns the single static `customCss` entry and no
  generated sheet (proven by test).
- The three merge rules (per-key last-wins, customCss concat, tokens shallow-merge)
  each proven by a test that fails if the rule is removed.
- The emitted brand-fixture sheet carries the bridge, re-declares the dark subset, and
  contains zero `--sl-*:` value assignments (proven by test).
- `pnpm test` green; no change to any file outside `owned_files`.

## Risks

- **Byte-compat drift**: any change to the no-theme `customCss` shape breaks every M1
  gate downstream. The T004/T005 tests are the guard — keep them strict.
- **Bridge duplication**: emitting a hand-written bridge that diverges from
  `src/styles/theme.css`. Reuse the same pairs; WP08 asserts completeness.

## Reviewer Guidance

- Confirm `resolveTheme(undefined)` is byte-identical to M1 (diff the `customCss`).
- Confirm no `--sl-*: <value>` is ever emitted from theme tokens (only
  `--sl-x: var(--dk-y)` bridge form).
- Confirm the tests assert specific values (mutation-aware), not just presence.
- Confirm `Kind` is re-exported from `schema.ts`, not redefined.
