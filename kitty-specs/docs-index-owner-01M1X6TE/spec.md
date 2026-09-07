# Mission Specification: Docs-index neutral owner + Hub dedup (#90)

**Mission Branch**: `feat/docs-index-owner`
**Created**: 2026-09-07
**Status**: Draft
**Input**: "Fold in #90 — move collectDocEntries/buildDocsIndex out of route-scoped routes/shared.ts into a neutral owner shared by routes AND components, and give collectDocEntries an opt-in body so Hub.astro can drop its last inline copy."

Behaviour-preserving cleanup (the final #85→#88 follow-up). Byte-neutral: the
built `example/dist` must be identical before and after. This mission spawns NO
further follow-ups.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Routes and components share one docs-index module (Priority: P1)
`collectDocEntries` and `buildDocsIndex` live in `src/lib/routes/shared.ts`,
whose own header calls it "plumbing for the route handlers" — yet after #88 the
three slot components import them too. Move both to a neutrally-named module
(`src/lib/docs-index.ts`) that routes and components import, retiring the
"components reach into route plumbing" implication. The docs-root resolver and
the feed helpers (`absolute`, `xmlEscape`) stay in `shared.ts` (genuinely
route-scoped).

**Independent Test**: every importer references `docs-index.js`; `shared.ts` no
longer exports `collectDocEntries`/`buildDocsIndex`; the build is byte-identical.

**Acceptance Scenarios**:
1. **Given** the routes (rss/llms-txt/agent-index/agent-page) and the three slot
   components, **When** they need the docs collection or index, **Then** they
   import from `src/lib/docs-index.ts`.
2. **Given** the move, **When** the corpus is rebuilt, **Then** `example/dist` is
   byte-identical.

### User Story 2 - Hub.astro drops its inline collection copy (Priority: P2)
`Hub.astro` inlines a `collectDocEntries`-shaped map over raw
`getCollection('docs')` because its ADR cards read `entry.body`, which
`collectDocEntries` drops. Give `collectDocEntries` an opt-in `{ withBody }` so
Hub calls it directly.

**Independent Test**: `Hub.astro` calls `collectDocEntries({ withBody: true })`;
no inline `getCollection('docs').map` remains; hub pages byte-identical.

**Acceptance Scenarios**:
1. **Given** `collectDocEntries({ withBody: true })`, **When** Hub renders,
   **Then** its ADR cards read `body` from the shared helper and the rendered
   hub pages are byte-identical (selectHubChildren is already intrinsically
   total, so the input-order change from raw to slug-sorted does not reorder).
2. **Given** the default `collectDocEntries()` (no body), **When** the feed/agent
   routes call it, **Then** their output is unchanged (body is opt-in; default
   shape is exactly as before).

### Edge Cases
- **Body cost**: body is opt-in, so the feed/agent routes never load body strings
  (default behaviour unchanged). Only Hub requests it.
- **DocEntry shape**: `body?: string` is additive/optional on `DocEntry`; no
  consumer that ignores it is affected.
- **`absolute`/`xmlEscape`/`docsRoot`**: stay in `shared.ts`; their tests and
  importers are untouched.

## Requirements *(mandatory)*

### Functional Requirements
| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Neutral docs-index module | US1 | High | Open |
| FR-002 | All importers rewired | US1 | High | Open |
| FR-003 | Opt-in body on collectDocEntries | US2 | Medium | Open |
| FR-004 | Hub uses the shared helper | US2 | Medium | Open |

### Non-Functional Requirements
| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Byte-identical corpus | A fresh build after the move is byte-identical to a pre-change build (0 differing files). | Reliability | High | Open |
| NFR-002 | Full gate suite green | Unit, build, validate/assert, CI pass. | Quality gate | High | Open |

### Constraints
| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Behaviour-preserving | No built file changes bytes. | Technical | High | Open |
| C-002 | No dependency change | No package added/upgraded/removed. | Technical | High | Open |
| C-003 | Scope | Only the docs-index move + its importers + Hub + the one affected test; docs-root and feed helpers stay in shared.ts. | Technical | High | Open |

## Success Criteria *(mandatory)*
- **SC-001**: `collectDocEntries`/`buildDocsIndex` are defined once, in `src/lib/docs-index.ts`; `shared.ts` exports neither.
- **SC-002**: `Hub.astro` has no inline `getCollection('docs').map`; it calls `collectDocEntries({ withBody: true })`.
- **SC-003**: pre/post build diff → 0 differing files.
