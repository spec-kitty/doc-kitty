# Tasks: Audience, Related & External References

**Mission**: `audience-related-external-references-01M0S3F4`
**Branch**: `feat/audience-related-external-references`
**Spec**: [spec.md](./spec.md) (rev 2) · **Plan**: [plan.md](./plan.md) · ADRs 0017–0020

Six work packages along the Layered-landing critical path. The three block
concerns (IC-05/06/07) merge into one content-blocks WP because they share the
`MarkdownContent.astro` carrier a single WP must own. Every WP must leave `ci-ok`
(code-quality, doc-sanity, build-example, a11y) green (C-007).

## Critical path

```
WP01 foundation ──┬── WP02 catalog ──┐
                  ├── WP03 persona ───┤
                  │                   ├── WP04 content-blocks ──┐
                  └───────────────────┘                         ├── WP06 hardening
                     WP01+WP02 ── WP05 agent-surface ───────────┘
```

## Subtask Index (reference table — parallelism, not status)

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `resolveRelated(ref, index)` pure fn (+ note/description precedence) | WP01 | |
| T002 | `resolveProfile(profile, index)` pure fn (soft, null on miss) | WP01 | [P] |
| T003 | `resolveCitation(extRef, catalog)` pure fn (fail on miss/unknown catalog type) | WP01 | [P] |
| T004 | `DocKittyFrontmatter` type sync (audience/external_references/moscow) | WP01 | [P] |
| T005 | Catalog collection zod schema + loader export; lenient persona fields (schema.ts) | WP01 | |
| T006 | vitest resolver tests (hit/miss/warn/precedence) | WP01 | |
| T007 | `catalog.ts` load/resolve model | WP02 | |
| T008 | `docs/_meta/bibliography.yaml` + `tools.yaml` (real records) | WP02 | [P] |
| T009 | `example/docs/_meta/` mirror + first `{type,id}` demonstrator citation | WP02 | |
| T010 | `validate-catalog.mjs` build-free validator (parity) + wire doc-sanity | WP02 | |
| T011 | `/api/bibliography.json` route | WP02 | [P] |
| T012 | catalog unit tests | WP02 | |
| T013 | Relocate persona `personas/`→`context/audience/`; `type` Guide→Context; `doc_status`→active | WP03 | |
| T014 | Persona-field requiredness in `validate-frontmatter.mjs` (kind Persona) | WP03 | [P] |
| T015 | `Persona.astro` passport renders role/goals/responsibilities | WP03 | [P] |
| T016 | Audiences hub `context/audience/README.md` (kind Hub) | WP03 | |
| T017 | Retained draft example page (draft-exclusion subject) | WP03 | |
| T018 | Rewrite 4 hard-coded sites + recompute count pins (green at boundary) | WP03 | |
| T019 | Persona parity fixtures (valid + malformed) | WP03 | [P] |
| T020 | Carrier wiring (ADR-0017): retire no-props passthrough for 3 slots; render default bodies | WP04 | |
| T021 | `Audience.astro` (section/aria-labelledby/list; soft-resolve + warn channel) | WP04 | |
| T022 | `Related.astro` (nav "Related pages"; resolved cards) + `RelatedCard` props | WP04 | |
| T023 | Stale-target status marker (deprecated/superseded) | WP04 | [P] |
| T024 | `ExternalReferences.astro` (nav "External references"; inline + catalog) | WP04 | |
| T025 | `ReferenceItem` accessible name = title (citation key secondary) | WP04 | [P] |
| T026 | `--dk-color-tint-lilac` AA token pair | WP04 | [P] |
| T027 | Compose `resolveRelated(refs, index)` in agent routes; carry `audience` | WP05 | |
| T028 | Bump agent-API `version` (related shape change) | WP05 | [P] |
| T029 | Keep `toAgentRecord` pure; enrichment in the route | WP05 | |
| T030 | Three-block assertions in `assert-chrome-artifacts.mjs` (title-name, own-fragment, tint) | WP06 | |
| T031 | Agent-record + `/api/bibliography.json` shape in `assert-build-artifacts.mjs`; final count pin | WP06 | |
| T032 | Block demonstrator page + superseded stale-target page + `AXE_PAGES` | WP06 | |
| T033 | Catalog hit/miss/unknown-type + dangling-profile-warn fixtures (vitest) | WP06 | [P] |
| T034 | Docs of record: `metadata-model.md` + `theming.md` | WP06 | [P] |

