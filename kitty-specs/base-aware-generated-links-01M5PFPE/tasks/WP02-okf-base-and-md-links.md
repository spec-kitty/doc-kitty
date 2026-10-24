---
work_package_id: WP02
title: 'OKF export: base-aware and source-relative .md links (#237)'
dependencies: []
requirement_refs:
- FR-002
- FR-003
- FR-004
- FR-005
- NFR-002
- NFR-003
- C-001
- SC-002
- SC-003
- SC-004
planning_base_branch: fix/base-aware-generated-links
merge_target_branch: fix/base-aware-generated-links
branch_strategy: Planning artifacts for this mission were generated on fix/base-aware-generated-links. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/base-aware-generated-links unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-base-aware-generated-links-01M5PFPE
base_commit: 291eac480824e4377a1bcca7967b2b42c51542ac
created_at: '2026-10-24T14:20:08.788466+00:00'
subtasks:
- T004
- T005
- T006
- T007
- T007b
- T008
history:
- '2026-10-24: created by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/okf-export/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/okf-export/links.mjs
- src/lib/okf-export/core.mjs
- src/lib/okf-export/integration.ts
- src/scripts/export-okf.mjs
- src/lib/okf-export/conformance.mjs
- src/tests/okf-export-links.test.ts
- src/tests/okf-export.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load the `implementer-ivan` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Fix the three OKF export link defects from #237 (FR-002 to FR-005, NFR-001 and NFR-002, C-001). Read the issue body and the grounding comment first: `gh issue view 237 --comments`.

## Context (main @ 4c0d6beb)
- `src/lib/okf-export/integration.ts:26`: `siteUrl = config.site`, the origin only (D1).
- `src/lib/okf-export/core.mjs:385-391`: the `links` context. `siteUrl` is only trimmed (`:389`).
- `core.mjs:299`: `rewriteBodyLinks(raw, { ...links, pageHref: node.href ?? '/' })`.
- `core.mjs:73-77`: `bundlePathOf` maps `guides/README` to `guides/index.md`.
- `core.mjs:283-285`: `sourceOf` tries `${id}.md` and then `${id}.mdx`.
- `src/lib/okf-export/links.mjs:96-102`: `routeIndex`. `:104-111`: the `LinkContext` typedef. `:118-128`: `rewriteUrl`. D2 is at `:123`, and the fallback that loses the base is at `:127`.
- `src/scripts/export-okf.mjs:14,37`: `--site-url` is documented as the site's `site` (origin). It passes `base` and `siteUrl` into the core.
- Header comment `links.mjs:1-21` holds the rewrite policy. Update it in this WP; it is code-adjacent.

## Subtasks

### T004: Red-first test for D1
- In `okf-export-links.test.ts`, add a nested page `context/audience/agent` (href `/context/audience/agent/`) whose source links to `../../../llms.txt`.
- With `{ base: '/docs', siteUrl: 'https://docs.example.org' }` (origin only), expect `https://docs.example.org/docs/llms.txt`.
- Add a row that passes a site URL already including the base (`https://docs.example.org/docs/`). It must produce the same output, with the base not doubled. The existing row at `:52` already does this; keep it green.
- Confirm the origin-only row fails before T005.

### T005: Compose the site URL once in the core
- In `exportOkfBundle`, compute `base` as now.
- Set `origin = (options.siteUrl ?? '').replace(/\/+$/, '')`.
- Normalise `base` so it starts with `/` (`'docs'` becomes `/docs`). Apply the same rule in the CLI.
- Append the base unless `new URL(origin).pathname`, with trailing slashes trimmed, already ends with `base` on a segment boundary. That means it equals `base` or ends with `base` preceded by `/`. Examples:
  - `https://host/team/docs` with base `/docs` is unchanged.
  - `https://x.org/docs-site` with base `/site` becomes `https://x.org/docs-site/site`.
  - `https://x.org` with base `docs` becomes `https://x.org/docs`.
- Add test rows for each of these three examples.
- Update the `ExportOptions` JSDoc at `core.mjs:53-55`, and the `LinkContext.siteUrl` typedef at `links.mjs:108`: `siteUrl` is the site origin, and the base is added from `base`; passing a URL that already includes the base is tolerated.
- `integration.ts` stays as it is, apart from a clarifying comment.
- `export-okf.mjs`: the help and doc comment stay "origin". Check that the CLI forwards `base`.

