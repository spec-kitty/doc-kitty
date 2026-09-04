# Mission Specification: Internal link integrity

**Mission Branch**: `fix/link-integrity`
**Created**: 2026-09-04
**Status**: Draft
**Input**: Closes #61, #62, #63. Grounded by the prior architect link-integrity investigation.

## Intent Summary

The example docsite ships **broken internal navigation** — links that 404 when clicked — and a **link gate that reports success while they're broken**. Three root causes, one theme (internal links must resolve, and the gate must prove it):

- **#61 — links omit the site base and 404.** Internal hrefs are built as root-absolute strings (`/glossary/…`, `/${ref}/`, `/${slug}/`) with no `/doc-kitty` base, and Astro does not rewrite raw `/…` markdown links. Confirmed live: **21 base-less glossary autolinks** plus base-less section links (`/architecture/overview/`, `/guides/getting-started/`, `/adr/template/`, `/plans/missions/…`, `/context/audience/…`, `/changelog/…`). Separately, **bare relative links on leaf pages resolve as children** (trailing-slash directory semantics) and 404 — e.g. `superseded-note.md`'s `[…](blocks-demonstrator)` → `…/superseded-note/blocks-demonstrator`.
- **#63 — glossary term anchors never resolve.** `generate.ts` emits the inline `## name {#anchor}` heading-attribute form, but this toolkit's markua-attributes support is block-form only, so `{#…}` is never consumed → the heading id doubles (`cargo-cargo`) and the literal `{#cargo}` renders as visible text. Every term link's `#anchor` fragment fails, even once the base is fixed.
- **#62 — the gate is green-on-broken.** `check-links.mjs` reports "✓ 863 references resolve" while all of the above 404. It skips site-absolute links by design, resolves relative links against the filesystem (not the served URL), and never inspects the built/rendered output.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Glossary term links work (Priority: P1)

A reader clicks an autolinked glossary term (or a `:term` link). It navigates to the term's definition — the correct page **and** the correct anchor within it — instead of 404-ing or landing at the top of the page.

**Why this priority**: Glossary terms are the most-broken surface (21 base-less links, every one also anchor-broken) and the glossary is a headline feature.

**Independent Test**: Build; every glossary term href is base-prefixed and its `#anchor` matches a real heading id; curl a term URL → 200 and the anchor exists.

**Acceptance Scenarios**:
1. **Given** an autolinked term, **When** the site is built, **Then** its href is `/doc-kitty/glossary/<context>/#<anchor>` and that page + anchor exist.
2. **Given** a generated glossary page, **When** it renders, **Then** headings show no literal `{#…}` and each term's id equals its intended anchor.
3. **Given** a `:term` link and the hover-preview, **When** rendered, **Then** they use the same base-prefixed, anchor-correct URL as the autolinker.

### User Story 2 - Section, related & authored links work (Priority: P1)

A reader clicks a "Related" card, an Audience link, an "On this page" entry, or an in-content link to another section. It resolves instead of 404-ing.

**Why this priority**: These are live 404s across the site (component-generated + hand-authored).

**Independent Test**: Build; no internal href in `example/dist` is base-less or resolves (as a URL) to a missing page.

**Acceptance Scenarios**:
1. **Given** a Related/Audience/OnThisPage card, **When** built, **Then** its href is base-prefixed and 200.
2. **Given** an in-content link authored to a sibling/other-section page, **When** built, **Then** it resolves to the correct base-prefixed route (not a child-of-current 404).

### User Story 3 - The link gate catches breakage (Priority: P1)

A maintainer introduces a base-less or wrongly-relative internal link. A gate fails instead of passing.

**Why this priority**: The green-on-broken gate is *why* all of the above shipped; without fixing it the fixes rot.

**Independent Test**: A base-aware built-output link check goes red on today's `dist` and green after the fixes; the source gate rejects root-absolute + extensionless-relative internal doc links.

**Acceptance Scenarios**:
1. **Given** the built site, **When** the new gate runs, **Then** it fails on any internal href that 404s as a URL (base-aware, trailing-slash semantics).
2. **Given** a hand-authored root-absolute or extensionless-relative internal doc link, **When** the source gate runs, **Then** it fails with a fix hint.

### Edge Cases

