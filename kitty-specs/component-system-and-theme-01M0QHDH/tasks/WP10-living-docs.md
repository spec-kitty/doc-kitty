---
work_package_id: WP10
title: Living documentation
dependencies: []
requirement_refs:
- NFR-006
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T044
- T045
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: curator-carla
authoritative_surface: docs/architecture/
create_intent: []
execution_mode: code_change
owned_files:
- docs/architecture/theming.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile: run `/ad-hoc-profile-load`
for **curator-carla** (knowledge base and doctrine maintenance). Adopt its identity,
scope, and boundaries for the whole work package. Do not begin the subtasks until the
profile is loaded.

## Objective

Keep the theme-layer design documentation faithful to the behaviour this mission
ships (DIRECTIVE_037, living documentation). `docs/architecture/theming.md` is the
design page the theme ADRs point at; it must reference the new ADR-0015 slot-resolution
decision, note the pass-through sequencing, and record that the Spec Kitty brand and
the Persona layout now ship. The file must pass doc-sanity unchanged in kind.

Scope is deliberately narrow: one owned file, `docs/architecture/theming.md`. The
mission changelog is authored at the landing sequence, not here.

## Context

- `theming.md` currently describes the theme layer in its complete form and points to
  ADR-0008/0011. The post-spec squad surfaced that its §"The slot surface" listed
  pass-through slots (e.g. `dk:site-header` → Starlight `Header`) as if immediately
  available, which is in tension with the locked "components map = four carriers" seam.
  ADR-0015 resolves this: layouts resolve at the single import site, slots resolve
  per-carrier, the components map stays the four carriers, and non-carrier pass-through
  overrides are sequenced past M2.
- doc-sanity runs the frontmatter validator, `check-links.mjs`, markdownlint, and the
  Vale hedge rule. `theming.md` already carries the metadata contract; keep it valid.
- This WP is independent (no dependencies) and can proceed alongside the others, but is
  most accurate once the shipped shape is settled — coordinate landing near the end.

## Subtasks

### T044 — Reference ADR-0015 and the pass-through sequencing

**Purpose**: Make `theming.md` consistent with the slot-resolution seam ADR-0015
records, so a reader is not misled by the earlier pass-through phrasing.

**Steps**:
1. In §"The slot surface" and §"Wiring", add a reference to
   [ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md).
2. State the layout-vs-slot split: layouts resolve at the single `MarkdownContent`
   import site; `dk:` slots resolve per-carrier from the merged manifest; the
   Starlight `components` map stays exactly the four carriers.
3. Add the pass-through sequencing note: pass-through slots that map onto non-carrier
   Starlight overrides (Header, SiteTitle, Banner, …) are sequenced past M2; the Spec
   Kitty brand header rides Starlight-native `logo`/`title` config.
4. Add ADR-0015 to the page's `related` frontmatter list.

**Files**: `docs/architecture/theming.md`.

**Validation**:
- The ADR-0015 link resolves under `check-links.mjs`.
- No claim in `theming.md` contradicts ADR-0015 or the locked seam-3 statement.

**Edge cases**: do not edit the accepted ADR-0011/0013 files; reference, don't rewrite.

### T045 — Note the shipped brand and Persona layout; pass doc-sanity

**Purpose**: Record that the Spec Kitty brand theme and the Persona per-kind layout
now ship, so the page reflects reality (not just intent).

**Steps**:
1. In §"Shipped themes", confirm the Spec Kitty brand is shipped (self-contained,
   derived) and both light/dark render at WCAG 2.2 AA.
2. In §"Per-kind layout resolution" / §"The per-kind layouts", note that `Persona`
   ships as an in-frame passport shell rendering generic frontmatter; persona
   authoring and audience blocks remain M3.
3. Run the doc-sanity checks locally: frontmatter validator, `check-links.mjs`,
   markdownlint, and Vale — resolve any hedge-word or link findings.

**Files**: `docs/architecture/theming.md`.

**Validation**:
- `validate-frontmatter.mjs`, `check-links.mjs`, markdownlint, and Vale all pass on
  the edited file.
- The wording is audience-oriented (DIRECTIVE_047) and hedge-free.

**Edge cases**: keep the M2↔M3 boundary crisp — do not describe audience/related/
reference blocks as shipped (they are not).

## Branch Strategy

Planning artifacts for this mission were generated on `feat/component-system-and-theme`;
that is the planning/base branch and the merge target for this work package. At the
mission landing sequence the feature branch is rebased onto `origin/main` and a
same-repo PR is opened into `main`. During `/spec-kitty.implement`, execution
worktrees are allocated per computed lane from `lanes.json`; enter the workspace the
lane resolves to rather than hand-creating a branch. This WP has no dependencies.

## Definition of Done

- `theming.md` references ADR-0015 and states the layout-vs-slot resolution split and
  the pass-through sequencing; ADR-0015 is in its `related` list.
- `theming.md` records the shipped Spec Kitty brand and the Persona layout, with the
  M2↔M3 boundary intact.
- doc-sanity (validator + `check-links` + markdownlint + Vale) passes on the file.

## Risks

- **Contradiction drift**: a stale sentence left in `theming.md` that still implies
  pass-through overrides ship in M2 — read the whole slot-surface section, not just the
  edited lines.
- **Vale hedge rule**: audience-oriented, hedge-free wording (no "just", "simply",
  "of course").

## Reviewer Guidance

- Confirm the ADR-0015 reference resolves and the layout-vs-slot split is stated
  correctly (single import site for layouts; per-carrier for slots; four carriers).
- Confirm nothing in the page now claims the M3 blocks or non-carrier pass-through
  overrides ship in M2.
- Confirm doc-sanity is green on the edited file.
