---
work_package_id: WP03
title: Font Awesome → Starlight icon seed map + graceful-drop lookup
dependencies:
- WP01
requirement_refs:
- FR-009
- FR-010
- NFR-002
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/lib/markua/
create_intent:
- src/lib/markua/icon-map.ts
- src/tests/markua-icon-map.test.ts
execution_mode: code_change
owned_files:
- src/lib/markua/icon-map.ts
- src/tests/markua-icon-map.test.ts
agent_profile: implementer-ivan
agent: claude
model: sonnet
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-009,
FR-010, NFR-002; US4), **the pinned contract**
[../contracts/icon-map.md](../contracts/icon-map.md) (this WP implements it), the callout
placement note in [../contracts/callout-mapping.md](../contracts/callout-mapping.md), and
`docs/adr/0030-markua-preprocess-to-directive.md` (D-04 disposition). Confirm the target names
against the pinned `@astrojs/starlight@0.32.6` `<Icon>` set during implementation.

## Objective

Ship the curated **Font Awesome → Starlight icon seed map** and its pure lookup with
**graceful-drop-plus-build-warning**, per [`contracts/icon-map.md`](../contracts/icon-map.md).
A mapped `{icon: fa-name}` resolves to a Starlight `<Icon>` name; an **unmapped** name
**drops the icon** (the callout still renders) and the build emits a **warning naming the
unmapped `fa-` name** and **exits 0** — the build never fails over an unknown icon (FR-010,
NFR-002). This is a **pure, standalone module** (`src/lib/markua/icon-map.ts`): a lookup table
plus a resolver function, unit-tested Astro-free.