## Work Packages

### WP01 — Foundation: resolvers + schema surface
- **Goal**: The Astro-free resolution core + the schema additions every later WP reads.
- **Priority**: P1 (foundation). **Independent test**: `pnpm test` resolver suite passes; `pnpm typecheck` clean.
- **Subtasks**: T001 T002 T003 T004 T005 T006
- **Dependencies**: none.
- **Prompt**: [tasks/WP01-foundation-resolvers-schema.md](./tasks/WP01-foundation-resolvers-schema.md) (~200 lines)

### WP02 — Citation catalog + bibliography endpoint
- **Goal**: The new build — bibliography/tools collections, build-free validator, `/api/bibliography.json`.
- **Priority**: P1. **Independent test**: build + `validate-catalog` pass; a `{type,id}` demonstrator resolves; endpoint emits records.
- **Subtasks**: T007 T008 T009 T010 T011 T012
- **Dependencies**: WP01.
- **Prompt**: [tasks/WP02-citation-catalog.md](./tasks/WP02-citation-catalog.md) (~220 lines)

### WP03 — Persona-atomic (relocation + fields + hub + pins)
- **Goal**: Reconcile personas to `context/audience/` with attribute fields + an Audiences hub, atomically, keeping every gate green.
- **Priority**: P1. **Independent test**: no persona under `personas/`; doc-sanity + build + a11y green; count pins cross-check.
- **Subtasks**: T013 T014 T015 T016 T017 T018 T019
- **Dependencies**: WP01.
- **Prompt**: [tasks/WP03-persona-atomic.md](./tasks/WP03-persona-atomic.md) (~260 lines)

### WP04 — Content blocks (rendering seam + 3 blocks)
- **Goal**: Wire the three `dk:` blocks carrier-body (ADR-0017) from resolved data.
- **Priority**: P1. **Independent test**: demonstrator renders three accessible blocks; dangling ref/citation fail the build.
- **Subtasks**: T020 T021 T022 T023 T024 T025 T026
- **Dependencies**: WP01, WP02, WP03.
- **Prompt**: [tasks/WP04-content-blocks.md](./tasks/WP04-content-blocks.md) (~300 lines)

### WP05 — Agent surface
- **Goal**: Enrich the per-page record with `audience` + resolved `related`; bump the API version.
- **Priority**: P2. **Independent test**: record carries audience + resolved related; version incremented.
- **Subtasks**: T027 T028 T029
- **Dependencies**: WP01, WP02.
- **Prompt**: [tasks/WP05-agent-surface.md](./tasks/WP05-agent-surface.md) (~150 lines)

### WP06 — Hardening: assertions, demonstrator, docs
- **Goal**: The green-boundary proof — assertions, the a11y demonstrator, fixtures, docs of record.
- **Priority**: P1 (closes the mission). **Independent test**: all four lanes green with the three blocks scanned by axe.
- **Subtasks**: T030 T031 T032 T033 T034
- **Dependencies**: WP04, WP05.
- **Prompt**: [tasks/WP06-hardening-assertions.md](./tasks/WP06-hardening-assertions.md) (~220 lines)

## MVP scope

WP01+WP02+WP03+WP04 deliver the visible feature (the three rendered blocks + persona
home + catalog). WP05 (agent surface) and WP06 (hardening/docs) complete the mission.
