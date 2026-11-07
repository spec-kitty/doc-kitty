---
work_package_id: WP07
title: Sidebar icons
dependencies:
- WP06
requirement_refs:
- C-003
- C-008
- FR-026
- FR-027
- FR-028
- NFR-007
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: 3515a57e83a4b6c64606775ded15f9b0b59cb75a
created_at: '2026-11-06T12:06:43.114453+00:00'
subtasks:
- T025
- T026
- T027
- T028
- T029
- T030
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/sidebar-icons.ts
create_intent:
- src/lib/sidebar-icons.ts
- src/lib/integrations/sidebar-icons.ts
- src/tests/sidebar-icons.test.ts
- src/tests/sidebar-icons-build.test.ts
execution_mode: code_change
owned_files:
- src/lib/sidebar-icons.ts
- src/lib/integrations/sidebar-icons.ts
- src/lib/schema.ts
- src/lib/sections.ts
- src/scripts/validate-frontmatter.mjs
- src/tests/sidebar-icons.test.ts
- src/tests/sidebar-icons-build.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP07 – Sidebar icons

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Authors can set an icon on a page or section. Only used icons reach the output, as inline SVG, and an unknown name fails loudly.

**Concern**: IC-06. **Requirements**: FR-026, FR-027, FR-028, C-003, C-008, NFR-007.
**Depends on**: WP06.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP07 --agent <name> --mission page-chrome-01M6PBR7
```

## Rules for every subtask

- **Read first**: [spec.md](../spec.md), [plan.md](../plan.md) and the contracts it links.
- **Non-vacuity** (tactic `acceptance-criteria-non-vacuity`): a test that asserts absence or no change needs a positive control on the same fixture, and must go through the production path. For a build-level claim, that means real built HTML.
- **Build suites** share `example/.astro`. WP11 registers every new build test named in this mission in the serialized `build` project in `src/vitest.workspace.ts`, so you shouldn't need to edit it.
- **Varying options**: use WP11's fixture config (`DK_TEST_OPTIONS`) and frozen fixture site. Don't edit `example/astro.config.mjs` for a test, and don't compare a build with itself.
- **No DOM test environment**: jsdom is forbidden here (`toc-rail-preference.test.ts:3`). Unit tests use stubs, and behaviour proofs go in Playwright.
- **Gates**: `pnpm assert:artifacts` is part of every code WP's definition of done.
- **Byte-sensitive templates**: Astro trims whitespace differently around `{expr}` and bare elements. Rebind components rather than wrapping existing positions in conditionals, as `MarkdownContent.astro` explains.
- **Changelog**: a user-visible change adds `docs/changelog/unreleased/<issue>-<slug>.md`, and never edits `CHANGELOG.md`.
- **Out-of-map edits**: only the small ones this prompt names, or others recorded with a one-line reason in the commit message.
- **Don't commit** `kitty-ops/` or the regenerated `example/docs/glossary/**` `generated.by` stamps.
- Record subtask progress with `spec-kitty agent tasks mark-status T001 --status done --mission page-chrome-01M6PBR7`.

## Subtasks

### T025: Reuse-or-reject the Markua map

WP11 adds the dependency, so confirm `@iconify-json/fa6-solid` resolves.

#293 says to check `src/lib/markua/icon-map.ts` and reuse it if it fits. It maps Font Awesome names onto Starlight icons and drops unknown names, so it serves a different job from showing real FA glyphs. Read it, confirm or refute that, and record the reuse-or-reject verdict in the commit message and WP notes. Its header cites Starlight 0.32.6, so report whether its names still exist in 0.42.6.

### T026: Resolver

`src/lib/sidebar-icons.ts` is pure:

- `resolveIcon(name)` returns `{ svg, source: 'fa' | 'starlight' }` or `undefined`. `fa-<name>` looks up `@iconify-json/fa6-solid`'s `icons` map, reading each icon's own width, since FA viewBoxes vary.
- A bare name looks up a generated list. Starlight has no public export for its built-ins: `BuiltInIcons` is in `components-internals/Icons.js`, which `exports` doesn't reach. Generate `src/lib/sidebar-icons-builtin.json` with names and bodies, with a script and a drift test that fails on a Starlight upgrade. The build-free validator reads the same file, which also settles this WP's validator risk.
- `collectAuthoredIcons(docsDir)` reads each page's `sidebar.icon` and each registry entry's `icon`, using the raw frontmatter walk `buildDirectoryMeta` uses.
- An unknown name throws `[dk-sidebar-icons] <file or section>: unknown icon "<name>"`.

The SVG comes out with `aria-hidden="true"`, `focusable="false"`, `fill="currentColor"` and a size in `em`, so it follows the text colour. WP06's copied `a > *:not(:last-child)` rule is scoped, so `set:html` SVGs miss its margin: add alignment and margin rules for `.dk-sidebar-icon` in `disclosure.css`'s neighbour, a small global rule loaded with the custom body.

**Validate**: table tests for `fa-rocket`, a built-in, an unknown `fa-` name, an unknown bare name. Output is deterministic.

### T027: Authoring surface

Starlight's `sidebar` frontmatter schema strips unknown keys, so `sidebar.icon` would vanish. Extend it in `src/lib/schema.ts` through `docsSchema({ extend })` without losing Starlight's `label`, `order`, `hidden`, `badge` and `attrs`. Prove it with a test that all five still work.

Add `icon?: string` to the section registry in `src/lib/sections.ts`, for both `sections.yaml` and a charter's `sections.entries`. Keep the validators' parity: `validate-frontmatter.mjs` checks `sidebar.icon` against the same resolver or a generated name list, without an Astro import, since the script is build-free. It is a hard failure (FR-027). Add a registry check where `sections.yaml` is validated.

### T028: Integration and decoration

`src/lib/integrations/sidebar-icons.ts` runs at config setup: it collects authored icons, resolves them all (failing on unknown names), and serves only the used ones through a virtual module. It publishes `iconsAuthored`.

Wire it with these recorded out-of-map edits:

- `config.ts`: append the integration, and pass `iconsAuthored` into the shaping transport so `annotate` turns on.
- `route-middleware.ts`: after shaping, set `entry.dkIcon` on links by slug and on groups by `dkDir`. `sections.yaml` wins over an index page's `sidebar.icon`. Skip this when the consumer supplied their own sidebar.
- `Sidebar.astro`: replace WP06's local `false` with the real `sidebarIconsAuthored()`.

**Consumer-written sidebar**: authored icons have no effect, and the build logs one warning naming the limit. The guide documents it (WP10).

### T029: Licence comment

C-008: a page that renders a Font Awesome icon carries one HTML comment with the CC BY 4.0 notice:

`<!-- Icons: Font Awesome Free by Fonticons, Inc. (https://fontawesome.com), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) -->`

Emit it from the sublist or carrier. Every page shares the sidebar, so any FA icon in the tree means it's on every page. Pages on a site with only built-in icons carry none. Make sure Astro's compress step doesn't strip it: check `compressHTML` behaviour, and if comments are stripped, render it with `set:html`.

### T030: Tests

**Icons stay out of `example/`.** Icons are content, so config can't remove them, and one icon would switch every example build to the custom renderer: FR-006's golden, FR-005 and SC-001 would stop testing Starlight's renderer. Use a variant of WP11's frozen fixture for every icon test. #293's "the example shows an icon" is amended accordingly.

`sidebar-icons-build.test.ts`:

- **FR-026**: the SVG sits in the static sidebar for both the page and section, the label text is still there, and the SVG is `aria-hidden`.
- **FR-028**: the frozen fixture with no icons matches WP11's pre-mission golden, sidebar and CSS. Positive control: adding one icon to that fixture changes it.
- **FR-027**: an unknown name fails the build and `validate-frontmatter`, with the naming message. Control: the fixed name passes.
- **NFR-007**: `dist` holds no font file from this feature and no external icon URL. A distinctive icon nobody authored has no path data in the output.
- **C-008**: comment present with an FA icon, absent on a built-in-only fixture.

Add a changelog fragment, `docs/changelog/unreleased/293-sidebar-icons.md`.

## Risks

- The JSON is about 900 KB. Only read it when an `fa-` name is authored, so sites without one pay nothing at build time.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-026, FR-027, FR-028, C-003, C-008, NFR-007) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Grep `dist` for an unused icon's path data. Confirm no `@font-face` or CDN URL was added.

Check that tests fail without the change, not only that they pass with it.
