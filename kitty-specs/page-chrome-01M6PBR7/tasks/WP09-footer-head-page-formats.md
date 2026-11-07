---
work_package_id: WP09
title: Footer group, page formats, source link and head links
dependencies:
- WP01
- WP08
requirement_refs:
- FR-001
- FR-003
- FR-004
- FR-019
- FR-021
- FR-022
- FR-023
- FR-024
- FR-025
- NFR-003
- NFR-009
- SC-004
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: bdf541abb21efaf21807eda9524e51d2538c035c
created_at: '2026-11-06T11:21:31.716637+00:00'
subtasks:
- T034
- T035
- T036
- T037
- T038
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/slots/MachineEntryPoints.astro
- src/components/slots/PageFormats.astro
- src/lib/page-formats.ts
- src/tests/page-formats.test.ts
- src/tests/footer-links-build.test.ts
- tests/a11y/footer-links.spec.ts
execution_mode: code_change
owned_files:
- src/components/Footer.astro
- src/components/Head.astro
- src/components/slots/MachineEntryPoints.astro
- src/components/slots/PageFormats.astro
- src/lib/page-formats.ts
- src/themes/spec-kitty/components/brand-components.css
- example/astro.config.mjs
- src/tests/page-formats.test.ts
- src/tests/footer-links-build.test.ts
- tests/a11y/footer-links.spec.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP09 – Footer group, page formats, source link and head links

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

From any page, a reader or agent reaches the site's machine entry points and that page's formats. Nothing links a surface the site doesn't serve. See [contracts/page-formats.md](../contracts/page-formats.md).

**Concern**: IC-07 (footer half), IC-08 (links half). **Requirements**: FR-001, FR-003, FR-004, FR-019, FR-021, FR-022, FR-023, FR-024, FR-025, NFR-003, NFR-009, SC-004.
**Depends on**: WP01, WP08.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP09 --agent <name> --mission page-chrome-01M6PBR7
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

### T034: Machine entry points group

`MachineEntryPoints.astro` renders [the nav in the contract](../contracts/page-formats.md) from `servedSurfaces()`: LLM index, agent API index, content graph, RSS, sitemap (`sitemap-index.xml`), bibliography, scenarios, OKF bundle (`okf/index.md`). Each uses `withBase`, and only if true. The MCP pointer isn't linked, since it's an npm package, not a URL on the site. `chromeOptions().footer.machineEntryPoints` turns it off (`false`) or sets its label, and the nav's `aria-label` follows that label.

Mount it in `Footer.astro` as a bare element between Starlight's article footer and the `dk:site-footer` host, so it renders with and without the theme and reads before the brand band. Use rebinding (`false` maps to `EmptyFragment`). When there's nothing to show, it renders nothing. A literal `<nav>` is right here: Pagefind excludes it, which we want for these links.

Scoped styles: inline-flex links, a minimum of 24×24, and a focus ring (NFR-003).

### T035: Page format helper

`src/lib/page-formats.ts` exports a pure `pageFormatLinks({ entry, surfaces, options, base, indexBasename })` returning `PageFormatLink[]`, per the table in `plan.md`:

- **No links**: the entry isn't in the docs collection (404 or OpenAPI pages), or it's a draft (`isDraftEntry`), even under `DK_PUBLISH_DRAFTS=on`.
- **JSON**: if `surfaces.agentPages`. `/api/pages/<pageSourceId(slug)>.json`.
- **OKF**: always for a published page, at `/okf/<bundlePathOf(id, indexBasename)>`, type `text/markdown`. Reuse `bundlePathOf` from `src/lib/okf-export/core.mjs`, since OKF paths follow source files. Graph node ids are the source path without its extension.
- **Atom**: if `surfaces.pageAtom` and `atomEligible(entry)` from WP08.

**Validate**: table tests including a nested README, a custom `indexBasename`, a draft, and the root page. A build test (T038) checks every generated href exists in `dist`.

### T036: Source link

In the same module, `sourceLink(entry, repository)`, returning `undefined` when:

- `repository` is unset (FR-024), or
- `isGeneratedStamp(entry.data.generated?.by)`, so generated glossary and Gherkin pages get none, or
- the entry has no `filePath`.