This WP **adds only `icon-map.ts` + its test** and no plumbing anywhere else — the callout
plugin (WP04) already carries the `icon` field on its directive schema and **imports this
module's `resolveIcon`** from the start. Per the pinned callout scheme (there is **no
`Callout.astro` component** — theme callouts render as emitted hast, see
[`contracts/callout-mapping.md`](../contracts/callout-mapping.md) §"Why hast, not an `.astro`
component"), WP04 **consumes** the resolved Starlight icon name and **emits it as the
`dk-callout__icon` child** of the theme-callout hast (`<aside class="dk-callout
dk-callout--{variant}">`), or as the native Starlight aside's icon for a mapped class. This WP
touches **no rendering file** — no callout-plugin edit, no `theme.css` edit (contract "adds only
icon-map.ts + its lookup"). It is **dormant** until WP04 calls it and WP10 turns the preset on;
it changes no rendering and keeps the corpus byte-identical.

## Subtasks

### T009 — `icon-map.ts` entry shape + curated seed set
- Create `src/lib/markua/icon-map.ts`:
  - `export interface IconMapEntry { fa: string; starlight: string }` (the `fa-…` name the
    author writes → the Starlight `<Icon>` name it maps to).
  - The **seed set** (~18 rows) from the contract table, keyed by `fa` name — e.g.
    `fa-lightbulb`, `fa-info-circle`, `fa-exclamation-triangle`, `fa-exclamation-circle`,
    `fa-check`, `fa-times`, `fa-question-circle`, `fa-comments`, `fa-pencil`, `fa-star`,
    `fa-flag`, `fa-bookmark`, `fa-book`, `fa-code`, `fa-terminal`, `fa-cog`, `fa-clock`,
    `fa-user`. Store as a `Map` or a frozen record keyed by `fa`.
  - **Verify each `starlight` target is a real `@astrojs/starlight@0.32.6` `<Icon>` name.**
    Where a listed target is **not** a real Starlight icon, correct it or **drop the row** —
    never ship a row pointing at a non-existent icon (contract note). The count is **not**
    load-bearing; the graceful-drop behaviour is.
- **Files**: `icon-map.ts` (map section, ~40 lines).
- **Validation**: T011 (map hit + purity). Edge: keep the map a single source of truth — no
  duplicate `fa` keys.

### T010 — `resolveIcon` lookup + graceful drop + build warning
- In `icon-map.ts`, export the pure resolver:
  - `lookup(fa: string): string | undefined` — returns the Starlight name or `undefined`.
    Author input is the `fa-`-prefixed name (Markua's Font Awesome convention); a value with
    **no `fa-` prefix is treated as unmapped** (returns `undefined`).
  - `resolveIcon(fa: string | undefined): string | undefined` — the call site WP04 uses:
    - `undefined`/empty input → `undefined`, **no warning** (no `{icon:}` on the callout).
    - a **mapped** name → the Starlight name.
    - an **unmapped** name → `undefined` **and emit a build-time warning** naming the unmapped
      `fa-` name (a `console.warn` with a greppable, stable prefix, e.g.
      `[markua] unknown icon "fa-obscure-name" — dropped`). The warning must fire at **build
      time** (this module runs inside the remark pipeline) and the build **exits 0**.
  - Keep the warning **idempotent-friendly** and stable-worded so WP10's build assertion can
    grep for it. Do **not** throw on any input (NFR-002).
- **Files**: `icon-map.ts` (resolver section, ~40 lines).
- **Validation**: T011 (mapped-hit, unmapped-miss-with-warning, no-`fa-`-prefix, empty input).

### T011 — Vitest: mapped hit, unmapped miss-with-warning, purity
- Create `src/tests/markua-icon-map.test.ts`:
  - **Mapped hit**: `resolveIcon('fa-lightbulb')` → the seed's Starlight name (US4 sc.1).
  - **Unmapped miss**: `resolveIcon('fa-obscure-name')` → `undefined` **and** a warning was
    emitted naming `fa-obscure-name` (spy on `console.warn`); assert **no throw** (US4 sc.2).
  - **No `fa-` prefix**: `resolveIcon('lightbulb')` → `undefined` (treated as unmapped).
  - **No icon**: `resolveIcon(undefined)` / `resolveIcon('')` → `undefined`, **no warning**.
  - **Purity/determinism**: repeated `lookup` calls return the same value; the map has no
    duplicate `fa` keys.
- **Files**: `markua-icon-map.test.ts` (~60 lines).
- **Validation**: `pnpm test` green; `astro check`/`tsc` clean.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP01**. Lands **before WP04**, which imports `resolveIcon`. Implement with
`spec-kitty agent action implement WP03 --agent claude`.

## Definition of Done

- `src/lib/markua/icon-map.ts` exports `IconMapEntry`, the curated seed map (targets verified
  against Starlight 0.32.6), `lookup`, and `resolveIcon` with graceful-drop + build-warning.
- `resolveIcon` never throws; unmapped → `undefined` + a stable, greppable warning; the build
  exits 0 (NFR-002).
- `markua-icon-map.test.ts` covers mapped hit, unmapped miss-with-warning, no-prefix, and
  purity.
- **No other file changed** — no callout-plugin edit, no `theme.css` edit (WP04 emits the
  resolved name as the `dk-callout__icon` hast child / native-aside icon; there is no
  `Callout.astro`); corpus byte-identical. `ci-ok` green on unit tests.

## Risks / Reviewer guidance

- **This WP owns only `icon-map.ts`** — it must not edit the callout plugin (WP04) or `theme.css`
  (WP05); the resolved icon is emitted by WP04 as the `dk-callout__icon` hast child (there is no
  `Callout.astro`) — contract "adds only icon-map.ts + its lookup". A diff outside the two owned
  files is a finding.
- **Never fail the build** — an unmapped or malformed icon must drop with a warning and exit 0;
  a throw is a NFR-002 violation.
- **Greppable warning wording** — WP10's build assertion greps for the unmapped-icon warning;
  keep the `[markua] …` prefix and the named `fa-` value stable.
- **Verify Starlight targets** — a seed row pointing at a non-existent `@astrojs/starlight@0.32.6`
  icon renders nothing; drop or correct such rows rather than guessing.
