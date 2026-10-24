# Implementation Plan: Base-aware links in generated outputs

**Branch**: `fix/base-aware-generated-links` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

## Summary

Two route-boundary fixes:

1. **#236:** `agentPageRoute` applies `absolute(site, record.source)` to the payload's `source`, as `agentIndexRoute` already does.
2. **#237:**
   - `exportOkfBundle` composes the site URL once from the origin plus `options.base`. It does not add the base again when the site URL already ends with it. The integration and the CLI keep passing the origin.
   - `rewriteUrl` gains a `.md`/`.mdx` branch. Such a target is resolved against the linking node's **id directory**, its extension is stripped, and it is looked up in a new node-id set. When nothing matches, the link is returned unchanged.
   - Non-`.md` links keep the current route-relative path.

## Technical Context

**Language/Version**: TypeScript 5 (routes) and JavaScript ESM with `// @ts-check` (okf-export `.mjs`); Node 22+
**Primary Dependencies**: Astro + Starlight (existing); no new dependency
**Storage**: N/A (build-time generated files)
**Testing**: Vitest unit tests (`src/tests/agent-page-includes.test.ts`, `src/tests/okf-export-links.test.ts`, `src/tests/okf-export.test.ts`); a failing test lands before each fix
**Target Platform**: static-site build (Astro build hooks) and the `export-okf` CLI
**Project Type**: single (toolkit package `src/`, example site `example/`)
**Performance Goals**: N/A (one extra Set lookup per link)
**Constraints**: C-001 (graph-only resolution), C-002 (`toAgentRecord` stays pure), C-003 (ADR addendum only); complexity ≤15
**Scale/Scope**: about 4 source files, 2 test files, 3 docs pages, and the CHANGELOG

## Charter Check

- **Living documentation:** the docs and the CHANGELOG change in the same change (FR-006). PASS.
- **ADRs are immutable:** ADR-0059 is changed only by an addendum (C-003). PASS.
- **Tests:** Vitest, with a failing test first for each defect. PASS.
- **Writing policy:** docs follow the audience-oriented prose rules, and Vale and markdownlint gate them. PASS.
- **No dependency change:** the supply-chain checks do not apply.

## Implementation Concern Map

| Concern | Files | Requirements |
|---|---|---|
| IC-1: per-page `source` absolute | `src/lib/routes/agent-page.ts`, `src/tests/agent-page-includes.test.ts` | FR-001, NFR-001, C-002 |
| IC-2: base-aware site URL | `src/lib/okf-export/core.mjs` (`exportOkfBundle` links ctx), `integration.ts` (comment only), `src/scripts/export-okf.mjs` (help text), tests | FR-002, NFR-001/002 |
| IC-3: `.md` resolution by id | `src/lib/okf-export/links.mjs` (`rewriteUrl`, an id index, `LinkContext.pageId`), `core.mjs:299` (pass `pageId: node.id`), `conformance.mjs` (relative-link check), `src/tests/okf-export-links.test.ts` | FR-003/004/005, C-001, NFR-003 |
| IC-4: docs | `docs/guides/export-okf-bundle.md`, an addendum to `docs/adr/0059-*.md`, the `links.mjs` header, `core.mjs:53`, `CHANGELOG.md` | FR-006 |

IC-2 and IC-3 both touch `core.mjs`'s links context, so they belong in one work package or must run in sequence.

## Design notes

- **Composing the site URL:**
  - Take `origin = siteUrl` with trailing slashes trimmed.
  - If `base` is non-empty and `origin` does not already end with `base`, use `origin + base`.
  - An empty `siteUrl` stays empty.
  - This also corrects the existing test at `okf-export-links.test.ts:52`, which passes a URL that already includes the base, without doubling it.
- **The `.md` branch in `rewriteUrl`:**
  1. `path` matches `/\.mdx?$/i`.
  2. Decode it with `decodeURIComponent`, wrapped in try/catch, keeping the raw path on error.
  3. If it is root-absolute, strip the base, then treat it as relative to the docs root.
  4. Otherwise resolve it against `http://x/<dirname(pageId)>/`. For the root `README`, whose directory is `''`, use `http://x/`.
  5. Strip the leading `/` and the extension to get the id.
  6. If `ids.has(id)`, return `/${bundlePath(id)}${tail}`. Otherwise return `url` unchanged.
- **Unresolved `.md` links:** `checkOkfLinks` (`conformance.mjs:155-166`) checks only root-absolute links today. It is extended to resolve relative links against the linking bundle file's directory, so that an unresolved `.md` link, which stays as authored, is reported. Fixed links are bundle-root-absolute, so they still pass the check.
- **Site URL composition, safely:** normalise `base` to start with `/` (in the core and the CLI). Append it unless the origin's URL pathname already ends with the base on a segment boundary.

## Project Structure

```text
src/lib/routes/agent-page.ts
src/lib/okf-export/{core.mjs,links.mjs,integration.ts}
src/scripts/export-okf.mjs
src/tests/{agent-page-includes.test.ts,okf-export-links.test.ts,okf-export.test.ts}
docs/guides/export-okf-bundle.md
docs/adr/0059-content-graph-and-okf-alignment.md
CHANGELOG.md (root; canonical per repo memory)
```
