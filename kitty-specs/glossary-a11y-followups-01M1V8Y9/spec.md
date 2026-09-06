# Mission Specification: Glossary a11y follow-up cluster (#77/#78/#79)

**Mission Branch**: `feat/glossary-a11y-followups`
**Created**: 2026-09-06
**Status**: Draft
**Input**: User description: "Glossary a11y follow-up cluster (#77, #78, #79) — extract one shared glossary link-node builder, make the term/link distinction AT-perceivable, and add an e2e regression guard for the popover caret + viewport flip."

This mission closes the three follow-ups filed from the #64 glossary-term-ux
pre-PR adversarial squad. All three live entirely inside the **glossary bounded
context**; none touches the M3 external-references/related renderers, the section
registry, or any brand/theme identity file. The behaviours the glossary already
ships (auto-linking, `:term` directive, hover preview, "On this page" links-used,
no-JS fallback) must remain byte-for-byte unchanged except for the one new,
deliberate accessibility attribute.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A screen-reader user can tell a glossary term from an ordinary link (Priority: P1)

A person browsing the docs with a screen reader (or other assistive technology)
encounters a glossary term link in the prose. Today it is announced identically
to any ordinary link — the only cue that it is a *term* with a definition is the
dotted underline and `help` cursor, which are visual-only. This story makes the
term-ness perceivable non-visually, in the server-rendered HTML, without
JavaScript.

**Why this priority**: #77 is the flagged a11y gap and the reason this cluster
exists. It is the only user-facing behaviour change in the mission; the other two
stories are internal quality (no observable behaviour delta). Shipping only this
story would already deliver the mission's core value.

**Independent Test**: Load a glossary page with a screen reader (or inspect the
served HTML with JS disabled) and confirm a glossary term link exposes a
programmatic "glossary term" affordance distinct from an ordinary link, while its
visible text and navigation target are unchanged.

**Acceptance Scenarios**:

1. **Given** a page with an auto-linked glossary term, **When** the served HTML
   is inspected with JavaScript disabled, **Then** the term's anchor carries an
   `aria-label` equal to its visible text followed by `, glossary term`
   (e.g. `aria-label="cargo, glossary term"`), and an ordinary content link on
   the same page carries no such affordance.
2. **Given** a `:term`-forced glossary link, **When** its emitted node is
   compared against an auto-linked node for the same term, **Then** both carry a
   byte-identical `hProperties` bag including the same `aria-label`, so the two
   link kinds stay indistinguishable downstream (C-001 parity holds).
3. **Given** a glossary term link, **When** the "On this page" links-used list is
   re-derived at render, **Then** the recorded surface for the term is its plain
   visible text (e.g. `cargo`) — the affordance does not leak into the used-list
   surface, and the count-pins in the e2e suite are unchanged.

---

### User Story 2 - A maintainer can refactor popover positioning without silently breaking the caret or the flip (Priority: P2)

The popover's caret rendering, `data-placement` (bottom vs top), and the
viewport-bottom upward flip added in #64 currently rest solely on a manual pixel
pass — there is no automated assertion. A maintainer refactoring
`preview-popover.client.ts` `position()` has no safety net. This story adds an
end-to-end regression guard.

**Why this priority**: Pure test-coverage hardening for FR-005/FR-006 of the #64
mission (DIRECTIVE_041 — a behaviour with no test is one refactor away from
silent regression). No production behaviour changes.

**Independent Test**: Run the glossary e2e suite; it fails if the popover stops
setting `data-placement`, stops flipping for a low-in-viewport term, or stops
rendering its caret.

**Acceptance Scenarios**:

1. **Given** a glossary term high in the viewport (ample space below), **When**
   its popover opens, **Then** the popover has `data-placement="bottom"` and a
   visible caret.
2. **Given** a glossary term low in the viewport (insufficient space below,
   ample space above), **When** its popover opens, **Then** the popover flips to
   `data-placement="top"` and still renders a visible caret.

---

### User Story 3 - A maintainer maintains one glossary link-node builder, not two (Priority: P3)

`makeLinkNode` (`glossary-autolink.internal.ts`) and `glossaryLinkNode`
(`glossary-term.ts`) emit a byte-identical `hProperties` bag and href. They are
two independent builders kept in sync by discipline plus the live cross-emitter
parity test. This story extracts a single shared builder so the shape is authored
once.

**Why this priority**: Duplication cleanup deferred from #64 as genuine scope
beyond a UX slice. It is the natural home for Story 1's new attribute, so it is
sequenced first in implementation even though it is lowest user-priority. No
observable behaviour change.

**Independent Test**: Both emitters import the same builder; the cross-emitter
parity test and the re-derive parity guard stay green; the full test/build/gate
suite is unchanged.

**Acceptance Scenarios**:

1. **Given** the extracted shared builder, **When** the auto-linker and the
   `:term` directive each emit a glossary link, **Then** both call the one shared
   builder and produce identical nodes (parity test green).
2. **Given** the refactor, **When** the corpus is rebuilt, **Then** the built
   glossary output is byte-identical to before the refactor except for Story 1's
   new `aria-label` attribute.

---

### Edge Cases

- **`:term` with rich label children** (e.g. `:term[the *cargo* manifest]`): the
  `aria-label` is composed from the concatenated visible text of the children, so
  a rich label still yields a plain-text affordance string. (This mirrors how the
  used-list already derives a surface from `textContent`.)
