# Mission Specification: Metadata / Vocabulary / Hub Consolidation

**Mission Branch**: `feat/metadata-vocab-hub-consolidation`
**Created**: 2026-09-03
**Status**: Draft
**Input**: User description: "Metadata/vocabulary/Hub consolidation mission bundling three deferred adoption-enabler issues: #49 (consolidate the mjs↔ts vocabulary/type-derivation split-brain into a single canonical source), #39 (add `durable` to the doc_status enum), and #50 (ADR-number-ordered, status-aware Hub card for multi-ADR rendered trees). All three surfaced from the spec-kitty adoption study / qol-adoption-enablers deferrals."

## Overview

This mission closes three independent enablers that were deferred out of the `qol-adoption-enablers` mission and surfaced by the spec-kitty adoption study. Each reduces adopter friction and, in two cases, fixes doc-kitty's own dogfooding gaps. They share a subject area — how document metadata and section vocabulary are defined, validated, and rendered — but are independently developed, tested, and shippable slices.

Tracking issues: **#49** (vocabulary/type split-brain), **#39** (`durable` doc_status), **#50** (ADR Hub card).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One canonical source for section vocabulary and type derivation (Priority: P1)

Today the same knowledge — which section vocabulary is valid and how a document's expected type is derived — lives in two hand-mirrored places: the bare-Node validation gate (`validate-frontmatter.mjs`) and the Astro-side toolkit (`sections.ts` `loadVocabulary`, `metadata.ts` `expectedDocType`). The previous mission contained the divergence risk with a resolved-vocabulary parity test (NFR-004) because the gate must run in bare Node with no Astro build context and therefore could not import the build-coupled path directly. A maintainer who updates vocabulary or type-derivation rules must remember to edit both sites; a missed edit silently diverges the gate from the site.

This story eliminates the duplication structurally: a single canonical, dependency-light source both consumers import, so a change made once takes effect everywhere and divergence becomes impossible by construction.

**Why this priority**: It is the mission's headline and its only architecturally non-trivial slice. It closes an entire class of "split-brain drift" defects rather than guarding against one instance, and it removes recurring maintainer burden. The other two stories are small enough to ride alongside it.

**Independent Test**: Change a vocabulary term or a type-derivation rule in exactly one place, then confirm both the bare-Node gate and the toolkit reflect it with no second edit site; confirm the gate still runs under plain `node` with no Astro build context.

**Acceptance Scenarios**:

1. **Given** the section vocabulary and type-derivation logic, **When** a maintainer inspects the codebase, **Then** there is exactly one authoritative definition, imported by both the bare-Node gate and the toolkit.
2. **Given** a change to a vocabulary term made at the single source, **When** both the gate and the toolkit run, **Then** both observe the change with no additional edit required at a second site.
3. **Given** the frontmatter validation gate, **When** it is executed with plain `node` and no Astro build/runtime context, **Then** it runs successfully and imports no Astro-build-coupled module.
4. **Given** the same frontmatter inputs, **When** validated by the gate and by the toolkit path, **Then** the vocabulary and type-derivation results are identical.

---

### User Story 2 - `durable` document status for never-retire docs (Priority: P2)

An adopter marks a never-retire throughline document with `doc_status: durable`. Today the strict enum rejects it, hard-failing validation for a legitimate lifecycle state and forcing the adopter to fork the schema or mislabel the doc.

**Why this priority**: A one-value additive change that unblocks a real adopter failure with minimal risk. High leverage, low cost — but subordinate to the structural work in Story 1.

**Independent Test**: Author a document with `doc_status: durable`, run validation and build, and confirm it passes and renders where other statuses render.

**Acceptance Scenarios**:

1. **Given** a document whose frontmatter sets `doc_status: durable`, **When** frontmatter validation runs, **Then** it passes.
2. **Given** documents using the pre-existing statuses (`draft`, `active`, `deprecated`, `superseded`), **When** validation runs after the change, **Then** their behavior and meaning are unchanged.
3. **Given** a `durable` document, **When** the site builds, **Then** it renders on every surface that consumes `doc_status` without error.

---

### User Story 3 - ADR-number-ordered, status-aware Hub card (Priority: P3)

A maintainer renders an ADR hub over a tree containing several ADRs. Today the Hub card sorts children alphabetically by title and cannot surface a body-only `## Status`, so the rendered hub does not match the generated own-tree table (which has full fidelity: number order, Status, Date). With multiple ADRs this is visibly wrong ordering and missing status.

**Why this priority**: A rendering-fidelity enhancement, valuable but the least critical and lowest-risk of the three; safe to land last.

**Independent Test**: Render a hub over a tree with ≥2 ADRs and confirm they appear in ADR-number order, each showing its lifecycle status and date, matching the generated own-tree table.

**Acceptance Scenarios**:

1. **Given** an ADR hub over ≥2 ADRs, **When** it renders, **Then** entries are ordered by ADR number (not alphabetically by title).
2. **Given** an ADR whose status is expressed in its body (`## Status`), **When** the hub card renders, **Then** the card surfaces that lifecycle status (Proposed / Accepted / Superseded / Deprecated) and the ADR's date.
3. **Given** the same ADR set rendered by the hub and listed by the generated own-tree table, **When** both are compared, **Then** ordering, status, and date match 1:1.

### Edge Cases

