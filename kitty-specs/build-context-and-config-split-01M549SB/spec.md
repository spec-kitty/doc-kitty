# Mission Specification: One owner for build state, a smaller config.ts, and an honest agent API

**Mission Branch**: `chore/build-context-and-config-split`
**Created**: 2026-10-17
**Status**: Draft
**Input**: GitHub issues #115 and #103, grounded on `main` at ac55bbb6 (after PR #169 / ADR-0057).

## Intent Summary

- **Primary actors:** a site author or agent reading DocKitty's machine surfaces (`/api/index.json`, the sitemap); a site author setting `DK_PUBLISH_DRAFTS` in env files; a DocKitty maintainer changing the draft-publication or diagram integrations.
- **Triggers:**
  - The docs promise a `/sitemap.xml` that 404s, and an agent-API index with `_links` that it does not have (#103).
  - Two integrations pass draft-publication state through an options object one mutates and the other reads, plus a `globalThis` warning sink (#115).
  - `src/lib/config.ts` has grown to 2,298 lines.
  - DocKitty's env-file reader ignores Vite's `envDir` and any `--mode` other than `development`/`production`.
- **Desired outcome:**
  - The docs name the files the site really serves.
  - The agent-API index carries `_links` so an agent can walk the corpus by following links.
  - Draft-publication build state has one owner, with no mutation of another integration's options and no `globalThis`.
  - `config.ts` is split along its existing seams.
  - The env-file reader honours `envDir` and the active mode.
- **Rules that must always hold:**
  - Apart from the intended `_links` addition, the built example site is byte-identical to `main`.
  - Everything the public `./config` entry exports today still exports, with the same values.
- **Operator decisions (2026-10-17):**
  - Emit `_links` now, in `/api/index.json` AND in each per-page agent JSON (`/api/pages/<slug>.json`); keep the index `version` at `'2'` (additive keys do not bump it).
  - Keep the draft-only empty-group drop, already explained in code.
  - Keep redirect withholding on static output only (decision 01M549SZH3QDE24BQ4R9V24SYH).
  - Keep the env-file reader and make it honour `envDir` and `--mode` (decision 01M549T11MWQV14CCSDB4HPSN4).
  - Ship as one mission, with the #103 doc fixes first.

## Domain Language

| Term | Meaning | Avoid |
|---|---|---|
| published | A page whose `doc_status` makes `isPublished()` true. | Using "published" for a draft emitted because `DK_PUBLISH_DRAFTS=on` |
| emitted | A page that is built into the site, published or not | "published" for this |
| build state | Values one DocKitty integration computes during a build and another reads in the same process | "side channel", "context" |
| agent-API index | `/api/index.json`, the machine-readable list of pages | "read API", "HATEOAS API" |
| link relation | A named entry under `_links` (`self`, `html`, `source`, …), each an object with `href` | — |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The docs name the real sitemap (Priority: P1)

A site author follows the README and the adoption guide to find the sitemap. Today they try `/sitemap.xml` and get a 404. After this mission, every doc names `sitemap-index.xml` (and `sitemap-0.xml` where the parts matter).

**Independent Test**: no doc outside history (ADRs, changelog entries for past releases) names `/sitemap.xml` as a served path.

### User Story 2 - An agent walks the corpus by following links (Priority: P1)

An agent fetches `/api/index.json`. It finds `_links` at the top level (at least `self` and the site's other machine surfaces), and `_links` on every page record (at least `self`, `html` and `source`, plus links for resolved related pages). Following each `href` returns 200 on the built site.

**Independent Test**: on the built example, every `href` under any `_links` resolves to a file in `dist/` (or the site root for `html`), and the docs describe the shipped shape.

**Acceptance Scenarios**:

1. **Given** the built example, **When** an agent reads `/api/index.json`, **Then** the top level has `_links.self.href` pointing at the index itself.
2. **Given** a page record with related pages, **When** an agent reads its `_links`, **Then** each resolved related page has a link whose `href` resolves, and an unresolved one has none.

### User Story 3 - A maintainer changes draft publication without hidden coupling (Priority: P2)

A maintainer changes the draft-publication integration. Its build state lives in one owner that both integrations use. No integration writes into another's options, nothing hangs off `globalThis`, and the code for each integration lives in its own module.

**Independent Test**: no write into another integration's options object and no `globalThis` read or write remain in `src/lib`; the existing draft-publication and route-shaping tests pass unchanged.

### User Story 4 - A site author's env files are read the way Vite reads them (Priority: P2)

A site author keeps `DK_PUBLISH_DRAFTS=off` in `config/env/.env.staging`, sets `vite.envDir: 'config/env'`, and builds with `astro build --mode staging`. Today DocKitty ignores both, so drafts get published. After this mission, DocKitty reads the same files Vite does for that mode and directory.

**Independent Test**: with `envDir` and a custom mode set, the resolved draft setting comes from `<envDir>/.env.<mode>`; with neither set, the behaviour is unchanged.

### Edge Cases

- `envDir` set to `false` (Vite's "do not load env files"): DocKitty reads no env files.
- A relative `envDir` resolves against the site root, as Vite does.
- `--mode` absent: `development` for the dev server and `production` for a build, as today.
- A page record whose `source` cannot be computed gets no `source` link rather than a broken one.
- The bare-Node gates (`check-links` and friends) resolve the draft setting the same way the build does, including `envDir` and `--mode` (FR-010a).
- A dev-server config reload rebuilds the build state; nothing carries over (FR-008a).
- The route-shaping middleware runs in the bundled prerender module, a second module instance, so build state cannot reach it through a shared closure (FR-008).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Status | Delivery | No-op passable? |
|---|---|---|---|---|
| FR-001 | No adopter-facing doc (README, guides, architecture, context, plans other than history, the example site's own pages and README, and the bundled `agents/doc-kitty-find` skill) names `/sitemap.xml` as a served path; they name `sitemap-index.xml` (and `sitemap-0.xml` where the parts matter). | Proposed | [build] | no — about ten docs name it today |
| FR-002 | Guard (not a deliverable): no doc still says the package is not published or names an install path other than the GitHub Packages one in the consumer guide. | Proposed | [ratchet] | yes — grounding found none; pinned by a grep in the WP |
| FR-003 | `/api/index.json` carries a top-level `_links` with at least `self`, plus links to the site's other machine surfaces that exist in the build (for example `llms.txt`, `sitemap-index.xml`, and the scenario index when it is built). | Proposed | [build] | no |
| FR-004 | Every page record in `/api/index.json` carries `_links`: `self` (its per-page agent JSON, `/api/pages/<slug>.json`, only when the site serves that route — omitted otherwise), `html` (the page URL), `source` where the record has one, and `related` with one `{href, title}` per resolved related entry (none for unresolved ones). The links are added in the routes, not in the shared record builder, so other consumers of that builder do not change. | Proposed | [build] | no |
| FR-004a | Each per-page agent JSON (`/api/pages/<slug>.json`) carries `_links`: `self` (itself), `up` (`/api/index.json`), `html`, `source` where it has one, and `related` as in FR-004. | Proposed | [build] | no |
| FR-004b | The index `version` stays `'2'`; the ADR records the rule that additive keys do not bump it (DIRECTIVE_018). | Proposed | [ratchet] | yes — pinned by the existing body test; positive control: FR-003's `_links` present |
| FR-004c | Which optional machine surfaces exist (the per-page JSON route, RSS, the bibliography, the scenario index) is declared to the agent-index route by the site, with defaults matching the example; the sitemap and `llms.txt` are always linked. (The scenario index is declared because the routes cannot see whether DocKitty injected it, and C-001 rules out a new env name.) A link is emitted only for a surface that exists. | Proposed | [build] | no |
| FR-005 | Every `href` under `_links` in the built example resolves to a built file or route; a test fails if one does not. | Proposed | [build] | no |
| FR-006 | The docs that describe the agent-API index (`docs/plans/roadmap.md`, `docs/plans/features/*`, the agent-first architecture doc, and the consumer docs that list machine surfaces) describe the shipped `_links` shape and relation names. | Proposed | [build] | no |
| FR-007 | The integration-name list hard-coded in several tests comes from one shared constant derived from the integrations DocKitty actually registers. | Proposed | [build] | no — at least three test files hard-code it |
| FR-008 | Draft-publication build state has one owner, created once per `defineDocKittyIntegrations` call and shared by the draft-publication and route-shaping integrations. The draft-publication integration no longer writes into the route-shaping integration's options. The route-shaping warnings are produced per page in the render-time middleware (a second module instance), so their one `globalThis` channel stays but moves into the build-state module, which owns and documents it and clears it per config. | Proposed | [build] | no — `config.ts` ~1962 mutates; `route-shaping.ts` ~424 uses `globalThis` |
| FR-008a | Build state starts empty for each config: a dev-server config reload, or a second config in the same process, sees no state from the previous one. | Proposed | [build] | no |
| FR-009 | The diagram, Gherkin, glossary, Markua, route-shaping and draft-publication integrations each live in their own module under `src/lib/integrations/`, with shared helpers in a leaf module that imports nothing back from `config.ts`; `config.ts` keeps `defineDocKittyIntegrations`, the options and the re-exports. | Proposed | [build] | no |
| FR-010 | DocKitty's env-file reader reads from Vite's `envDir` (resolved against the site root as Vite does; `false` means no env files) and for the active mode (`--mode <x>` / `--mode=x` on the command line when given, else `development` for the dev server and `production` for a build; the mode `local` is rejected as Vite does), in Vite's file order. Values already in the process environment still win over env files. | Proposed | [build] | no — today `envDir` and custom modes are ignored |
| FR-010a | The bare-Node gates resolve the draft setting the same way: the mode from their `--mode` flag, and `envDir` from the evaluated site config. A gate that cannot evaluate the config and finds `vite.envDir` in it fails with a message naming the setting, rather than reading the wrong directory. | Proposed | [build] | no |
| FR-011 | The glossary or vocabulary docs give "published" one meaning (`isPublished()` true) and name what `DK_PUBLISH_DRAFTS=on` does ("emits drafts"). | Proposed | [build] | no |
| FR-012 | One ADR records the build-state owner, the module split, the env-file contract (`envDir`, mode), the static-only redirect withholding (kept, with its reason), and the kept draft-only empty-group drop. | Proposed | [build] | no |
| FR-013 | CHANGELOG `[Unreleased]` records `_links` (Added), the env-file reader change (Changed, naming who is affected), and the doc fixes where a site author would notice them. | Proposed | [build] | no |

### Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|---|---|---|---|
| NFR-001 | Built example output apart from `_links` | `diff -r` of example `dist/` on `main` vs the branch shows differences only in `api/index.json` and `api/pages/**/*.json` (parsing both sides shows the only difference is the added `_links` keys) and in the example pages whose text names the sitemap (FR-001), where only that text changes | Proposed |
| NFR-002 | Public `./config` export surface | the sorted list of export names and each value's `typeof` are identical before and after | Proposed |
| NFR-003 | Existing test assertions | 0 changed assertions in existing tests other than those pinning the `api/index.json` body | Proposed |
| NFR-004 | Size of `config.ts` | at most 1,000 lines after the split (from 2,298), with the six integrations of FR-009 moved | Proposed |
| NFR-005 | Packed tarball | the consumption test stays green, and every new module appears in `npm pack --dry-run` and imports from the packed tarball | Proposed |

### Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | `process.env` stays the transport for the five internal handoffs owned by `src/lib/internal-env.mjs` (ADR-0057); no new internal env names. | Active |
| C-002 | Redirect withholding is unchanged (static output only). | Active |
| C-003 | The empty sidebar group is still dropped only when the site has a draft. | Active |
| C-004 | Test import paths stay as they are; moved symbols are re-exported from `config.ts`. | Active |
| C-005 | Test economy (DIRECTIVE_041): prefer strengthening an existing test; at most one new focused test per behaviour. FR-007 needs no new test (using the constant in the existing tests is the proof); SC-001 is covered by FR-005's test. | Active |
| C-006 | The env-file reader's quoting rules stay as documented; only `envDir` and mode change. | Active |

## Success Criteria *(mandatory)*

- SC-001: An agent can reach every page and its source from `/api/index.json` by following `_links` alone, with no 404s (covered by FR-005's test). — [build] · no-op passable: no
- SC-002: A site author following the docs to the sitemap reaches it on the first try. — [build] · no-op passable: no
- SC-003: A site author's draft setting in `<envDir>/.env.<mode>` takes effect for that mode. — [build] · no-op passable: no
- SC-004: Site authors see no other difference in their built sites. — [ratchet] · no-op passable: yes (positive control: SC-001's `_links` diff is present)

## Assumptions

- Astro 5.18 does not pass the mode to `astro:config:setup` (`astro/dist/types/public/integrations.d.ts`); DocKitty reads `--mode` from the command line as Astro itself does internally. `config.vite.envDir` is available in the hook as the user wrote it.
- The gates that call `site-index-names.mjs` already evaluate the site config in a child process; that child can report `vite.envDir` as well.
- No redirect shim is added at `/sitemap.xml`; the docs name the real files.

## Out of Scope

- Making the empty-group drop unconditional.
- Redirect integrity for server output.
- Env-file quoting changes.
- Astro 7 migration (#149).
