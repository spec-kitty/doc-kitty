---
work_package_id: WP04
title: Relative Markdown link rewrite at build
dependencies:
- WP01
- WP03
requirement_refs:
- FR-011
- FR-012
- FR-013
- FR-014
- FR-021
- C-007
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: 100dbd25eace7d24b187875723f7d3dfbfd823f6
created_at: '2026-10-13T20:24:53.331713+00:00'
subtasks:
- T016
- T017
- T018
- T019
- T020
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/
create_intent:
- src/lib/remark/relative-md-links.ts
- src/tests/relative-md-links.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/relative-md-links.ts
- src/tests/relative-md-links.test.ts
- src/tests/glossary-substrate-parity.test.ts
- src/tests/helpers/remark-stack.ts
- src/tests/base-absolute-links.test.ts
- src/tests/config-invariants.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP04 — Relative Markdown link rewrite at build

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Rewrite relative links to another page's `.md` or `.mdx` file into that page's published route when the site is built, so authors can write links that also work on GitHub. First half of #131.

Requirements: FR-011 to FR-014, FR-021, C-007, NFR-001. Spec: User Story 3. Plan: IC-04 and the Design section. Research: R2 to R6.

This is the first part of the severable #131 work (C-005). Depends on WP01 (`buildRouteTable`, `resolveRelativeDocLink`, the shared walk, the unpublished-draft-paths helper) and WP03 (generated glossary pages must be in the table under their final names).

## Shared context