- Directory-index pages (`/plans/`) where `./child/` relative links are already correct must stay correct.
- External `http(s)`/`mailto`/anchor-only (`#…`) links must not be flagged.
- The autolinker, `:term` directive, and preview client build the term URL from one source — all three must move together.
- The `no-autolink` page and collision-stays-plain behavior must be unchanged.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Base-prefixed glossary links | As a reader, I want glossary term links (autolink, `:term`, preview) to carry the site base so they don't 404. (#61) | High | Open |
| FR-002 | Resolved glossary anchors | As a reader, I want glossary headings to render clean (no literal `{#…}`) with ids equal to the intended anchor, so term fragments resolve. (#63) | High | Open |
| FR-003 | Base-prefixed component links | As a reader, I want Related/Audience/OnThisPage/`routeFor` links base-prefixed via one shared helper. (#61) | High | Open |
| FR-004 | Correct authored links | As a reader, I want hand-authored internal links (root-absolute + bare-relative-on-leaf) corrected to base-aware form that resolves. (#61) | High | Open |
| FR-005 | Fail-closed link gate | As a maintainer, I want a base-aware built-output link gate that fails on any 404-ing internal link, plus a tightened source gate. (#62) | High | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Zero internal 404s | The built `example/dist` has 0 base-less internal hrefs and 0 internal links that resolve (as URLs) to a missing page. | Correctness | High | Open |
| NFR-002 | Single base-prefix source | Component base-prefixing goes through one shared `withBase()` helper; the glossary twins (autolink/`:term`/preview) share one base-aware URL builder. No cloned base logic. | Maintainability | High | Open |
| NFR-003 | Gate is mutation-true | The new built-output gate is RED on today's `dist` and GREEN after the fixes; re-introducing a base-less/relative-404 link reds it. | Reliability | High | Open |
| NFR-004 | No regressions | Existing build/a11y/doc gates stay green; external/mailto/anchor links and correct directory-index relative links are untouched. | Reliability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Thread base into remark | Prefix the base in the glossary remark plugins by threading the configured `base` via the established `normalizeBasePrefix` pattern (config.ts), keeping the autolink + `:term` + preview URL builders single-sourced. | Technical | High | Open |
| C-002 | One `withBase()` for components | Route `metadata.ts routeFor`, `Related.astro`, `OnThisPage.astro`, `Audience.astro` through one shared base helper (reads `import.meta.env.BASE_URL`). | Technical | High | Open |
| C-003 | `.md`-relative authoring | Re-author internal content links as `./target.md` (Astro emits the correct base-prefixed route and the source gate resolves them); fix the confirmed offenders. | Technical | High | Open |
| C-004 | Block-form glossary anchors | `generate.ts` emits the supported block-form heading attribute (or adds inline-trailing support to markua-attributes); generated pages contain no literal `{#`. | Technical | High | Open |
| C-005 | Base-aware dist gate | Add `assert:no-broken-links` walking `example/dist`, resolving each internal href as a URL against the base (trailing-slash dir semantics), wired into CI; tighten `check-links.mjs` to fail root-absolute + extensionless-relative internal doc links. | Technical | High | Open |
| C-006 | Changelog + ADR | Dated changelog fragment; a short ADR/convention note for the base-aware-link + fail-closed-gate contract. | Process | Low | Open |

### Key Entities

- **Internal link**: any href to an in-site route; must carry the base and resolve as a URL (trailing-slash directory semantics).
- **`withBase()` helper**: the single base-prefixing function for component-generated hrefs.
- **Glossary term URL builder**: the single base-aware `/glossary/<context>/#<anchor>` source shared by autolink, `:term`, and preview.
- **Link gate**: `assert:no-broken-links` (built-output, base-aware) + the tightened source `check-links.mjs`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 base-less internal hrefs in `example/dist` (was ~30, incl. 21 glossary).
- **SC-002**: 0 internal links in `example/dist` that resolve (as a URL) to a missing page (was ≥8 relative/authored + all glossary).
- **SC-003**: 0 generated glossary headings contain literal `{#`; every term link's `#anchor` matches a real heading id.
- **SC-004**: the base-aware `assert:no-broken-links` gate is RED on the pre-fix `dist` and GREEN after; the source gate fails on a root-absolute/extensionless-relative internal doc link.
- **SC-005**: existing build/a11y/doc gates remain green; external/anchor/directory-index-relative links unaffected.

## Issue Traceability

- **#61** → FR-001 (glossary base), FR-003 (components), FR-004 (authored/relative), NFR-001/002, C-001/002/003
- **#62** → FR-005, NFR-003, C-005
- **#63** → FR-002, C-004
