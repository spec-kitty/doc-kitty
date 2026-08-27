# Mission Specification: Glossary + Contextive

**Mission Branch**: `feat/glossary`
**Created**: 2026-08-26
**Status**: Draft (rev 2 — post-spec adversarial squad folded in)
**Input**: Multi-context project glossary sourced from a Contextive `.contextive/definitions.yaml`, with per-section auto-linking, hover previews, an auto per-page "On this page" block, and a `:term` escape hatch. Design decided with the owner and captured in `docs/plans/features/glossary-and-contextive.md`.

## Overview

M4 gives a docsite a **glossary of domain terms** drawn from a single Contextive
definitions file, and **auto-links** the terms where they appear in prose so a reader
never meets an undefined term. The same file that powers the site also powers the
author's IDE (the Contextive editor extension), so vocabulary is maintained once.

Terms are grouped into **bounded contexts** (the same term can mean different things in
different contexts). The glossary renders one page per context; a page declares which
context it belongs to, and the auto-linker uses that to link the right definition — and
**refuses to guess** on an unresolved collision, warning the author instead.

Only the example site's content (`example/docs/**` + an example definitions file) is
rendered, auto-linked, and asserted; the toolkit's own `docs/**` stays doc-sanity only.

## Domain Language *(canonical terms — use these, avoid the banned synonyms)*

- **Glossary term** (or **term**) — a named vocabulary entry `{ name, definition, aliases,
  examples, meta }`. Banned synonyms: keyword, entry, word.
- **Bounded context** (or **context**) — a named grouping of terms (a DDD bounded
  context); the unit that disambiguates same-named terms. Banned synonyms: domain, namespace.
- **Alias** — an alternative surface form of a term; treated exactly like the term's name
  for both linking and collision detection.
- **Definition** — the term's meaning, authored as markdown.
- **Glossary page** — a generated page listing one context's terms (`/glossary/<context>/`).
- **Glossary link** — an auto-inserted or `:term`-authored link from a term occurrence in
  prose to its definition.
- **Term collision** — a data condition: the same surface form (name or alias) is defined
  in two or more contexts.