The URL is built from the host's view pattern, with `siteDir` prefixed on `entry.filePath`:

| Provider | Pattern |
|---|---|
| github | `https://github.com/<repo>/blob/<branch>/<path>` |
| gitlab | `https://gitlab.com/<repo>/-/blob/<branch>/<path>` |
| bitbucket | `https://bitbucket.org/<repo>/src/<branch>/<path>` |

These are the hosted services only. A self-hosted GitHub, GitLab or Bitbucket Server instance isn't covered, which the guide states. Encode path segments. Don't reuse or modify `editLink` (C-006).

Set `repository` in `example/astro.config.mjs` to `spec-kitty/doc-kitty`, branch `main`, and `siteDir: 'example'`, so the example shows it.

### T037: Components and head

- `PageFormats.astro` renders the nav from both helpers, with `dk-pill dk-pill--neutral` on each link. `rel="alternate"` and `type` go on the format links, and the source link has neither. Mount in `Footer.astro` after `MachineEntryPoints`.
- **FR-025**: `.dk-pill` is styled by the spec-kitty theme only, at `brand-components.css:56`. It has no colour without a tone class and no hover or focus rule, so add `a.dk-pill` hover and focus there. Don't add pill CSS outside the theme (C-004). The pill computes to about 18px tall, so the 24×24 minimum in the component's scoped style is essential. Check that scoped rule wins over the theme's.
- **FR-019, FR-021**: `Head.astro` emits `<link rel="alternate">` for RSS and llms.txt if served, then one per format link, in that fixed order. The same helper feeds both places.
- Remove `discoveryHead` from `config.ts:349-369` and its call at `:728` (recorded out-of-map edit). `theme-favicon.test.ts:196,204` asserts on those head entries and needs updating; `absolute-url-base` has only a comment.

### T038: Tests and gates

`footer-links-build.test.ts`, on the built example and on WP11's unthemed fixture config:

- **FR-001**: footer links llms.txt, `/api/index.json`, `/api/content-graph.json`, `/rss.xml`, `/sitemap-index.xml`, `/api/bibliography.json` and `okf/index.md`, in both builds.
- **FR-003, FR-021**: on WP01's frozen fixture, build with `rss.xml.ts`, assert RSS in footer and head, delete it, rebuild, and assert neither has it while the other surfaces remain. Also a no-`site` build has no sitemap link.
- **FR-004**: off and relabelled builds.
- **FR-019**: a page's three format hrefs each exist in `dist`, and its footer set equals its head set.
- **FR-022**: under `DK_PUBLISH_DRAFTS=on`, a draft has none, and a published page in the same build has them.
- **FR-023, FR-024**: an authored page's source link is the exact expected URL. A generated page in the same build has none. A build with no `repository` has none on the authored page.
- **FR-025**: `dk-pill` CSS exists in the themed build and not in the unthemed.
- **NFR-009**: the gate passes on root and based builds. The example's `base` is hard-coded, so build root and based fixtures as `legacy-html-redirects-build.test.ts` does. The gate reads `<a href>` only, so head links rely on this file's own check. Confirm it treats `.md` and `.atom.xml` as files.

Append footer-group checks to `assert-chrome-artifacts.mjs` (WP04 owns the file; this is a recorded edit in a separate region), so removing one fails the gate. `tests/a11y/footer-links.spec.ts`: target size, focus ring, and Axe in light and dark. Add changelog fragments, `docs/changelog/unreleased/290-machine-entry-points.md` and `docs/changelog/unreleased/292-page-formats.md`.

## Risks

- Footer and Head run on every page, so a slow helper costs per-page. `servedSurfaces()` should parse once and cache per value.
- The `dk:head` theme slot and `HeadShare` must keep working. New links render outside that branch.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-001, FR-003, FR-004, FR-019, FR-021, FR-022, FR-023, FR-024, FR-025, NFR-003, NFR-009, SC-004) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Pick a page, follow every footer link in `dist`, and confirm head and footer list the same formats.

Check that tests fail without the change, not only that they pass with it.
