---
work_package_id: WP01
title: Spike and go/no-go (#142)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- SC-001
- SC-002
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: researcher-robbie
authoritative_surface: docs/architecture/research/
create_intent:
- docs/architecture/research/astro7-starlight-041-migration-spike.md
execution_mode: planning_artifact
owned_files:
- docs/architecture/research/astro7-starlight-041-migration-spike.md
role: researcher
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load the assigned profile with `/spk-charter-profile-load researcher-robbie`
before reading anything else. Then load `spec-kitty charter context --action implement`.

## Objective

Find out, with evidence, what breaks when DocKitty moves from Astro 5 /
Starlight 0.32 to Astro 7 / Starlight 0.41+ with remark/rehype kept on
`markdown.processor: unified()`. Deliver a research note and a draft #142
findings comment, then **stop** and report go/no-go to the operator.
Covers FR-001…FR-007, SC-001, SC-002.

The version bumps themselves are **throwaway**: make them on a scratch branch
(`spike/astro7`, never pushed, never merged). The only file this WP commits is
the research note. On GO, WP03 redoes the bump properly.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The
execution worktree comes from `lanes.json` via
`spec-kitty agent action implement WP01 --agent claude --mission astro7-starlight-migration-01M57Y2C`.
Create the scratch branch from the WP01 worktree HEAD and return to the lane
branch to commit the note.

## Subtasks

### T001 — Bump on a scratch branch

1. `git switch -c spike/astro7` in the worktree.
2. In `src/package.json` (devDependencies and peerDependencies) and
   `example/package.json`: `astro` to the latest 7.x (≥ 7.0.2),
   `@astrojs/starlight` to the latest ≥ 0.41, add `@astrojs/markdown-remark`
   (latest matching Astro 7). Bump `@astrojs/sitemap` / `@astrojs/check` if
   peers require it; record each forced companion bump.
3. Set `markdown: { processor: unified() }` where the toolkit builds its Astro
   config (`src/lib/config.ts`; find where `markdown` is assembled), importing
   `unified` from `@astrojs/markdown-remark`.
4. `pnpm install` (no frozen lockfile on the scratch branch). Record each
   resolved version and its publish date (`pnpm view <pkg>@<v> time`) for the
   supply-chain table. If the workspace minimum-release-age policy blocks a
   version, record it; do not add an exclusion silently.

### T002 — Run everything, record failures

Run each and capture the first meaningful failure plus a count:
- `pnpm build` (example), with `pnpm clean` first.
- Packed consumer fixture, as `.github/workflows/consumption-test.yml` does
  (read the workflow; pack `src/`, install the tarball in
  `tests/consumption/consumer-fixture`, build).
- `pnpm assert:artifacts`, `node src/scripts/assert-chrome-artifacts.mjs`, and
  any other `assert:*` scripts in the root `package.json`.
- Vitest (`pnpm -C src test` or the root script).
- Playwright a11y suite. If the pinned Chromium differs, point
  `PLAYWRIGHT_BROWSERS_PATH` at a scratch dir symlinking
  `/opt/pw-browsers/chromium_headless_shell-1194`. Never run `playwright install`.
- Record **what fails** (wrong output, missing element, changed bytes), not
  only stack traces. Run the same suite on `main` for any failure that might
  be pre-existing; the three known local screenshot drifts (visual brand home
  ×2, layout-geometry 1280px collapsed) are environment drift.
- Fix forward only as far as needed to reach the next failure (e.g. a small
  temporary shim), and record each shim as a breakage with its real fix.

Group every breakage: Markdown pipeline · Starlight overrides/config (the five
carriers, route middleware, `locals.starlightRoute`, head merging) · Rust
compiler strictness · content loader (`docKittyDocsLoader`, Zod) · build hooks
(sitemap-order incl. #188 root-canonical rewrite, favicon, manifest) · diagram
stack (`@beoe`, `astro-plantuml`) · Pagefind · gates. State "checked, clean"
for empty categories.

### T003 — Changelog audit [P]

Read the Astro v6 and v7 release notes/upgrade guides and the Starlight
changelog 0.33 → 0.41 (from the packages' `CHANGELOG.md` in `node_modules`
if the web is blocked; github.io is blocked by the proxy). List every entry
that touches DocKitty with the file it affects. Include: Zod major, content
layer/loader API, `Astro.glob`, compiler changes, `remarkPlugins`
deprecation, Starlight component-override and route-data changes, cascade
layers, head handling, Pagefind, sitemap, Node version floor.

### T004 — Per-plugin proof

For each plugin registered via `src/lib/config.ts` and
`src/lib/integrations/markdown-pipeline.ts`, name an output marker on an
example page and show it is present in the built HTML (grep `example/dist`):
deck split, relative-md-links (ADR-0047), base-absolute-links, diagram meta,
Mermaid (`@beoe`), PlantUML, glossary, Markua (run the #113 re-derive parity
test), footnotes (ADR-0041). A plugin with no output is **lost**.
Answer #143: does `updateConfig({ markdown: { remarkPlugins } })` from an
integration still append under `unified()`? Show the evidence (plugin order
and output), and note any deprecation warning text Astro prints.

### T005 — #188 canonical re-check

Starlight 0.32's `mergeHead` dropped earlier `<link>`s once a page head
carried its own canonical, so #188 rewrites built HTML in the sitemap-order
hook. Check 0.41's head merge: does the drop still happen? Is the rewrite
still needed, still correct, or now harmful? Record the answer.

### T006 — Note, comment draft, resize proposals

Write `docs/architecture/research/astro7-starlight-041-migration-spike.md`
with full DocKitty frontmatter (`title`, `description`, `doc_status`,
`updated` as a UTC timestamp, `type`, `kind`, `tags`, `related`), sentence-case
headings, no AI-writing tells. Sections: summary verdict, versions and
supply chain, breakage table (category, what fails, file, cause, fix,
ticket), changelog audit, plugin proof table, #143 answer, #188 answer,
gate results, proposed resizes or splits of #119/#144/#145/#146.
Run `pnpm validate:docs` and `pnpm validate:links`. Draft the #142 comment
(do not post it until the operator sees the report; the orchestrator posts).
Do **not** edit any epic issue.

### T007 — Report and stop

Commit only the note to the lane branch. Mark subtasks done. Report go/no-go
evidence to the orchestrator. GO criteria: every breakage has a known fix
that fits the epic's tickets, no plugin is lost under `unified()`, the
diagram stack renders. Anything else is no-go.

## Definition of Done

- Note committed, validated; `spike/astro7` not pushed.
- Every failure mapped to a ticket or marked environment drift.
- Explicit GO/NO-GO recommendation with evidence.

## Reviewer guidance

Check that each plugin claim cites a concrete marker in built HTML, that
failures are described as behaviour, and that no category is silently empty.
