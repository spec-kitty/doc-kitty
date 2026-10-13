---
work_package_id: WP05
title: Draft publication setting
dependencies:
- WP04
requirement_refs:
- FR-013
- FR-014
- FR-015
- FR-016
- FR-017
- FR-018
- SC-005
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-sidebar-frame-header-carrier-01M4T3CB
base_commit: 7b70b11bebee33665a2219fd06f3d262062e2c3d
created_at: '2026-10-13T08:25:10.284738+00:00'
subtasks:
- T026
- T027
- T028
- T029
- T030
- T031
- T032
history: []
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/draft-publication.mjs
- src/tests/draft-publication.test.ts
- src/tests/draft-publication-build.test.ts
- example/.env.development
execution_mode: code_change
owned_files:
- src/lib/draft-publication.mjs
- src/lib/schema.ts
- src/components/Head.astro
- src/scripts/check-links.mjs
- src/scripts/assert-build-artifacts.mjs
- src/scripts/assert-no-broken-links.mjs
- src/tests/draft-publication.test.ts
- src/tests/draft-publication-build.test.ts
- example/.env.development
- example/astro.config.mjs
- .github/workflows/deploy.yml
- .github/workflows/ci.yml
- .github/actions/build-example/action.yml
- tests/a11y/routes.ts
role: implementer
tags: []
tracker_refs: []
---

# WP05 — Draft publication setting

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`node-norris`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Introduce one environment setting, `DK_PUBLISH_DRAFTS`, that decides whether draft pages are emitted, listed in navigation and left indexable. Default off. The project's live deployment runs with it off; local development runs with it on.

Requirements: FR-013, FR-014, FR-015, FR-016, FR-017, FR-018; supports NFR-006 and SC-005. Research: R8. Contract: `contracts/public-surface.md` section 2.

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## What happens today

A page is a draft when `doc_status` is `draft` or absent (`isPublished` in `src/lib/metadata.ts`; schema default in `src/lib/schema.ts`). Drafts are excluded from the sitemap (`sitemapDraftFilter` in `src/lib/config.ts`), the feeds, `llms.txt` and the agent index, and from Hub child listings (`src/lib/hub-children.mjs`). But the pages are still **built**, appear in the **sidebar**, and carry no `noindex`.

On the published example site eight draft pages return 200 and seven are in every sidebar:
`/context/audience/draft-persona/`, `/adr/template/`, `/plans/`, `/plans/missions/mission-alpha/`, `/plans/missions/mission-beta/`, `/guides/markua-footnotes-showcase/`, `/guides/markua-footnotes-malformed/`, plus the unlisted `/presentations/draft-preview/`.

## Target behaviour

| Surface | `off` (default) | `on` |
|---|---|---|
| Draft page emitted | no | yes |
| Sidebar entry | no | yes |
| Search index | no | no |
| Robots meta | n/a | `noindex` |
| Sitemap, feeds, `llms.txt`, agent index | excluded | excluded |

## Subtask T026 — Pure resolver

**Steps**: create `src/lib/draft-publication.mjs` (pure ESM so both the TypeScript integration and the `.mjs` gate scripts can import it — the same two-layer pattern as `src/lib/vocabulary-core.mjs`; add JSDoc types, no `.d.ts`):

```js
export const DK_PUBLISH_DRAFTS_ENV = 'DK_PUBLISH_DRAFTS';
/** @returns {boolean} true when drafts are published */
export function resolvePublishDrafts(env = process.env, fileEnv = {}) { … }
```

- Precedence: `env[DK_PUBLISH_DRAFTS]` if defined and non-empty, else `fileEnv[DK_PUBLISH_DRAFTS]`, else `off`.
- Accepted values: `on`, `off` (trim; case-insensitive).
- Anything else: throw an `Error` whose message contains the setting name and both accepted values, and the offending value (FR-017).
- Follow the shape of `resolveDiagramMode(env)` in `config.ts`, which is the house precedent for an env-driven mode.

## Subtask T027 — Resolve the setting in the integration, env files included

**Steps**:
1. In the integration (`src/lib/config.ts`; owned by WP04 — this is a named, permitted out-of-map edit: add the resolution call and thread the boolean; keep the diff small and record it), resolve the setting once. For the file layer use Vite's `loadEnv(mode, root, 'DK_')` from the `vite` package Astro already depends on (no new dependency; confirm it is importable from the toolkit package and from a consumer install — if it is not resolvable from a packed consumer, read the env files with a minimal parser instead and say so). `mode` is `development` for `astro dev` and `production` for `astro build`; the Astro `command` in `astro:config:setup` tells you which.
2. That gives: `example/.env.development` applies to the dev server only; a plain `.env` applies to both; the process environment overrides both.
3. Export the resolved value to the places that need it at build time. `config.ts` already publishes `DK_DOCS_ROOT` by writing `process.env` for the content loader (around line 1229); use the same seam and say so in the comment, or pass it through the virtual manifest module if that is cleaner for components.
4. Print one line at build start stating whether drafts are published and where the value came from (process env, env file, or default).

## Subtask T028 — Filter drafts where the docs collection loads

