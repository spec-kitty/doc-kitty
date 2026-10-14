---
work_package_id: WP01
title: Reject unknown theme slot names
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- NFR-002
- C-001
planning_base_branch: issue-114-112-slot-validation-sidebar-labels
merge_target_branch: issue-114-112-slot-validation-sidebar-labels
branch_strategy: Planning artifacts for this mission were generated on issue-114-112-slot-validation-sidebar-labels. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-114-112-slot-validation-sidebar-labels unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
history: []
agent_profile: node-norris
authoritative_surface: src/lib/theme.ts
create_intent:
- src/tests/slot-names-config.test.ts
- docs/adr/0052-runtime-slot-name-validation.md
execution_mode: code_change
owned_files:
- src/lib/theme.ts
- src/lib/manifest.ts
- src/tests/theme-merge.test.ts
- src/tests/slot-names-config.test.ts
- docs/adr/0052-runtime-slot-name-validation.md
- docs/adr/README.md
- docs/adr/0044-header-carrier.md
- docs/architecture/theming.md
role: implementer
tags: []
tracker_refs:
- spec-kitty/doc-kitty#114
---

# WP01 — Reject unknown theme slot names (#114)

## Objective

A theme slot name outside the `dk:` surface fails the build at config time,
naming the bad slot and listing every valid one. Valid themes resolve exactly
as before.

## Branch strategy

Planning branch and merge target: `issue-114-112-slot-validation-sidebar-labels`. Single-branch topology: work lands
directly on it; no lane worktree.

## Procedure

test-first-bug-fixing: tidy-first enabler commit, then the red test (committed
failing), then the fix. Grounding: `research/code-grounding.md` §1.

## T001 — Tidy first

In `src/lib/theme.ts` declare `export const DK_SLOT_NAMES = [...] as const`
holding today's 16 names in today's order, and derive
`export type DkSlotName = (typeof DK_SLOT_NAMES)[number]`. Add a type-level
assertion in `theme-merge.test.ts` that the list and the type agree.
Behaviour-preserving. Do not touch `DEFAULT_BASE` (C-001: #154 edits it).

## T002 — Red

- `src/tests/slot-names-config.test.ts`: call `defineDocKittyIntegrations`
  the way a `.mjs` config does, with `theme: { slots: { 'dk:site-heading': 'x.astro' } }`;
  expect a throw whose message contains `dk:site-heading` and all 16 names.
  Same-fixture positive control: `'dk:site-header'` resolves.
- `theme-merge.test.ts`: `resolveTheme` direct, via `extends` (valid brand,
  bad consumer), and the layer `name` in the message.
- Commit with the tests failing.

## T003 — Green

In `mergeLayers`, check every key of `layer.slots` against
`DK_SLOT_NAMES` and throw one `Error` naming the key, the layer's `name`
when set, and the valid list. Same loop and style as the `--sl-*` check.

## T004 — Docs

- New ADR-0052 (runtime slot-name validation): context (ADR-0044 known limit),
  decision (fail, not warn, and why), consequences. Partially supersedes the
  ADR-0044 consequence bullet; ADR-0044 gains only a forward pointer in its
  frontmatter/status line if the convention allows, else nothing.
- `docs/adr/README.md` index (`pnpm validate:adr-index` / generator).
- `docs/architecture/theming.md`: replace "checked by the TypeScript theme
  type only" with the runtime rule; bump `updated`.
- `src/lib/manifest.ts` `SlotComponents` comment: names are checked in
  `resolveTheme` before the manifest is generated.

## Done when

`pnpm test` green, `pnpm lint`, `pnpm typecheck`, `pnpm validate` green; the
T002 tests fail on the T001 commit and pass after T003.
