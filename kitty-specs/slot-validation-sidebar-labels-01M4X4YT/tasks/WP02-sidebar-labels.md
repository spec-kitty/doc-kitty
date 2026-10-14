---
work_package_id: WP02
title: Sidebar labels for one-page folders and section indexes
dependencies: []
requirement_refs:
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
- FR-009
- FR-010
- NFR-001
- C-002
- C-003
- C-004
planning_base_branch: issue-114-112-slot-validation-sidebar-labels
merge_target_branch: issue-114-112-slot-validation-sidebar-labels
branch_strategy: Planning artifacts for this mission were generated on issue-114-112-slot-validation-sidebar-labels. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-114-112-slot-validation-sidebar-labels unless the human explicitly redirects the landing branch.
subtasks:
- T005
- T006
- T007
- T008
- T009
history: []
agent_profile: node-norris
authoritative_surface: src/lib/route-shaping.ts
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/route-shaping.ts
- src/tests/route-shaping.test.ts
- src/tests/sidebar-build-html.test.ts
- example/docs/rhetoric/introduction.md
- example/docs/rhetoric/preamble.md
- example/docs/rhetoric/about-and-license.md
- example/docs/architecture/overview.md
- docs/guides/authoring.md
- CHANGELOG.md
role: implementer
tags: []
tracker_refs:
- spec-kitty/doc-kitty#112
---

# WP02 — Sidebar labels for one-page folders and section indexes (#112)

## Objective

No sidebar group repeats its own label as its first entry, and no folder whose
only page is its index renders as a group. `/rhetoric/` reads in reading order.

## Branch strategy

Planning branch and merge target: `issue-114-112-slot-validation-sidebar-labels`. Single-branch topology.

## Procedure

test-first-bug-fixing, red through the built sidebar HTML
(`src/tests/sidebar-build-html.test.ts`). Grounding:
`research/code-grounding.md` §2. Rules: plan.md "Collapse rule, exactly" and
"Relabel rule, exactly".

## T005 — Red

- `sidebar-build-html.test.ts`: replace the authored-only label check with
  one over every nested group (label is not the raw last path segment of the
  group's directory); assert no group's first entry repeats the group label;
  Reference holds links `Glossary, hr, rhetoric, shipping` and no subgroup;
  `/rhetoric/` lists Introduction, Preamble, About and license; the next link
  from the page before `/guides/` reads the page title. Do not pin Behaviour
  labels (C-003, Gherkin sibling).
- `route-shaping.test.ts`: collapse, no collapse at depth 0, no collapse for
  a non-index single child, relabel, duplicate "Overview" guard, pagination
  label from the original tree.
- Commit failing.

## T006 / T007 — Green

`shapeSidebar` and `shapePagination` only. Collapsed links sort with their
parent's links. Pagination looks labels up by `href` in the original tree.

## T008 — Example content

`sidebar.order` 1/2/3 on introduction, preamble, about-and-license;
`sidebar.label: System overview` on `architecture/overview.md`. Bump
`updated`.

## T009 — Docs

`docs/guides/authoring.md` "How your pages appear in the sidebar": the two
new rules. `CHANGELOG.md` Unreleased: #114 (breaking: unknown slot name
fails) and #112.

## Done when

All gates in the plan pass; the widened checks fail on `main`.
