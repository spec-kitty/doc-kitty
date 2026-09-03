# Work Packages: Adopter loader & migration

**Mission**: `adopter-loader-migration-01M1KKYA` | **Branch**: `feat/adopter-loader-migration`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Build order US1 → US2 → US3. WP01 is the MVP (the derivation/loader seam that everything else demonstrates). Every WP is ATDD red-first: the failing test lands before the fix.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red-first tests: `index-basename.test.ts` + `section-rename.test.ts` (failing) | WP01 | |
| T002 | Broaden `readmeToIndexId` (case-insensitive `README|index`) + `indexBasename` option; thread through schema/config/routes/deck-slug | WP01 | |
| T003 | Add `.mjs` index-detection twin + root-index exemption; update `check-links`/`scaffold`/`new-doc`/`assert-build-artifacts` literals | WP01 | |
| T004 | Both-index collision: configured basename wins, other demoted, warning (ts + mjs) | WP01 | |
| T005 | Registry `subtypes` field: zod (schema) + resolver (sections); `expectedDocType`/`expectedType` twin consults it; built-in table fallback | WP01 | |
| T006 | `registryToSidebar` rename survival (ADR-0029 content-root coupling) | WP01 | |
| T007 | Extend parity twins (`section-type-parity`, `schema-validator-parity`) for basename + subtypes; all green | WP01 | |
| T008 | Backward-compat verification: existing suite + doc-sanity/build gates green on current corpus | WP01 | |
| T009 | Red-first `redirect-coverage.test.ts` (pass, uncovered-fail, dead-target-fail, chain cases) | WP02 | |
| T010 | Committed URL-baseline artifact (pre-change snapshot; not build-derived) | WP02 | |
| T011 | Astro-native `redirects` emission in `example/astro.config.mjs` | WP02 | |
| T012 | `check-redirect-coverage.mjs` — bare-Node, target-aware, chain-resolving gate | WP02 | |
| T013 | Wire the coverage gate into CI (doc-sanity/example lane) | WP02 | |
| T014 | Flexible-section-identity ADR: supersede ADR-0002 in part + reverse ADR-0004 "tolerated→supported" | WP03 | |
| T015 | Greenfield redirect-coverage ADR | WP03 | |
| T016 | Regenerate ADR index (`docs/adr/README.md`) + keep `--check` clean | WP03 | |
| T017 | Update `convention.md` + `authoring.md` for basename/subtypes/redirect options | WP03 | |
| T018 | Changelog entry (impact-first, per-issue refs) | WP03 | |
| T019 | Example: an `index.md`-indexed section | WP04 | [P] |
| T020 | Example: a renamed section with `subtypes` + rendered sidebar group + zero dangling `related:` links | WP04 | [P] |
| T021 | Example: redirect map + committed baseline + gate pass fixture | WP04 | |
| T022 | Example: gate failure-mode fixtures as focused tests (not permanently-red gates) | WP04 | |
| T023 | Example build assertions (`example-adopter.test.ts`) — SC-001..004 demonstrated | WP04 | |

---

## WP01 — Flexible section identity (basename + subtypes)

- **Goal**: Make the section-index basename configurable (accept `index.md`) and make a section-folder rename (top-level + sub-path subtype) follow the folder through the registry — across both the TS lib and its bare-Node validator twin, parity-guarded, backward-compatible.
- **Priority**: P1 (MVP). **Depends on**: none.
- **Independent test**: `pnpm test` green including the new `index-basename.test.ts`, `section-rename.test.ts`, and the extended parity twins; existing suite + doc-sanity unaffected on the current corpus.
- **Subtasks**: T001, T002, T003, T004, T005, T006, T007, T008
- **Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007; NFR-001, NFR-003, NFR-004.
- **Prompt**: [tasks/WP01-flexible-section-identity.md](./tasks/WP01-flexible-section-identity.md) (~600 lines)
- **Risks**: the `.mjs` twin has no `readmeToIndexId` today (net-new parallel authority — guard with parity); ADR-0029 sidebar coupling; scattered `README.md` literals; keep NFR-003 no-op green.

## WP02 — Redirect-coverage primitive

- **Goal**: Ship a committed URL baseline, Astro-native redirect emission, and a bare-Node target-aware coverage gate that reds on an uncovered old URL or a redirect to a dead target.
- **Priority**: P3. **Depends on**: WP01 (settled URL scheme).
- **Independent test**: `redirect-coverage.test.ts` green (pass + both failure modes + chain); gate runs in bare Node, deterministic, wired into CI.
- **Subtasks**: T009, T010, T011, T012, T013
- **Requirements**: FR-008, FR-009, FR-010, FR-011; NFR-002, NFR-005.
- **Prompt**: [tasks/WP02-redirect-coverage-primitive.md](./tasks/WP02-redirect-coverage-primitive.md) (~450 lines)
- **Risks**: baseline must be committed not build-derived (NFR-005); chain/target resolution must terminate; stay bare-Node (NFR-002).

## WP03 — Governance ADRs & living docs

- **Goal**: Record the posture shift (supersede ADR-0002 in part + reverse ADR-0004; greenfield redirect ADR), regenerate the ADR index, and bring `convention.md`/`authoring.md`/changelog into truth.
- **Priority**: P2. **Depends on**: WP01, WP02 (design settled).
- **Independent test**: `generate-adr-index.mjs --check` clean; doc-sanity (markdownlint, links, terminology) green; changelog present.
- **Subtasks**: T014, T015, T016, T017, T018
- **Requirements**: FR-012 (docs half). Governance C-007.
- **Prompt**: [tasks/WP03-governance-adrs-and-docs.md](./tasks/WP03-governance-adrs-and-docs.md) (~400 lines)
- **Risks**: ADR must state the ADR-0004 reversal in words; ADR-index `--check` gate must stay clean; markdownlint budget on edited docs.

## WP04 — Worked example demonstrations

- **Goal**: Exercise each capability against real build output — an `index.md` section, a renamed section (subtypes + sidebar + redirects), and the coverage gate in pass + both failure modes.
- **Priority**: P2. **Depends on**: WP01, WP02.
- **Independent test**: `example-adopter.test.ts` green; example builds; SC-001..004 demonstrated; NFR-003 (existing example) stays green.
- **Subtasks**: T019, T020, T021, T022, T023
- **Requirements**: FR-012 (example half); FR-006 + NFR-004 (rename link-integrity, authoritatively asserted here); demonstrates FR-001..011, SC-001..004.
- **Prompt**: [tasks/WP04-worked-example.md](./tasks/WP04-worked-example.md) (~450 lines)
- **Risks**: keep the existing example green while adding fixtures; failure-mode fixtures encoded as focused tests, never a permanently-red gate.

---

## Dependency graph

```
WP01 ──▶ WP02 ──┬─▶ WP03
   └────────────┴─▶ WP04
```

## MVP

**WP01** alone delivers the two dogfooding-relevant capabilities (configurable basename + registry-driven rename) with full parity guarding — a shippable slice even before the redirect primitive and example land.