- An ADR with no discernible number or no `## Status` in its body: it must still render (with a graceful "unknown"/unbadged fallback) rather than break the hub.
- A single-ADR tree (the existing demo): must continue to render correctly and not regress.
- A non-ADR Hub listing: ADR-specific ordering/status must not leak into or alter other `kind` listings.
- A document using a `doc_status` value outside the enum (including the new one before it is added): must fail validation with a clear message, not silently pass.
- Vocabulary or type-derivation edits during the transition: no window in which the gate and toolkit can disagree.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Single canonical vocabulary + type-derivation source | As a maintainer, I want one authoritative definition of section vocabulary and type derivation so that I edit it once and never hand-mirror it. | High | Open |
| FR-002 | Both consumers import the canonical source | As a maintainer, I want both the bare-Node gate and the toolkit to import the single source so that they cannot diverge. | High | Open |
| FR-003 | Gate/toolkit result parity by construction | As a doc author, I want the frontmatter gate and the site to agree on vocabulary and expected type so that local validation matches build behavior. | High | Open |
| FR-004 | `durable` accepted as a doc_status value | As an adopter, I want `doc_status: durable` accepted so that never-retire docs validate without forking the schema. | High | Open |
| FR-005 | `durable` honored on status-consuming surfaces | As a doc author, I want a `durable` doc to render everywhere `doc_status` is consumed so that the status behaves like a first-class value. | Medium | Open |
| FR-006 | ADR Hub card orders by ADR number | As a maintainer, I want ADR hub entries ordered by ADR number so that a multi-ADR hub reads in the same order as the generated table. | Medium | Open |
| FR-007 | ADR Hub card surfaces lifecycle status + date | As a maintainer, I want each ADR card to show its status (Proposed/Accepted/Superseded/Deprecated) and date so that the rendered hub matches the generated own-tree table. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Structural single-sourcing | Exactly one authoritative definition of section vocabulary + type-derivation exists in the codebase; a code-level check demonstrates both consumers reference it (0 duplicate definitions). | Maintainability | High | Open |
| NFR-002 | Additive, backward-compatible enum change | Adding `durable` changes the meaning or acceptance of no existing status value; 100% of pre-change documents still validate identically. | Compatibility | High | Open |
| NFR-003 | No gate regressions | All pre-existing CI gates (frontmatter validation, vocabulary parity, a11y, Playwright, build) remain green: 0 newly failing gates. | Reliability | High | Open |
| NFR-004 | Rendered-vs-generated ADR fidelity | For any ADR set of size ≥2, the rendered hub matches the generated own-tree table on ordering, status, and date with 0 discrepancies. | Correctness | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Bare-Node execution boundary | The frontmatter gate must execute under plain Node.js with no Astro build context and must not import any Astro-build-coupled module. The shared source must therefore be dependency-light / pure ESM. | Technical | High | Open |
| C-002 | Preserve canonical semantics | The `sections.ts` resolver is the intended canonical semantics; consolidation must promote/extract that behavior, not introduce a competing definition or change resolution results. | Technical | High | Open |
| C-003 | Parity test disposition | The NFR-004 resolved-vocabulary parity test is retained as a cheap regression guard, or removed only if structural single-sourcing makes it provably moot; it is not left as the sole line of defense. | Technical | Medium | Open |
| C-004 | Additive enum only | The `doc_status` enum change adds `durable`; it renames or removes no existing value (not a bulk edit). | Technical | High | Open |
| C-005 | Non-regressive Hub change | The ADR Hub card change is additive (to the Hub layout or a per-kind card variant) and must not regress the single-ADR demo or alter non-ADR listings. | Technical | Medium | Open |

### Key Entities *(include if feature involves data)*

- **Section vocabulary + type-derivation rules**: The canonical knowledge of which section kinds/terms are valid and how a document's expected type is derived. Currently duplicated across the gate and the toolkit; to become a single source.
- **Frontmatter validation gate**: The bare-Node check (`validate-frontmatter.mjs`) that must run without an Astro build context — one consumer of the canonical source.
- **Toolkit resolver**: The Astro-side path (`sections.ts` `loadVocabulary`, `metadata.ts` `expectedDocType`) — the other consumer and the source of canonical semantics.
- **`doc_status` enum**: Document lifecycle status. Currently `draft`, `active`, `deprecated`, `superseded`; gaining `durable`.
- **ADR entry**: A rendered decision record with a number, lifecycle status, date, and title — the unit the Hub card orders and badges.
- **Hub card**: The rendered listing component whose ADR variant must order by number and show status + date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Exactly one authoritative definition of section vocabulary + type-derivation exists, imported by both the bare-Node gate and the toolkit (0 duplicated definitions).
- **SC-002**: A single-site change to a vocabulary term or type-derivation rule is reflected by both the gate and the toolkit with no second edit site required.
- **SC-003**: The frontmatter gate runs under plain `node` with no Astro build context and imports no Astro-build-coupled module.
- **SC-004**: A document with `doc_status: durable` validates and renders successfully, where before the change it hard-failed validation.
- **SC-005**: A rendered ADR hub with ≥2 ADRs lists them in ADR-number order, each with the correct lifecycle status badge and date, matching the generated own-tree table 1:1.
- **SC-006**: All pre-existing CI gates remain green after the change (0 newly failing gates).

## Assumptions

- The three issues are independent slices; partial delivery of any one still leaves a shippable, valuable increment (each is its own MVP).
- The shared canonical source can be expressed as dependency-light / pure ESM so the bare-Node gate can import it directly (the mechanism — extracted shared module vs codegen — is a plan-phase decision; the outcome, single-sourcing without breaking the bare-Node boundary, is fixed here).
- ADR status is discoverable from ADR content (frontmatter and/or a body `## Status` section) sufficiently to badge Proposed/Accepted/Superseded/Deprecated and a date.
- Adding `durable` to the enum is the complete scope of #39; no additional status semantics (e.g. retirement workflows) are in scope.