### T006: Red-first tests for `.md` (D2+D3)
- Add `page('guides/README', '/guides/')`, `page('guides/add-a-session-note', '/guides/add-a-session-note/')` and `page('context/about', '/context/about/')` to the test graph.
- Give `context/about.md` and `context/audience/agent.md` sources whose bodies contain:
  - `../guides/README.md`, which should become `/guides/index.md`. Check `bundlePathOf` with the default index names.
  - `../../guides/add-a-session-note.md#steps`, which should become `/guides/add-a-session-note.md#steps`.
  - `.mdx` variant: `../guides/README.mdx` should become `/guides/index.md`.
  - Root-absolute: `/guides/README.md`. Already-based: `/docs/guides/README.md`. Both should become `/guides/index.md`.
  - Encoded: add a node `guides/a b` and link `../guides/a%20b.md`.
  - Unknown: `../nope.md` and `../../../CHANGELOG.md` stay **unchanged**. `checkOkfLinks` must report them as dangling (advisory). Today it checks only root-absolute links (`conformance.mjs:155-166`), so extend it as described in T007b. See the existing dangling-link test around `:73`.
  - Trailing slash: `../guides/README.md/` is **deliberately** not treated as a `.md` link and takes the route branch. Add one row that pins this.
  - The four example links in the #237 issue table (SC-003): reproduce each row's source link, linking page and expected bundle output as a test row.
  - A link from the root `README` source: `guides/README.md` should become `/guides/index.md`, with no `//`.
- Confirm these rows fail on the current code.

### T007: The resolution in `rewriteUrl`
- Extend the `LinkContext` typedef with `pageId: string` and `ids: Set<string>`.
- Add `export function idIndex(nodes)`, which returns the ids of page and persona nodes, alongside `routeIndex`.
- In core, build `links.ids = idIndex(graph.nodes)` from the same `graph.nodes` as `routeIndex`, and pass `pageId: node.id` at `:299`. That is the only `rewriteBodyLinks` call, and it already covers persona nodes (`core.mjs:383`). Add one persona `.md` link row.
- In `rewriteUrl`, after `splitUrl`:
  1. If `/\.mdx?$/i.test(path)`, call a helper `resolveSourceLink(path, ctx)`.
  2. In the helper, decode the path with `decodeURIComponent` inside try/catch, keeping the raw path on error.
  3. If the path is root-absolute, strip the base with the same rule as `unbased`. Otherwise resolve it with `new URL(p, 'http://x/' + dir)`, where `dir` is the `pageId` directory plus `/`, or `''` for an id with no slash.
  4. Take the pathname, decode it, strip the leading `/` and the `.mdx?` extension.
  5. If `ctx.ids.has(id)`, return `/${ctx.bundlePath(id)}${tail}`. Otherwise return `url` unchanged.
- Leave the non-`.md` branch exactly as it is.
- Keep complexity at or below 15. Split into helpers if needed.
- Update the policy list in the header comment with the `.md` rule and the "left unchanged" rule.

### T007b: Relative links in the conformance check
- In `conformance.mjs` `checkOkfLinks`, also check relative link targets, ignoring schemes, `#` anchors and `//`. Resolve each against the linking bundle file's directory and report it when no bundle file exists.
- Keep the existing root-absolute behaviour and its message shape.
- Add rows to the dangling-link test: an unresolved relative `.md` link is reported, and a correctly rewritten link is not.

### T008: Parity
- The row "resolves relative links against the page route" (`../deep/dive/`) must stay as it is. It is the regression row for generated files and routes.
- **Before T005:** on unmodified code, export the original fixture with `base: ''` and an origin. Commit the full output, every bundle file, as a fixture (an inline snapshot, or a `toMatchFileSnapshot` file under `src/tests/__snapshots__/`).
- After the fix, assert full equality with that fixture (NFR-002, SC-004). Substring rows do not prove parity. Don't loosen any existing assertion.
- Run the whole okf test set: `pnpm vitest run src/tests/okf-export*.test.ts`.

## Definition of Done
- All new rows pass, and each of D1, D2 and D3 has a row shown to fail without the fix.
- No existing assertion is weakened.
- The okf tests and the repo typecheck and lint are green.
- Two commits: `fix(okf-export): compose site URL from origin and base (#237)` and `fix(okf-export): resolve .md links against the source file by node id (#237)`. Both end with the attribution trailer.

## Risks / reviewer notes
- If a route node's id differs from its source path (custom slugs), id lookup is still correct, because ids are source paths. Verify that against `graph` construction in `src/lib/docs-index.ts`.
- `decodeURIComponent` can throw; it is guarded.
- Reviewer: check that there is no second route resolver (C-001), and that an unresolved `.md` link never becomes a site URL.

Implement with `spec-kitty agent action implement WP02 --agent claude --mission base-aware-generated-links-01M5PFPE`.