- **Unresolved collision** — a resolution condition: a term collision that the page's
  declared context cannot resolve (no `glossary_context`, or the surface form is absent
  from the page's context but present in two or more others). An unresolved collision is
  never auto-linked.
- **Definitions file** — `.contextive/definitions.yaml`.
- **"On this page" block** — the auto-generated per-page section below the content listing
  the page's external references, related pages, and the glossary links it used.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Author maintains one definitions file, gets browsable pages (Priority: P1)

An author keeps terms in the definitions file. On build, the site generates a glossary hub
and one page per bounded context, each term rendered with its definition (markdown),
aliases, and examples, at a stable anchor.

**Independent Test**: Add two contexts with terms to the example definitions file, build,
and confirm `/glossary/`, `/glossary/<context>/`, and per-term anchors exist with rendered
definitions.

### User Story 2 — Reader meets a term and reaches its definition (Priority: P1)

A reader on a docs page sees a term auto-linked at its first eligible mention in each
section; hovering shows the definition; clicking opens the full definition in a new tab.

**Independent Test**: On an example page whose context defines "cargo", confirm the first
eligible "cargo" per section is a link (regardless of its capitalization), the hover preview
shows the definition, and the click target is the context glossary anchor in a new tab.

### User Story 3 — Unresolved collision is never mis-linked (Priority: P1)

A term defined in two contexts (e.g. "policy" in `hr` and `networking`) appears on a page.
If the page declares one of those contexts, it links there; otherwise it is an unresolved
collision — left unlinked, with a build warning naming the term and the competing contexts.

**Independent Test**: A page with `glossary_context: hr` links "policy" to `hr`; a page with
no context leaves "policy" plain text and the build log emits the greppable warning line;
`:term[policy]{context=hr}` forces the link.

### Edge cases

- A term inside a code span/block, a heading, an existing link, or frontmatter is **never**
  rewritten (guaranteed by ancestor node type).
- A malformed definitions file → build fails with a message naming the offending
  context/term/field.
- A page with `glossary_autolink: false` gets no auto-links.
- A term matching a common word is suppressed via the ignore-list.
- With JavaScript off, glossary links are ordinary anchors and the "On this page" block is
  present; only the hover preview is unavailable.

## Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-001 | Load the glossary from the definitions file (`contexts[] → terms[] → {name, definition, aliases, examples, meta}`); the feature activates only when the file is present. With no file: the build succeeds, no `/glossary/` route is produced, and no auto-links appear. | High | Open |
| FR-002 | Validate the loaded file against the pinned Contextive schema; invalid input is **build-fatal** with a message naming the offending context/term/field. | High | Open |
| FR-003 | Generate one glossary page per context at `/glossary/<context>/` plus a `/glossary/` hub listing contexts; each term has a deterministic anchor slugified from its name. Render a context's `domainVisionStatement` (if present) on its page. | High | Open |
| FR-004 | Render `definition` and `meta` as markdown through the site's real markdown pipeline (never plain text); a URL in `meta` with a non-allowlisted scheme is **build-fatal** (consistent with FR-002 / the M5 `safeHref` posture). | High | Open |
| FR-005 | Auto-link the **first eligible occurrence per section** of each term/alias, where a **section** is the span from an H2 (inclusive) to the next H2 (exclusive), body content before the first H2 is one implicit section, and H3+ blocks belong to their parent H2 section. "Eligible" = not excluded by FR-006. | High | Open |
| FR-006 | Never auto-link inside code spans/blocks, headings, existing links, or frontmatter (enforced by ancestor node type). Match **whole-word, case-insensitive** (so natural prose capitalization links); a substring inside a larger word never matches. | High | Open |
| FR-007 | Resolve a term occurrence by the page's `glossary_context`: single candidate context → link; multiple candidates → link the page's context if it is a candidate, else it is an **unresolved collision** — do not link, and emit a build warning. | High | Open |
| FR-008 | Support an ignore-list of terms never auto-linked, and a per-page `glossary_autolink: false` frontmatter opt-out. | Medium | Open |
| FR-009 | A glossary link shows a **custom popover** definition preview on hover/focus (not the HTML `title` attribute) and, on click, opens the full definition in a new tab (`target="_blank"`, `rel="noopener"`). | High | Open |
| FR-010 | Append an auto-generated **"On this page" block** below the content (not authored inline) with labelled sub-lists: the page's external references, its related pages, and the distinct glossary links it used. Omit the block (or a sub-list) when its content is empty; dedup glossary links by distinct term; stable order. | Medium | Open |
| FR-011 | Provide a `:term[text]{context=<ctx>}` remark directive (plain `.md`) that explicitly links a term to a chosen context, with a suppress form (`link=false`); it resolves an unresolved collision and overrides false positives. | High | Open |
| FR-012 | Treat aliases exactly like the term name for both auto-linking and collision detection. | High | Open |
| FR-013 | Place the glossary under a default **Reference** nav group, driven by `_meta/sections.yaml`, so a consumer can relocate it without touching content or theme; generated pages appear in the sidebar and the site's generators (sitemap, agent API, llms.txt). | Medium | Open |
| FR-014 | Ship an example demonstrator: a definitions file with two contexts and at least one real cross-context collision; example pages exercising auto-link, hover, and `:term`; **plus a malformed fixture** proving FR-002. Gate the example page(s) in the a11y `AXE_PAGES`, and assert the page actually produced ≥1 auto-linked term and ≥1 `:term`-resolved collision **before** the accessibility scan runs (non-vacuity). | High | Open |
| FR-015 | Update docs of record (feature page, a glossary architecture doc) and author the plan-phase ADRs (see ADR impact in the feature page). | Medium | Open |

## Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|----|-------------|-----------|--------|
| NFR-001 | Accessibility of glossary links and the hover preview | WCAG 2.2 AA; the preview satisfies 1.4.13 by **direct assertion** — hoverable (pointer can move onto it), Esc-dismissible, persistent (no auto-hide timer while hovered/focused) — in both colour modes | Open |
| NFR-002 | `ci-ok` stays green at every work-package boundary | code-quality, doc-sanity, build-example, a11y all pass | Open |
| NFR-003 | Build stays browser-free; the preview script loads only where glossary links exist | 0 headless-browser processes spawned by build-example; a glossary page **requests** the preview chunk and a glossary-free control route **does not** (Playwright network capture) | Open |
| NFR-004 | Deterministic build-time linking | building the same input twice yields **byte-identical** generated pages, anchors, and injected links | Open |
| NFR-005 | No-JS fallback | with JS off, glossary links are plain anchors and the "On this page" block is present; only the hover preview is absent | Open |
| NFR-006 | Self-contained, no external service | no CDN or network call at build or runtime; Contextive **Community file** only, never a Cloud API | Open |
| NFR-007 | Collision safety is never bypassed | an unresolved collision is never auto-linked; the build emits a **stable, greppable warning** (e.g. prefix `[glossary] unresolved collision "<name>" in <ctxA>, <ctxB> — left unlinked`), **one per distinct unresolved term per page**, and the build still **exits 0** | Open |

## Constraints

| ID | Constraint | Type | Status |
|----|------------|------|--------|
| C-001 | Full multi-context support in v1 (not a single un-scoped context). | Scope | High |
| C-002 | Contextive **Community** file format only; Cloud edition APIs are out of scope. | Scope | High |
| C-003 | Source is the single conventional definitions file; multi-file/merged sources are out. | Scope | Medium |
| C-004 | Only `example/docs/**` + the example definitions file are auto-linked/rendered/asserted; the toolkit's own `docs/**` is doc-sanity only. | Technical | High |
| C-005 | Activation is presence-driven; auto-linking is on by default with the ignore-list, `glossary_autolink: false`, and `:term` opt-outs. | Technical | High |
| C-006 | PlantUML and build-time static-SVG diagram rendering are out (issue #13), not part of M4. | Scope | High |
| C-007 | The new `glossary_context` and `glossary_autolink` frontmatter fields require a **new ADR** in the plan phase (per ADR-0009's "adding a field means a new ADR" rule). | Technical | Medium |

## Key Entities

- **Definitions file** — `.contextive/definitions.yaml`; the source of truth; also read by the Contextive IDE extension.
- **Context** — a named group of terms; maps to a generated glossary page and a nav node.
- **Term** — `{ name, definition (markdown), aliases[], examples[], meta }`; renders to an anchored definition.
- **Term/alias → anchor map** — the build-time lookup, parsed and validated once, shared by the page generator, the auto-linker, and `:term`.
- **"On this page" block** — the per-page generated section composing external references, related pages, and glossary links used.

## Success Criteria

- **SC-001** — An author adds a term to the definitions file and, after a build, it appears on its context's glossary page and auto-links at first eligible use per section on pages in that context, with zero manual page edits.
- **SC-002** — An unresolved collision is never linked to the wrong context: it links only when the page's context resolves it, and otherwise stays plain text with the greppable build warning (build still exits 0).
- **SC-003** — A reader sees a term's definition without leaving the page (hover popover) and opens the full definition in a new tab (click), both to WCAG 2.2 AA including 1.4.13.
- **SC-004** — A reader with JavaScript disabled still reaches every definition (plain links) and sees the "On this page" block.
- **SC-005** — A glossary-free page loads no glossary/preview JavaScript.
- **SC-006** — A malformed definitions file fails the build with a message naming the offending context/term/field.

## Assumptions

- The example carries a realistic definitions file (2 contexts incl. a `policy` collision) as demonstrator + test fixture, plus a separate malformed fixture kept out of the normal build.
- The Contextive schema version is pinned and validated on load (schema drift is a known risk).
- Reasonable defaults: anchors are slugified from the term name; a small sensible ignore-list ships; `glossary_context` is page-local (not inherited) in v1.

## Open questions for planning *(not blocking the spec — captured for the plan/ADR phase)*

- **References-block data channel (biggest architectural risk).** M3 renders
  `external_references`/`related` as prop-less self-resolving carrier-body components
  (ADR-0017), which have no channel to the remark-pass `file.data` where "glossary links
  used" originates. The plan must choose: publish the used-terms out of remark into a
  channel the block can read, or render the combined block from rehype — likely a companion
  to / amendment of ADR-0017. This decides whether FR-010 is "reuse/extend" or "new block".
- **Generated-page registration.** Whether glossary pages are codegen'd as files into the
  `docs` collection (so `sections.yaml`, sidebar, sitemap, agent API, and `llms.txt` pick
  them up — likely required by FR-013) or served by an injected route (invisible to those).
- **`remark-directive` dependency + plugin ordering** for `:term` and the auto-linker
  (after gfm; ancestor-type guard; explicit deck behavior).
- Whether a global config toggle should gate auto-linking on top of the presence trigger.

## Out of scope

- Contextive Cloud APIs; multi-file `.contextive` merging; build-time diagram/PlantUML rendering (#13).