**Steps**:
1. `docKittyDocsLoader()` in `src/lib/schema.ts` wraps the docs loader. When the setting is off, drop entries whose `doc_status` is `draft` or absent **before** they reach the collection. Astro loaders write to a store; filter there (inspect how the wrapper delegates to Starlight's `docsLoader`/`glob` and intercept `store.set`, or post-filter in `load()`), keeping the wrapper's existing behaviour for index basenames and docs root.
2. Never filter the site root page.
3. The glossary, bibliography and tools loaders are unaffected.
4. With the setting on, behaviour is exactly as today.
5. Consumers who do not use `docKittyDocsLoader` (the function's comment describes that case): document that the setting then has no effect on emission, and make the integration warn once if the setting is explicitly `off` but drafts are present in the collection.

**Knock-on effects to check**:
- `draftRoutes()` / `sitemapDraftFilter` read the file system, not the collection: still correct in both modes.
- `src/lib/hub-children.mjs` draft exclusion: still correct.
- WP04's sidebar shaping: a group whose index page is a filtered draft must get the fallback label without a "missing title" warning; a group with no published children must not appear. Pass the set of filtered directories to the shaping call (WP04 left a parameter for it).
- Redirects in `example/astro.config.mjs` that target a draft route would 404 when off: check the redirect-coverage gate in both modes.

## Subtask T029 — `noindex` for published drafts

**Steps**: in `src/components/Head.astro`, when the setting is on and the current entry is a draft, emit `<meta name="robots" content="noindex">`. Use the existing published/draft predicate (`isPublished` in `src/lib/metadata.ts`). Also make sure Pagefind does not index the page (Starlight supports `pagefind: false` per page; alternatively add `data-pagefind-ignore` at the right level — pick the mechanism that works from a carrier and test it by checking the built search index or the attribute in the HTML).

## Subtask T030 — Gate scripts

**Steps**: `src/scripts/check-links.mjs`, `assert-no-broken-links.mjs`, `assert-build-artifacts.mjs` and any other gate that enumerates expected pages: read each, and where it assumes a draft page exists in `dist`, make it consult `resolvePublishDrafts()`. With the setting off, a link from a published page to a draft must be **reported** as broken, not silently accepted. Check `src/scripts/` for other scripts that walk the docs tree and list in your hand-off which ones you examined and whether they needed a change.

## Subtask T031 — Env file, CI lanes and the live deployment

**Steps**:
1. `example/.env.development`: `DK_PUBLISH_DRAFTS=on` with a two-line comment. Confirm `.gitignore` does not exclude it (add a negation if it does — a recorded out-of-map edit).
2. `.github/actions/build-example/action.yml` and `.github/workflows/ci.yml`: the PR-gate example build runs with `DK_PUBLISH_DRAFTS: 'on'`, so the a11y routes, URL baseline and fixtures that include draft pages keep their coverage. Add a second, cheaper step or job that builds with `off` into a separate output directory (`DK_OUTDIR`, already supported by `example/astro.config.mjs`) and asserts: none of the eight draft routes exists; no built page links to one; the link gate is clean.
3. `.github/workflows/deploy.yml`: set `DK_PUBLISH_DRAFTS: 'off'` explicitly in the build job's `env`, and update the comment that says the deploy build is identical to the PR-gate build to state this one intended difference and why (FR-018).
4. `tests/a11y/routes.ts`: if it lists draft routes, keep them (the Playwright lane builds with `on`), and add a comment saying so.
5. Workflows pin actions by commit SHA; follow that if you add a step.

Do **not** repair the unrelated failing steps in `deploy.yml` (browser download) or `nightly.yml`; that is a separate fix outside this mission.

## Subtask T032 — Tests

1. `src/tests/draft-publication.test.ts` (unit): default off; `on`/`off`/case/whitespace; process env beats file env; empty string falls through; invalid value throws with the setting name and accepted values.
2. `src/tests/draft-publication-build.test.ts` (built output; follow the existing build-project tests and note the project lesson that a second build must use its own output directory so it does not clobber `dist`): with **off** — each known draft route is absent, no sidebar contains a draft href, the sitemap/feed/`llms.txt`/agent index list none; with **on** — each draft route exists, has the `noindex` meta, appears in the sidebar, and the machine surfaces still list none. Both halves on the same fixture, as the spec requires for FR-015.
3. Determinism: two builds with the same value give byte-identical sidebars (NFR-006) — a cheap check on two pages is enough.

## Verification

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm validate`; `DK_PUBLISH_DRAFTS=on pnpm build` and `DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build`; link gate against both outputs; `DK_PUBLISH_DRAFTS=maybe pnpm build` fails with the documented message.

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP05 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- `resolvePublishDrafts` exists, is shared by the integration and the gates, and is unit-tested.
- Default is off; an invalid value stops the build with a clear message.
- With off: zero draft pages, zero draft sidebar entries, clean link gate. With on: drafts built, listed, `noindex`, not in search.
- Machine surfaces exclude drafts in both modes.
- `example/.env.development` turns drafts on for the dev server only; CI builds with on and asserts an off build; the deploy workflow sets off explicitly.
- Out-of-map edits to `src/lib/config.ts` (and `.gitignore` if needed) are listed with rationale.

## Risks

- **Loader interception** is the technically delicate part; if Starlight's loader cannot be filtered cleanly, fall back to Starlight's own per-entry `draft` flag set from `doc_status` in the wrapper and explain the trade-off — but the off build must still emit no draft page.
- **Published pages linking to drafts** will surface as broken links when off. Fix the links in the example content (or mark the linking page draft); do not weaken the gate.
- **Env-file loading from a packed consumer** (T027 step 1).
- **Existing tests** that assume draft pages in `dist` (hub draft-exclusion guard, a11y routes, URL baseline): run the full unit suite early.

## Reviewer Guidance

- Build both modes and list the draft routes present in each.
- Confirm precedence: process environment over env file over default.
- Confirm the deploy workflow has the explicit off and an accurate comment.
- Confirm no gate was loosened to get to green.
