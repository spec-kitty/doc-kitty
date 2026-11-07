---
work_package_id: WP10
title: Consumer docs, upgrade note and final verification
dependencies:
- WP02
- WP04
- WP05
- WP06
- WP07
- WP09
requirement_refs:
- C-005
- C-006
- FR-029
- NFR-001
- SC-006
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
subtasks:
- T039
- T040
- T041
- T042
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/
create_intent:
- docs/migrations/page-chrome-defaults.md
- docs/architecture/page-chrome.md
execution_mode: planning_artifact
owned_files:
- docs/guides/consumer-setup.md
- docs/migrations/page-chrome-defaults.md
- docs/architecture/page-chrome.md
- docs/architecture/collapsible-toc-rail.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP10 – Consumer docs, upgrade note and final verification

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `curator-carla`, or run
  `spec-kitty agent profile show curator-carla`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

A site owner can upgrade without surprises, and the docs describe what shipped. Run the whole gate suite once against the merged lanes.

**Concern**: IC-09. **Requirements**: FR-029, SC-006, C-005, C-006, NFR-001.
**Depends on**: WP02, WP04, WP05, WP06, WP07, WP09.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP10 --agent <name> --mission page-chrome-01M6PBR7
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

### T039: Consumer guide

In `docs/guides/consumer-setup.md`, add each option from [contracts/config-options.md](../contracts/config-options.md) with its default and a short example: `sidebar.collapsed`, `sidebar.titleIsIndex`, `metadataBlocks`, `footer.machineEntryPoints`, `pageFormats.atom`, `repository`.

Authoring: `sidebar.icon` and `icon` in `sections.yaml`, the `fa-<name>` and bare naming, and precedence.

Document these limits:

- A consumer-written sidebar isn't reshaped, and gets no icons (FR-029).
- Only standard route paths are detected, so a custom `indexPath` isn't linked.
- A published page with no date gets no Atom entry.
- Generated pages show no source link until the edit-link work, see #150.
- `repository` covers the hosted GitHub, GitLab and Bitbucket services, not self-hosted ones.
- Atom's `type=entry` is in the link. A static host's response header depends on the host.

Note the Font Awesome CC BY 4.0 comment (C-008). This is a statement of what the toolkit does, not legal advice.

### T040: Upgrade note

`docs/migrations/page-chrome-defaults.md` has frontmatter per the convention (`title`, `description`, `doc_status`, `updated`, `kind`). It lists what changes for a site with no config changes:

- Sidebar groups start collapsed. Restore with `sidebar: { collapsed: false }`.
- Metadata blocks start collapsed. Restore with `metadataBlocks: { collapsed: false }`.
- A hub's cards come before its metadata blocks.
- The footer gains a group, and pages gain format links.
- New Atom files in the output. Turn off with `pageFormats: { atom: false }`.
- `_links` in the agent index no longer names an unmounted surface.

Verify each restore by name against the shipped config. SC-005 says two settings restore the sidebar and blocks.

### T041: Architecture page

`docs/architecture/page-chrome.md` explains served-surface detection, the conditional sidebar renderer and why it's guarded by a parity test, the hub placement rule and the disclosure upgrade, each linking ADR-0075 and ADR-0076. A landing page teaches, then links, and follows the charter's writing rules.

Update `docs/architecture/collapsible-toc-rail.md` to point at `src/lib/disclosure/`. Add the new page to the section's index if one lists children by hand.

### T042: Whole-mission verification

Run the [quickstart](../quickstart.md) on the merged lanes, and record the results in the WP's review notes:

```bash
pnpm test
pnpm build && pnpm assert:artifacts && pnpm assert:no-broken-links
pnpm validate && pnpm validate:docs && pnpm validate:changelog && pnpm validate:adr-ids
pnpm build:a11y && pnpm test:a11y
```

`build:a11y` omits `dist-nodrafts`, which Playwright's second server needs, and WP11 adds further dists. Use WP11's documented command for all of them.

**SC-006**: pack the toolkit and build `tests/consumption/consumer-fixture` with no config changes, once from `a03080e` (the mission's base on `main`) and once from the merged lanes, following the steps the consumption test uses. Diff the two. It builds with no errors, and its changes match the upgrade note.

**Visual baselines**: twelve PNGs in `tests/a11y/__screenshots__/visual.spec.ts/` will change. Report this to the orchestrator, who dispatches `update-a11y-baselines.yml` on the branch after lanes merge (`visual.spec.ts:12-37`). Don't regenerate them locally.

**SC-001 to SC-005**: walk each with the built example, and record the evidence. A failure goes back to the owning WP; don't patch it from here.

Check `C-005` and `C-006` by grep: no citation format or `editLink` changes in the mission's diff.

## Risks

- T042 needs the other lanes merged. The dependency list ensures that.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-029, SC-006, C-005, C-006, NFR-001) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Check every option named in the docs against the shipped types.

Check that tests fail without the change, not only that they pass with it.