- **Mission documents** (read before coding): `kitty-specs/generated-page-and-link-integrity-01M4VB0N/spec.md`, `plan.md` (Design, File ownership, your concern under Implementation Concern Map), `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Node 22, TypeScript 5.9 and plain `.mjs`, Astro ^5.2, Starlight ^0.32. Do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Environment, important**: you work in a lane worktree, which starts with no `node_modules`. Run `pnpm install --offline --frozen-lockfile` once at the worktree root (the local pnpm store has everything; do not use the network and do not change the lockfile). Never run `pnpm install` or `pnpm exec` in the main checkout. Do not symlink `node_modules`. After installing, if `git status` shows mode-only changes under `src/scripts/`, revert them with `git checkout -- src/scripts`. Run tests one file at a time: `cd src && ./node_modules/.bin/vitest run tests/<file>`. Do not run a full site build (it needs a PlantUML server); CI verifies build-level gates.
- **Dependencies must be present before you start.** A lane can be cut without its dependencies' unmerged code. Check for the marker of each work package you depend on, and if one is missing, merge that dependency's lane branch into your worktree first: WP01 → `buildRouteTable` exported from `src/lib/vocabulary-core.mjs`; WP02 → `allowEmpty` in `src/lib/gherkin/options.mjs`; WP03 → `generatedIndexBasename` used in `src/lib/glossary/generate.ts`; WP04 → `src/lib/remark/relative-md-links.ts` exists; WP05 → `--strict` in `src/scripts/check-links.mjs`.
- **Line numbers** in this prompt are as of `main` at `27358fe`. Earlier work packages edit some of the same files, so locate code by symbol name, not by line.
- **Test economy** (charter DIRECTIVE_041): add a test only when it guards behaviour in the spec through an existing entry point and goes red when your fix is reverted. Strengthen an existing test before adding a new one. No test that pins code shape, no duplicate of an existing assertion. In your hand-off, give a table: each test added or changed, the regression it catches, and what already covered it.
- **Red first**: for each defect fix, show the failing assertion before the fix (command and output in the hand-off). Keep the test only if it earns its place under the rule above.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only where this prompt names it; record it in the hand-off with one line of rationale.
- **Comments and style**: match the surrounding file. This codebase comments *why* a rule exists and which requirement it serves. `tsc` checks `.ts` only here (`src/tsconfig.json` includes `*.ts`; `.mjs` files are not error-checked unless they carry `@ts-check`), so rely on tests for `.mjs` changes. Typecheck with `cd src && ./node_modules/.bin/tsc --noEmit -p .`.
- **Commits**: Conventional Commits subject (`fix(...)`, `feat(...)`, `test(...)`, `docs(...)`). If the commit hook fails for a reason unrelated to your change, report it; do not bypass silently.

## Why this is broken today

A page containing `[x](../adr/0001-x.md#status)` is published with that href unchanged. On a directory-style URL it resolves to a path that does not exist. `src/lib/rehype/base-absolute-links.ts:81` returns early for any href that is not root-absolute, and `src/lib/with-base.ts:53` does the same. ADR-0037 rejected `.md`-relative authoring because Astro does not rewrite these links; this work package makes the toolkit do it.

## Facts established by reading and probing the installed Astro (5.18.2)

- `file.path` is available to a remark plugin on the content-layer path: `content/loaders/glob.js:117-122` → `vite-plugin-markdown/content-entry-type.js:26` (`fileURL`) → `@astrojs/markdown-remark/dist/index.js:102-104`. It is an absolute path for `.md`; for `.mdx` it is the Vite id, which is real-pathed while the glob path is lexical.
- `.mdx` inherits `markdown.remarkPlugins` (`@astrojs/mdx` defaults `extendMarkdownConfig` to true).
- The content store is cleared when the Astro config digest changes (`content-layer.js:146-173`). The digest is `safeStringify(config minus vite, integrations, adapter)`, so plugin options are in it. A function serialises to `null`, a `Map` or `Set` to `{}`, and keys are **not** sorted.
- An unchanged entry is not re-rendered (`glob.js:81-91`). This is why a stale link is possible and why the table must be in the digest.
- Integration order (`config.ts:1788-1866`): diagrams → remark-directive → markua → glossary → gherkin → starlight → draft-publication → route-shaping → toc-rail → deck-split → **base-absolute-links** → sitemap… Glossary (`:1120`) and Gherkin (`:1220`) write pages in `astro:config:setup`; draft-publication (`:1565-1572`) then resolves draft state. So inside the base-absolute-links hook the generated pages are on disk and draft state is known.
- No existing plugin emits a relative `.md` href. The only remark-stage link synthesiser, `src/lib/glossary/link-node.ts:118`, emits base-prefixed absolute hrefs.

## Subtasks

### T016 — Red first

New `src/tests/relative-md-links.test.ts`. Drive the plugin through Astro's real Markdown processor, not a hand-built tree: the pattern is `src/tests/gherkin-scenario-anchors.test.ts:53-65`; add `render(md, { fileURL: pathToFileURL(absPath) })` so `file.path` is set for real. Start with the issue's acceptance case: base `/site`, source `context/product.md`, link `../adr/0001-x.md#status` → `href="/site/adr/0001-x/#status"`. Keep the failing output.

### T017 — The plugin (`src/lib/remark/relative-md-links.ts`)

- Options: `{ routes, base, docsRoot }`, all plain JSON.
- Visit mdast `link` **and** `definition` nodes (reference-style links). Do not touch `image`, `html` nodes or anything else. Raw HTML anchors are out of scope.
- Source key: take `file.path`; test it against both the lexical `docsRoot` and `fs.realpathSync(docsRoot)`; the POSIX-relative remainder is the key. If the file has no path, is outside both roots, or options are missing or empty, do nothing.
- For each node: `resolveRelativeDocLink(routes, sourceKey, url)` from `vocabulary-core.mjs`. On a result, set the url to the base-prefixed route (use the existing `withBase` seam in `src/lib/with-base.ts`; do not hand-join). On `null`, leave the node exactly as written (FR-013).
- Emit the **based** href yourself. The existing rehype pass skips an href that already starts with the base, so a section named like the base (base `/guides`, route `/guides/x/`) would otherwise stay unprefixed; a based href passes through that pass untouched.
- No mutation when nothing resolves: pages without such links must produce identical output (NFR-001).

### T018 — Wiring

`src/lib/config.ts`: `baseAbsoluteLinksIntegration(base)` is defined at `:450-462` and added at `:1848`. Give it `docsDir` and `indexBasename`. In its `astro:config:setup`:

- Resolve the docs root the way the rest of the file does (`path.resolve(process.cwd(), docsDir)`, as at `:1664`).
- Build the table: shared walk (`src/lib/docs-walk.mjs`) → `buildRouteTable(paths, { indexBasename, unpublishedPaths })`, where `unpublishedPaths` comes from WP01's `unpublishedDraftPaths` and is empty when drafts are published. The resolved publish setting is in `process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV]`, set at `config.ts:1570` by the draft-publication integration, which runs before this one. If the docs root does not exist, use an empty table (the pipeline test helper runs this hook with cwd `src/` and `config: {}`).
- Register `remarkPlugins: [[relativeMdLinks, { routes, base, docsRoot }]]` via `updateConfig`, in the same call that registers the rehype pass. `updateConfig` appends, so the plugin runs last in remark; that is intended.
- `config.ts` is owned by WP01; these edits to `:450-462` and `:1848` are the named out-of-map edits for this work package.

### T019 — Pipeline pins and `.mdx`

- `src/tests/glossary-substrate-parity.test.ts` classifies every plugin in the stack: add a `CONSCIOUS_EXCLUSIONS` entry for the new plugin with `kind: 'inert'`. Its golden tree calls `build.use(plugin)` with no options and no `file.path` (`:363`), which T017's no-op rule covers. `src/tests/helpers/remark-stack.ts` may need the plugin name.
- Because the plugin joins an existing integration, `config-invariants.test.ts:135-146`, `glossary-config.test.ts` and `markua-attributes.test.ts` should not move. If one does, fix the pin minimally and say so.
- One `.mdx` case in `relative-md-links.test.ts`: `@mdx-js/mdx` `createProcessor` with `new VFile({ path })`, reachable through the real path of `src/node_modules/@astrojs/starlight` → `@astrojs/mdx` → `@mdx-js/mdx`. Assert an inline and a reference-style link are rewritten and a raw `<a href="x.md">` is not.
- The glossary re-derive processors (`src/lib/glossary/page-processor.ts`, `src/components/slots/OnThisPage.astro:110`, `definitions-payload.ts:83`) must **not** get the plugin. `src/layouts/DeckLayout.astro:120` renders through the normal pipeline and inherits it. `src/lib/routes/agent-page.ts:66` returns the raw body, so C-007 holds without work; add no code there, and confirm in the hand-off that `agent-page.ts` has no diff.

### T020 — Freshness (FR-021)

One test in `relative-md-links.test.ts` or `config-invariants.test.ts`: run the integration's setup hook against two temp trees that differ by one renamed target (and once by a target's draft state with drafts off), capture the `updateConfig` argument, and assert that `JSON.stringify` of the plugin options differs between them and that each is identical across two runs on the same tree (determinism, NFR-004). That is the property Astro's digest depends on.