- **Empty / whitespace-only visible text**: not reachable for a resolved glossary
  link (a link always has a surface), but the builder must not emit a dangling
  `, glossary term` with no leading text — the affordance is `"<text>, glossary
  term"` only when text is non-empty.
- **No-JS**: the affordance is a static attribute emitted at build time, so it is
  present with JavaScript disabled (the hover island is orthogonal and unchanged).
- **Glossary-free build**: presence-gating is unchanged; a site with no
  definitions file emits no glossary links and therefore no affordance, keeping
  NFR-002 byte-identical-corpus intact.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | AT-perceivable term affordance | As a screen-reader user, I want a glossary term link to be announced as a glossary term so that I can tell it apart from an ordinary link without relying on colour or underline style. | High | Open |
| FR-002 | Affordance is server-rendered / no-JS | As a screen-reader user, I want the term affordance present in the served HTML so that it works with JavaScript disabled. | High | Open |
| FR-003 | Single shared link-node builder | As a maintainer, I want one glossary link-node builder so that the auto-linker and the `:term` directive cannot drift in shape. | Medium | Open |
| FR-004 | Popover placement + caret e2e guard | As a maintainer, I want an e2e test asserting `data-placement` (bottom vs top flip) and caret presence so that a positioning refactor cannot silently regress. | Medium | Open |
| FR-005 | Affordance excluded from links-used surface | As a maintainer, I want the term affordance kept out of the links-used surface so that the "On this page" list and its counts are unchanged. | High | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Cross-emitter parity preserved | The live cross-emitter parity test (`glossary-link-node-parity.test.ts`) passes: both emitters produce a byte-identical node — including the new `aria-label` — for the same term. | Correctness | High | Open |
| NFR-002 | Re-derive parity preserved | The re-derive parity guard (`glossary-substrate-parity.test.ts`) stays green: the render-time links-used re-derive still mirrors the build-time stages, with no new keyed exclusion required. | Correctness | High | Open |
| NFR-003 | Corpus delta is exactly one attribute | Rebuilding the corpus changes the glossary output only by the addition of the `aria-label` attribute on glossary term anchors; no other bytes change (no href, class, `data-glossary-*`, target/rel, or ordering change). | Reliability | High | Open |
| NFR-004 | Full gate suite green in CI | `pnpm test`, `pnpm build`, `validate:docs`/`validate:example`/`validate:adr-index`/`validate:links`, `assert:artifacts`/`assert:no-broken-links`/`assert:markua`, and `test:a11y` all pass in CI on the branch. | Quality gate | High | Open |
| NFR-005 | Accessible-name contract | The `aria-label` preserves the visible text as the leading portion of the accessible name (so voice-control "click <text>" and the visual/spoken name stay in sync), appending only the `, glossary term` role hint. | Accessibility | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Shared link-node invariant | The two emitters must remain shape-identical; the single extracted builder is the mechanism, and the parity test is the guard. Do not reintroduce a second inline builder. | Technical | High | Open |
| C-002 | Affordance mechanism = `aria-label` | The term affordance is implemented as an `aria-label` attribute composed as `"<visible text>, glossary term"` (Decision `01M1V8ZYHJYYVGY438PB166WAX`). It is an attribute (not a text child), so it never enters the `textContent`-based links-used surface. Alternatives (visually-hidden text child, `aria-roledescription`) were considered and rejected — the child pollutes the used-list surface; `aria-roledescription` has patchier AT support. | Technical | High | Open |
| C-003 | Glossary bounded context only | Changes are confined to the glossary modules (`src/lib/glossary/`, `src/lib/remark/glossary-*`, the glossary CSS block, `tests/a11y/glossary.spec.ts`). No M3 renderer, section-registry, or brand/theme file is edited. | Technical | High | Open |
| C-004 | Base-URL single-sourcing preserved | The extracted builder keeps the href single-sourced through `glossaryTermUrl` (#61/#63, C-001 of link-integrity) — the refactor moves the builder, it does not re-implement URL construction. | Technical | Medium | Open |

### Key Entities

- **Glossary link node**: the mdast `link` node both emitters produce — `url`
  (via `glossaryTermUrl`), visible-text `children`, and an `hProperties` bag
  (`class: dk-glossary-link`, `data-glossary-term/-context/-anchor/-context-slug`,
  no `target`/`rel`, and — new this mission — `aria-label`).
- **Shared link-node builder**: the single function this mission extracts
  (candidate home `src/lib/glossary/link-node.ts`, beside `glossaryTermUrl` in
  `resolve.ts`), signature carrying `(context, contextSlug, anchor, termName,
  children, basePrefix)`; the auto-linker wraps its `surface` string into
  `children` at the call site (the only per-caller delta).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of glossary term anchors in the built demonstrator corpus
  carry an `aria-label` ending in `, glossary term`; 0% of ordinary content links
  carry one.
- **SC-002**: The glossary e2e suite gains ≥1 assertion each for
  `data-placement="bottom"` (high term), `data-placement="top"` (flipped low
  term), and caret presence; the suite passes in both colour modes.
- **SC-003**: The number of glossary link-node builders in the codebase drops
  from 2 to 1; both call sites import it; the cross-emitter parity test passes.
- **SC-004**: The links-used count-pins in `glossary.spec.ts` (4 term anchors,
  3 `cargo`, 1 `hr` policy, 2 distinct links-used) are unchanged, proving the
  affordance did not leak into the used-list surface.
