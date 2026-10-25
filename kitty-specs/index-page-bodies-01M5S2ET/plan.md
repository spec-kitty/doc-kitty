# Implementation Plan: Export section-index page bodies

**Branch**: `fix/index-page-bodies` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/index-page-bodies-01M5S2ET/spec.md`

## Summary

#238: in `exportOkfBundle` (`src/lib/okf-export/core.mjs:445-461`), an index node (`isIndexId`) is written as the entry list only, and its README body is dropped. The fix: when the body is non-empty once frontmatter is stripped, also write a concept page at `<id>.md` (for example `guides/README.md`), built by the existing `conceptDocument`. The index then lists that page first, as a strict §8 entry. Body-less indexes take the current code path unchanged. Conformance rule 4 and link resolution are not touched.

## Technical Context

**Language/Version**: JavaScript ESM with `// @ts-check` (okf-export `.mjs`); Node 22+
**Primary Dependencies**: no new dependency (`gray-matter` is already used)
**Storage**: N/A (generated bundle files)
**Testing**: Vitest (`src/tests/okf-export.test.ts`, `src/tests/okf-export-links.test.ts`); failing tests first; the unbased snapshot `src/tests/__snapshots__/okf-export-unbased.txt` must stay byte-identical
**Target Platform**: Astro build hook (`integration.ts`) and the `export-okf` CLI (`src/scripts/export-okf.mjs`)
**Project Type**: single (toolkit package `src/`)
**Performance Goals**: N/A
**Constraints**: C-001 (emission-only), C-002 (ADR addendum only), C-003 (strict §8 index, rule 4 unchanged); complexity ≤15
**Scale/Scope**: 1 source file, 2 test files, 2 docs pages, and the CHANGELOG

## Charter Check

- **Living documentation:** the docs and the CHANGELOG change in the same change (FR-006). PASS.
- **ADRs are immutable:** ADR-0059 is changed only by a new addendum (C-002). PASS.
- **Tests:** Vitest, with a failing test first (NFR-001). PASS.
- **Writing policy:** the docs follow the audience-oriented prose rules. PASS.
- **No dependency change:** the supply-chain checks do not apply.

## Implementation Concern Map

### IC-01: Overview page emission (FR-001..005, NFR-001..003)

- Add `hasBody(source)`, which is `matter(source).content.trim() !== ''`.
- In the index branches of `exportOkfBundle`, when `hasBody`:
  - write `out.set(\`${node.id}.md\`, conceptDocument(node, source, outgoing…, nodes, indexNames, links))`;
  - pass the node to `indexDocument` as a leading entry.
- `indexDocument(index, children, indexNames, overview?)` prepends `- [title](/<id>.md)[ - desc]` before the sorted entries. When there is no overview, the output is unchanged.
- The `<id>.md` path is built directly, not through `bundlePathOf`, because `bundlePathOf` maps index ids to `index.md` by design. Links that point to the README still resolve to the index (#237 semantics).
- Personas: `exported` includes `kind: 'persona'` (core.mjs:432), and `isIndexId` looks only at the id. A persona README therefore reaches the same branch, and is covered by a test row.

### IC-02: Docs (FR-006)

- `docs/guides/export-okf-bundle.md`: replace "Known limit" (:110-113) with a description of the overview page, and amend "Indexes take the OKF form".
- `docs/adr/0059-content-graph-and-okf-alignment.md`: a new addendum for #238 that supersedes addendum item 5 (:278).
- `CHANGELOG.md` `[Unreleased]`: a `### Fixed` entry for #238.

## Design notes

- **Brownfield hazard.** Existing CLI tests write README bodies that are dropped today: `'See [setup](/docs/setup/).'` in the base-hint test at okf-export.test.ts:265, and `'Hi.'` at :313. With the fix, those bodies are exported and their links are checked:
  - The base-hint test's `single` case (one stray link means no hint) will then see two stray links, one in `setup.md` and one in `README.md`, and may print the hint.
  - The implementer must keep that test's intent: either adjust its README body, or assert the new count. The test must not be weakened.
- **No collision.** No other node can have the id `<dir>/README`, so `<id>.md` is unique. Only `index.md` and `log.md` are reserved OKF filenames.
- **Sidecar.** It is unchanged. The overview page carries the concept frontmatter derived from the node, the same as any concept page.

## Project Structure

```
src/lib/okf-export/core.mjs          # IC-01
src/tests/okf-export.test.ts         # IC-01 tests (+ CLI rows)
src/tests/okf-export-links.test.ts   # IC-01 link rows, if a better fit
docs/guides/export-okf-bundle.md     # IC-02
docs/adr/0059-content-graph-and-okf-alignment.md  # IC-02
CHANGELOG.md                         # IC-02
```

## Complexity Tracking

None. Both changed functions stay well under 15.