## Test list for `relative-md-links.test.ts` (keep it to these)

Through the real processor, only what the rule-level tests cannot show: the acceptance case; a reference-style definition; one unresolvable link left byte-identical; an image link untouched; a file with no path and a plugin with no options → unchanged; the `.mdx` case. The resolution matrix (index vs leaf source, README target, query and fragment, outside root, drafts, encoding) lives in WP01's `route-table.test.ts`; do not repeat it here.

One more case goes in `src/tests/base-absolute-links.test.ts`, through **both** passes (this plugin, then the rehype pass): base `/guides`, target route `/guides/x/` → `href="/guides/guides/x/"`. It proves the plugin's own base prefix survives the rehype pass's skip rule.

## Definition of done

- The acceptance case from the issue passes through the real processor.
- Example output is unaffected: the only relative `.md`/`.mdx` link under `example/docs` is `adr/template.md:16` (`XXXX-title.md`), which does not resolve. Nothing under `example/` changes.
- `relative-md-links`, `base-absolute-links`, `glossary-substrate-parity`, `config-invariants`, `markua-attributes`, `glossary-config` tests green.

## Risks and reviewer guidance

- Reviewer: confirm the options object reaching `updateConfig` is plain JSON with sorted route keys, and holds no function, `Map` or `Set`.
- Reviewer: confirm unresolved links are byte-identical in the output, so the built-link gate still reports them.
- Known limit to state in the hand-off: a rename while the dev server is running is picked up on restart; `.mdx` is rendered on every build and is never stale.
- A reference-style link inside a Markua callout whose definition sits outside it may already degrade to text before this plugin runs (`markua-normalise.ts:207-215`). Pre-existing; report if you confirm it, do not fix it here.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP04 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
