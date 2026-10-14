# Implementation Plan: Slot-name validation and sidebar labels

**Branch**: `issue-114-112-slot-validation-sidebar-labels` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/slot-validation-sidebar-labels-01M4X4YT/spec.md`

The plan interview ran non-interactively and recorded three questions as
deferred (`decisions/DM-*.md`: approach, risks, dependencies). They are
answered in the sections below.

## Summary

Two independent defects, fixed test-first through their production entry
points:

- **#114.** Declare the slot names once as a runtime list, derive
  `DkSlotName` from it, and make `mergeLayers` throw on a slot key outside the
  list, as it already throws on a `--sl-*` token. `resolveTheme` is the only
  caller from config loading, so a plain-JS config fails at evaluation time.
- **#112.** Two rules in `shapeSidebar`: a nested folder group whose only entry
  is its index becomes that link; an index entry that repeats its group's label
  reads "Overview", unless a sibling already does. `shapePagination` names
  links by their original labels. Example content: `sidebar.order` on the three
  rhetoric pages and a distinct `sidebar.label` on the example's architecture
  "Overview" page.

## Technical Context

**Language/Version**: TypeScript 5 (ES modules), Node 22+
**Primary Dependencies**: Astro 5 + Starlight 0.32 (route-data middleware), Vitest, Playwright 1.62.1
**Storage**: N/A (static site)
**Testing**: Vitest unit suites in `src/tests/`; built-HTML suites in the serialized `build` project; Playwright a11y/visual lane in `tests/a11y/`; packed-consumer suite in `tests/consumption/`
**Target Platform**: static site build (GitHub Pages)
**Project Type**: single package (`src/` toolkit) + `example/` site
**Performance Goals**: example build within 5% of `main` (NFR-003)
**Constraints**: C-001..C-006 in the spec
**Scale/Scope**: 3 source files, 4 test files, 4 example pages, docs and one ADR

## Charter Check

| Charter rule | How the plan meets it |
|---|---|
| Three separated axes | Slot validation stays in the presentation layer (`theme.ts`). Sidebar rules stay in IA shaping (`route-shaping.ts`); top-level groups remain owned by `sections.yaml`. Content edits are confined to the example. |
| ADRs immutable; a change is a new ADR | ADR-0044's "checked by TypeScript only" consequence is superseded in part by a new ADR for runtime slot validation. |
| Living documentation | `docs/architecture/theming.md`, `docs/guides/authoring.md` and the `manifest.ts` comment change in the same commits as the behaviour. |
| Doc-sanity gates | Touched pages keep full frontmatter, `updated` bumped; `pnpm validate` runs. |
| Writing style | Sentence-case headings, one idea per sentence, no AI-writing tells. |
| Accessibility WCAG 2.2 AA | Sidebar markup stays Starlight's; axe lane runs. |

No violations; Complexity Tracking is empty.

## Approach (answers DM `plan.approach`)

1. **Tidy first (enabler, behaviour-preserving).** Introduce
   `DK_SLOT_NAMES` as a `readonly` tuple in `theme.ts` and derive
   `DkSlotName` from it (`(typeof DK_SLOT_NAMES)[number]`). Type-level test
   pins equality. No runtime change.
2. **Red: #114.** A test that calls `defineDocKittyIntegrations` (the
   function a `.mjs` config calls) with `slots: { 'dk:site-heading': … }` and
   expects a throw listing the valid names; and `resolveTheme` cases (direct,
   via `extends`, valid control). Committed failing.
3. **Green: #114.** Check in `mergeLayers`; message names the theme's `name`
   when set. Update `manifest.ts` comment, theming doc, new ADR.
4. **Red: #112.** In `src/tests/sidebar-build-html.test.ts`: widen the label
   check to every nested group (no group label equals its directory's last
   segment; no group whose first entry repeats its label); Reference holds
   links, no subgroup; `/rhetoric/` page order; next-link labels keep titles.
   Plus `route-shaping.test.ts` unit cases for collapse, relabel, the
   duplicate guard and pagination labels. Committed failing.
5. **Green: #112.** Shaping rules, pagination labels, example
   `sidebar.order`/`sidebar.label`, authoring guide, changelog.
6. **Baselines.** Push, dispatch `update-a11y-baselines.yml` on this branch,
   bring its commit in.

### Collapse rule, exactly

A **nested** group (depth > 0) collapses to its single child when, after
draft filtering, it has exactly one child and that child is the link to the
group's own directory index. The link is carried over unchanged (`isCurrent`,
`attrs`, `badge`). It keeps the folder's place among its parent's subgroups
(ordered by the index's `sidebar.order`, then label), so a one-page "Book II"
still reads after a multi-page "Book I".

*Implementation note (WP02):* the first draft sorted a collapsed link with its
parent's plain links. A unit case on the rhetoric fixture showed the defect: books two and three
(one page each) read ahead of book one. The rule was corrected to the folder
place before the fix commit. A link to a sub-folder's own index found in a
group on a second pass is classified as collapsed, which keeps shaping
idempotent.

### Relabel rule, exactly

In any shaped directory group (top-level included), if the first entry is the
directory's index link and its label equals the group's label, it becomes
`Overview`, unless another link in the same group already reads `Overview`.
Top-level groups qualify because their label comes from `sections.yaml` and
usually equals the index title ("Guides > Guides"). Pagination reads labels
from the original (unshaped) tree by `href`.

## Risks (answers DM `plan.risks`)

- **Adopter breakage from the throw.** A site with an unknown slot name stops
  building. Mitigation: the message lists every valid name; the changelog
  calls it out under breaking changes; the site was already rendering the
  wrong component.
- **"Overview" collides with author content.** Handled by the duplicate guard
  (FR-007) and documented in the authoring guide.
- **Sibling overlap on the sidebar and baselines.** The Gherkin sibling
  changes `behaviour/` groups; this mission's built-HTML assertions are
  structural (every group) rather than pinning Behaviour labels, so either
  landing order passes. Visual baselines are regenerated once after rebasing
  on whichever sibling lands first.
- **`theme.ts` merge with #154.** Disjoint hunks (C-001).
- **Hidden callers of the old pagination labels.** None: `shapePagination` is
  called only by `route-middleware.ts`.

## Dependencies (answers DM `plan.dependencies`)

- No new packages.
- Upstream: Starlight route-data middleware semantics (ADR-0014), unchanged.
- CI: `update-a11y-baselines.yml` must be dispatchable for this branch
  (`workflow_dispatch`, `target_branch` input).

## Project Structure

### Documentation (this mission)

```
kitty-specs/slot-validation-sidebar-labels-01M4X4YT/
├── spec.md
├── plan.md
├── research/code-grounding.md
├── decisions/
├── tasks.md
└── tasks/WP01-*.md, WP02-*.md
```

### Source Code (repository root)

```
src/lib/theme.ts                       # DK_SLOT_NAMES, check in mergeLayers
src/lib/manifest.ts                    # doc comment only
src/lib/route-shaping.ts               # collapse, relabel, pagination labels
src/tests/theme-merge.test.ts          # resolveTheme cases
src/tests/slot-names-config.test.ts    # config-level red test (new)
src/tests/route-shaping.test.ts        # unit cases
src/tests/sidebar-build-html.test.ts   # widened built-HTML checks
example/docs/rhetoric/{introduction,preamble,about-and-license}.md
example/docs/architecture/overview.md
docs/adr/0052-*.md, docs/adr/README.md
docs/architecture/theming.md, docs/guides/authoring.md
CHANGELOG.md
tests/a11y/__screenshots__/visual.spec.ts/*.png   # regenerated in CI
```

**Structure Decision**: single package; no new modules.

## Implementation Concern Map

### IC-01 — Runtime slot-name validation

- **Purpose**: turn a misspelt slot name from a silent wrong render into a config-time error.
- **Relevant requirements**: FR-001, FR-002, FR-003, NFR-002
- **Affected surfaces**: `src/lib/theme.ts`, `src/lib/manifest.ts` (comment), `docs/architecture/theming.md`, new ADR
- **Sequencing/depends-on**: none
- **Risks**: merge with #154 in `theme.ts` (disjoint hunks)

### IC-02 — Sidebar label shaping

- **Purpose**: remove raw-id groups and repeated index labels from the shaped sidebar.
- **Relevant requirements**: FR-004..FR-010, NFR-001
- **Affected surfaces**: `src/lib/route-shaping.ts`, sidebar tests, example pages, authoring guide
- **Sequencing/depends-on**: none
- **Risks**: visual baselines; Gherkin sibling groups
