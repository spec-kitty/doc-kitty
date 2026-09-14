# Mission Specification: Documentation Charter (M7 consolidation)

**Mission Branch**: `feat/documentation-charter`
**Created**: 2026-09-14
**Status**: Draft
**Input**: User description: "M7 — Documentation charter (consolidation): recast doc-kitty's documentation convention into a single, coherent, consumer-facing 'documentation charter' surface — doc-kitty-native with zero Spec Kitty runtime dependency. Consolidation half only: unify the shipped governance seams, close the last hardcoded knobs (doc_status, required fields), retire convention.md's 'will later be recast' hedge. Layer-B qualitative doctrine and a configurable-enforcement engine are OUT."

## Context & Background *(informative)*

doc-kitty already lets a consumer govern three axes of its documentation convention — term **vocabulary** (`_meta/vocabulary.yaml`, alias/forbid over `type`/`kind`), the **section/IA registry** (`_meta/sections.yaml`: id/label/order/type/purpose/feeds, plus `indexBasename` and `subtypes`), and **presentation** (the `default → brand → consumer` theme merge). These shipped incrementally through adoption enablers #37–#44 and are proven against a second consumer by the packed-tarball consumption test (N=2).

Three gaps remain, and this mission closes them:

1. **Scattered, unnamed.** The governance knobs live in separate files with no single documented surface, no unified resolution story, and no "this is your documentation charter" mental model. `docs/context/convention.md` still carries a standing promise (its intro) that the convention "will later be recast as a Spec Kitty charter/doctrine."
2. **Last hardcoded knobs.** `doc_status` (the `STATUSES` enum in `src/lib/vocabulary-core.mjs`) is the only vocabulary axis with no consumer override; the always-required frontmatter field set is hardcoded in `src/scripts/validate-frontmatter.mjs`; and `src/lib/metadata.ts` carries a frozen `SECTION_ORDER` fallback.
3. **Un-recorded stance.** The decision that doc-kitty's documentation doctrine is **self-contained and portable** (not a consumer of Spec Kitty's charter/doctrine engine) has never been written as an ADR.

This is the **consolidation half** of the original M7 "Doctrine variation" feature. A three-lens pre-spec research squad found M7 ~70% already delivered; the qualitative-doctrine layer (curated-not-wiki, one-concern-per-file, writing quality) and any consumer-tunable enforcement engine are explicitly split to a separate, later item to avoid governance-theatre.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adopter governs their convention from one charter file (Priority: P1)

A team adopting doc-kitty for their own repository wants their documentation held to *their* convention — their forbidden terms, their section set, their extra lifecycle status — without forking the toolkit and **without installing Spec Kitty**. Today they must discover and edit two or three separate `_meta/*.yaml` files and cannot touch `doc_status` or the required-field set at all.

**Why this priority**: This is the mission's reason to exist — a single, discoverable, portable place to govern the convention. Everything else (closing knobs, retiring prose) serves this outcome. It is independently valuable: even with nothing else, a consolidated authoritative charter that resolves the existing seams is a shippable improvement.

**Independent Test**: In a clean-room consumer site built only from the packed tarball (no Spec Kitty on PATH), author one consolidated charter file that forbids a term, subsets sections, and adds one custom `doc_status`; build and validate; confirm the toolkit honors all three from the single file and the build succeeds.

**Acceptance Scenarios**:

1. **Given** a consumer site with a single consolidated charter file declaring a forbidden `type` term, a section subset, and one added `doc_status`, **When** the site is validated and built from the packed tarball with no Spec Kitty present, **Then** the forbidden term hard-fails validation, the section subset drives navigation, the added status validates as legal, and the build completes successfully.
2. **Given** a consumer that authors no charter file at all, **When** they build, **Then** the shipped canonical defaults apply unchanged (absent → defaults, identity resolution) and no new file is required.
3. **Given** a malformed consolidated charter file, **When** validation runs, **Then** it fails closed with a clear, actionable message naming the file and the offending key (never silently ignored).

---

### User Story 2 - Existing consumer keeps working through the migration (Priority: P1)

