---
work_package_id: WP08
title: Per-page Atom entries
dependencies:
- WP01
requirement_refs:
- FR-020
- NFR-001
- NFR-008
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: 741f19f3fc3d5a6e9cf19caebffddeb7f100c409
created_at: '2026-11-06T09:52:28.834437+00:00'
subtasks:
- T031
- T032
- T033
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/routes/page-atom
create_intent:
- src/lib/routes/page-atom.ts
- src/lib/routes/page-atom-injected.ts
- src/lib/integrations/page-atom.ts
- src/tests/page-atom.test.ts
- src/tests/page-atom-build.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/page-atom.ts
- src/lib/routes/page-atom-injected.ts
- src/lib/integrations/page-atom.ts
- src/tests/page-atom.test.ts
- src/tests/page-atom-build.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP08 – Per-page Atom entries

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Every published, dated page gets a valid, deterministic Atom entry with no wiring, and a site can turn it off. See [contracts/page-atom.md](../contracts/page-atom.md).

**Concern**: IC-08 (Atom half). **Requirements**: FR-020, NFR-001, NFR-008.
**Depends on**: WP01.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP08 --agent <name> --mission page-chrome-01M6PBR7
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

### T031: Pure entry builder

`src/lib/routes/page-atom.ts` exports:

- `atomEligible(entry)`: `isPublished(entry.data)` and `feedDateMillis(entry.data) > 0`, and not `isDraftEntry`. The published check must hold even under `DK_PUBLISH_DRAFTS=on`, because the content graph's rule is the same. WP09 uses this for its link condition, so a link and an entry can't disagree.
- `buildAtomEntry({ title, url, updated, siteTitle, description, html })`: the document from the contract. Escape with `xmlEscape` from `routes/shared.ts`. `updated` is RFC 3339, from `feedInstant`.

**Validate**: exact-string golden for a full entry, for one with no description (no `summary`), and for one with `&`, `<` and `]]>` in title and HTML.

### T032: Route and injection

`pageAtomRoute()` follows `agentPageRoute`'s shape: `getStaticPaths` over `getCollection('docs')` filtered by `atomEligible`, with `params.slug = pageSourceId(slugFromEntryId(entry.id))`. `GET` builds from `entry.rendered.html`. The response type is `application/atom+xml;type=entry; charset=utf-8`.

`page-atom-injected.ts` and `integrations/page-atom.ts` copy the content-graph pattern (`src/lib/integrations/content-graph.ts`): pattern `/api/pages/[...slug].atom.xml`, `prerender: true`.

Recorded out-of-map edits:

- `src/package.json` exports: `"./routes/page-atom-injected"`. WP11 owns that file.
- `config.ts`: add the integration unless `pageFormats.atom === false`.

**Check**: the `.atom.xml` pattern doesn't collide with `[...slug].json` in the `/api/pages` folder, and it works under a `base`. If `site` is unset, `absolute()` decides the `id`: confirm it still yields a valid IRI, and if it can't, skip the entry and log one warning.

**Host headers**: a static host picks a header from the file extension, so `type=entry` can't be guaranteed in the response, only in the link. Say so in the contract's notes and the guide.

### T033: Tests on the built site

`page-atom-build.test.ts`:

- **NFR-008**: every `*.atom.xml` in the example's `dist` parses with `sax` in strict mode (WP11 adds it as a dev dependency), has `entry` as root in the Atom namespace, and has exactly one each of `id`, `title`, `updated` and `author`, with a valid RFC 3339 `updated`. Include a control: a fixture string with an unescaped `&` must fail the same check. A regex or `assertWellFormedXml` (private and self-described as non-validating) isn't enough.
- **Coverage**: report how many published example pages have no date, and so no entry. Assert the count, so an unintended rise goes red.
- **Content**: one page's entry contains a sentinel from that page's body.
- **FR-022's half here**: under `DK_PUBLISH_DRAFTS=on`, a draft has no entry, while a published page in the same build has one.
- **No date**: a published page with no feed date has no entry and no error. Assert a dated page in the same fixture has one.
- **Off switch**: `pageFormats: { atom: false }` yields zero entries.
- **NFR-001**: two builds of the same input give identical bytes. Add `api/**/*.atom.xml` to `MACHINE_SURFACE_GLOBS` at `draft-publication-build.test.ts:79`, and extend that suite's `off` and `offRepeat` builds to diff page HTML, which it compares today only for sidebars (recorded out-of-map edit, since this WP is NFR-001's owner).

Add a changelog fragment, `docs/changelog/unreleased/292-page-atom.md`.

## Risks

- Rendered HTML can hold relative links; `xml:base` in the contract covers them.
- Output grows by one file per page, and carries the full body. Report the example's `dist` size change in the WP's review notes.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-020, NFR-001, NFR-008) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Validate one real entry with an external Atom validator if network access allows, and say whether it ran.

Check that tests fail without the change, not only that they pass with it.