The already-proven consumer (the consumption-test site, and doc-kitty's own `docs/` tree) depends on `_meta/vocabulary.yaml` and `_meta/sections.yaml` as they are today. Consolidating into a new file must not break them.

**Why this priority**: A consolidation that regresses the one demonstrated adopter path (N=2) destroys the very proof the 0.1.0 release just earned. Back-compat is non-negotiable and must ship in the same slice as the new file, not after.

**Independent Test**: Take the current consumption-test consumer unchanged (legacy `_meta/*.yaml`, no new charter file) and build it from the packed tarball; confirm byte-for-byte-equivalent governance behavior (same forbidden terms, same section resolution) with at most a deprecation notice.

**Acceptance Scenarios**:

1. **Given** a consumer with legacy `_meta/vocabulary.yaml` and `_meta/sections.yaml` and **no** consolidated charter file, **When** they build, **Then** governance resolves exactly as before, optionally emitting a deprecation notice pointing to the migration.
2. **Given** a consumer with **both** a consolidated charter file and legacy `_meta/*.yaml` files, **When** governance resolves, **Then** the consolidated file takes precedence by a documented, deterministic rule and the outcome is reported unambiguously (no silent partial merge surprises).
3. **Given** the documented migration steps, **When** a maintainer follows them to move a legacy consumer to the consolidated file, **Then** the resulting governance behavior is identical to the pre-migration behavior.

---

### User Story 3 - Close the last hardcoded knobs (Priority: P2)

An adopter needs a lifecycle status the canonical set lacks (e.g. `deprecated`), or needs to relax a required frontmatter field their corpus does not carry — governance dimensions that are currently impossible without forking.

**Why this priority**: These are the concrete "still hardcoded" gaps M7 named. They are valuable but subordinate to having the charter surface (US1) and its safety net (US2) in place; they extend the surface rather than define it.

**Independent Test**: Via the charter file, add a `doc_status` value and relax one non-floor required field; validate a page using the new status and a page omitting the relaxed field; confirm both pass, while a page using an unknown-and-not-declared status still warns and a page missing a floor field (e.g. `title`) still fails.

**Acceptance Scenarios**:

1. **Given** a charter that declares an additional `doc_status` value (extend-only), **When** a page uses it, **Then** it validates as legal; **and** a charter attempting to remove or alias away a **canonical reserved** status is rejected with a clear message.
2. **Given** a charter that relaxes a non-floor required field, **When** a page omits that field, **Then** validation passes; **and** a page omitting a **floor** field (`title`) still fails regardless of charter.
3. **Given** no charter override for statuses or required fields, **When** validation runs, **Then** the canonical five statuses and the canonical required-field set apply exactly as today.

---

### User Story 4 - The convention reads as the charter's narrative companion (Priority: P3)

A reader (adopter or maintainer) opening `docs/context/convention.md` should find an accurate description of a governance model that *exists*, not a promise that it is coming, and should understand which rules are fixed doctrine versus consumer-overridable.

**Why this priority**: Documentation honesty (curated-not-wiki is doc-kitty's own convention) and closing the standing promise. Lowest priority because it is prose, not capability — but it is what makes the shipped capability legible.

**Independent Test**: Read `convention.md` and the new charter reference after the change; confirm the "will later be recast" hedge is gone, each governable dimension states whether it is fixed or overridable and points at the charter, and no claim references a seam that does not exist.

**Acceptance Scenarios**:

1. **Given** the updated `convention.md`, **When** a reader looks for the recast promise, **Then** it is gone and replaced by a statement that the convention *is* the default doctrine pack, with a pointer to the consumer-facing charter reference.
2. **Given** the new charter reference page, **When** a reader scans the governable dimensions, **Then** each is marked fixed-doctrine or consumer-overridable and links to the authoritative charter file it is configured in.

---

### Edge Cases

- **Both files present, conflicting values** — consolidated charter vs legacy `_meta/*.yaml` disagree: the documented precedence rule (consolidated wins) applies deterministically and the effective value is reported.
- **Charter declares a term both aliased and forbidden**, or an alias target that is itself forbidden: rejected with a clear message (consistent with today's vocabulary-core semantics).
- **Charter attempts to remove a canonical `doc_status`** (e.g. drops `draft` or `published`): rejected — canonical statuses are reserved so Hub draft-exclusion, feeds, and the `durable` throughline keep working.
- **Charter relaxes the `title` floor field**: rejected — `title` stays non-negotiable so pages remain renderable.
- **Charter file present but empty**: treated as identity/defaults (same as absent), not an error.
- **Consumer builds from packed tarball with no Spec Kitty installed**: charter resolves fully; any accidental Spec Kitty import path is a defect (NFR-001).
- **`SECTION_ORDER` fallback path** hit when no registry/charter is present: still yields the canonical order (no regression for a bare consumer).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Consolidated charter file | As an adopter, I want one authoritative `_meta/` charter file that declares my documentation governance (vocabulary, sections/IA, statuses, required-field policy) so that I govern my convention from a single place. | High | Open |
| FR-002 | Single default→consumer resolution story | As an adopter, I want one documented, deterministic `default → consumer` resolution model across all governed dimensions so that the effective convention is predictable and explainable. | High | Open |
| FR-003 | Absorb vocabulary axis | As an adopter, I want the `type`/`kind` alias/forbid vocabulary expressible in the consolidated charter so that term governance lives with the rest of my charter. | High | Open |
| FR-004 | Absorb section/IA registry | As an adopter, I want section id/label/order/type/purpose/feeds, `indexBasename`, and `subtypes` expressible in the consolidated charter so that IA governance lives with the rest of my charter. | High | Open |
| FR-005 | doc_status override (extend-only) | As an adopter, I want to add lifecycle statuses via the charter while the canonical statuses stay reserved so that I can extend the lifecycle without breaking Hub/feed behavior. | High | Open |
| FR-006 | Configurable required-field set | As an adopter, I want to relax non-floor required frontmatter fields via the charter so that a corpus without those fields validates, while a floor field (`title`) stays mandatory. | High | Open |
| FR-007 | Retire frozen SECTION_ORDER fallback | As a maintainer, I want the frozen `SECTION_ORDER` fallback reconciled with the charter/registry resolution so that section ordering has one source of truth and a bare consumer still gets the canonical order. | Medium | Open |
| FR-008 | Legacy seams honored (back-compat) | As an existing consumer, I want my current `_meta/vocabulary.yaml` and `_meta/sections.yaml` to keep working (deprecated) so that consolidation does not regress my site. | High | Open |
| FR-009 | Deterministic precedence when both present | As an adopter mid-migration, I want a documented precedence rule (consolidated charter wins over legacy files) so that mixed states resolve unambiguously. | High | Open |
| FR-010 | Fail-closed on malformed charter | As an adopter, I want a malformed charter to fail validation with a message naming the file and offending key so that governance is never silently dropped. | High | Open |
| FR-011 | Migration guide | As a maintainer, I want documented steps to move a legacy consumer to the consolidated charter so that migration is behavior-preserving and repeatable. | Medium | Open |
| FR-012 | Native-doctrine ADR | As a maintainer, I want the self-contained-doctrine decision (native, not Spec Kitty engine) recorded as a new/superseding ADR so that the stance has a durable rationale rather than being re-litigated. | High | Open |
| FR-013 | Retire convention.md recast hedge | As a reader, I want `convention.md` to describe the governance model that exists (no "will later be recast" promise) so that the docs are honest and current. | Medium | Open |
| FR-014 | Consumer-facing charter reference | As an adopter, I want a reference page enumerating each governable dimension (fixed vs overridable) and where it is configured so that I can discover and use the charter. | Medium | Open |
| FR-015 | Effective-charter visibility | As an adopter, I want to see the resolved/effective charter (the derived-but-committed catalog analogue) so that I can verify what governance is actually in force. | Low | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Zero Spec Kitty runtime dependency | The charter resolves and enforces with **no** import of, call to, or file dependency on Spec Kitty / DoctrineService; verified by a clean-room build from the packed tarball with no Spec Kitty on PATH (0 references). | Portability | High | Open |
| NFR-002 | Consumption-path non-regression | The existing N=2 consumption-test consumer builds and validates from the packed tarball with identical governance behavior; the consumption CI gate stays green (no new required tooling). | Reliability | High | Open |
| NFR-003 | Build-free enforcement | Charter resolution and frontmatter enforcement run in the bare-Node gates (`validate-frontmatter.mjs` and siblings) without an Astro build, preserving the current NFR. | Performance | High | Open |
| NFR-004 | Pure-core / thin-loader split preserved | All new resolution logic keeps the fs-free pure-core (`vocabulary-core.mjs`) ↔ thin fs-loader (`vocabulary-loader.mjs`) separation; the resolved-vocabulary parity guard (Astro-side vs bare-Node) stays green. | Maintainability | High | Open |
| NFR-005 | Existing gates stay green | `validate:docs`, `validate:example`, `validate:catalog`, `validate:links`, `validate:adr-index`, the Vitest suite, and `test:a11y` all pass unchanged except where a test is intentionally updated for the charter. | Reliability | High | Open |
| NFR-006 | OKF conformance preserved | Every non-orphan page still resolves to a non-empty `type`; a stricter consumer policy may add requirements but the toolkit never emits an OKF-invalid record. | Interoperability | Medium | Open |
| NFR-007 | Deterministic resolution | Charter resolution is deterministic and order-independent across builds (no nondeterministic merge/ordering), consistent with the repo's determinism gates. | Reliability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Consolidation scope only | Layer-B qualitative doctrine (curated-not-wiki, one-concern-per-file, writing-quality/Vale) is OUT; a consumer-tunable strictness/enforcement engine is OUT. Warn-not-fail posture is retained. | Scope | High | Open |
| C-002 | No empty knobs | Every governable dimension added must map to a demonstrated adopter need (as vocabulary override did for a real Mission-canon adopter); no speculative empty override surfaces. | Scope | High | Open |
| C-003 | ADR discipline | The native-vs-engine decision lands as a NEW or superseding ADR; ADR-0004 (Accepted) is not edited in place beyond its amendment-log conventions. | Technical | High | Open |
| C-004 | Canonical statuses reserved | The canonical `doc_status` values remain reserved and non-removable; override is extend-only. | Technical | High | Open |
| C-005 | Required-field floor | At least `title` remains a non-negotiable required field regardless of charter, so pages stay renderable. | Technical | Medium | Open |
| C-006 | Back-compat window, not permanent fork | Legacy `_meta/vocabulary.yaml` / `_meta/sections.yaml` are honored as deprecated with a migration path; this is a compatibility window, not a second permanent format to maintain indefinitely. | Technical | Medium | Open |

### Key Entities

- **Documentation Charter (consolidated file)**: the single authoritative `_meta/` artifact declaring a consumer's governance across vocabulary, section/IA registry, `doc_status` extensions, and required-field policy. Absent → canonical defaults.
- **Effective (resolved) charter**: the derived-but-committed catalog analogue — the computed result of `default → consumer` resolution, surfaced for verification (FR-015).
- **Legacy seams**: `_meta/vocabulary.yaml`, `_meta/sections.yaml` — honored during the back-compat window, superseded by the consolidated file when both are present.
- **Governable dimension**: a single axis of the convention (a term vocabulary, the section registry, the status enum, the required-field set), each marked fixed-doctrine or consumer-overridable.
- **Narrative companion**: `docs/context/convention.md` recast as the human-readable default doctrine pack, paired with the machine-authoritative charter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A consumer can govern all four dimensions (vocabulary, sections/IA, statuses, required fields) from **one** charter file — down from three-or-more separate files today.
- **SC-002**: An adopter can add a new `doc_status` value and relax a non-floor required field **without forking** the toolkit — two governance actions that are impossible today.
- **SC-003**: The existing N=2 consumption-test consumer builds with **zero** governance-behavior changes and **zero** Spec Kitty references detected in a clean-room build.
- **SC-004**: `docs/context/convention.md` contains **no** "will later be recast" promise, and every governable dimension it lists points to where it is configured.
- **SC-005**: 100% of the pre-existing validation and build gates remain green after the change (except tests intentionally updated for the charter).
- **SC-006**: A maintainer can migrate a legacy consumer to the consolidated charter following the documented steps with **identical** resulting governance behavior.
