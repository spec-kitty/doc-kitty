# Mission Specification: Print and PDF output: print layer, section and whole-site PDFs

**Mission Branch**: `feat/print-pdf-output`
**Created**: 2026-11-20
**Status**: Draft
**Input**: Epic #377 with stories #378, #379, #380, #381, #382 and tasks #385 to #397, plus a whole-site PDF (operator ruling) and the operator guidance comment on #377 of 2026-11-20. Out of scope: #383 (paged-media polish) and #384 (pandoc/Typst spike).

## Intent Summary

This mission runs in brief-intake mode. The brief is the operator's stored mission prompt plus the full text and comments of the issues above, which together state the objective, constraints, approach and acceptance criteria. No interview questions were needed (comprehensive brief: 0 gap questions). The run is unattended, so the operator's binding rulings stand in for the confirmation round; product-direction questions that arise go to #377 as `[ESCALATION]` comments.

- **Primary actors**: a reader who prints a page from the browser; a site maintainer (consumer) who opts sections into PDFs; the CI pipeline that builds and publishes those PDFs.
- **Trigger and outcome**: a reader presses Ctrl+P or the print control in either theme and gets a clean, light document. A maintainer sets `pdf: true` on a section (or turns on the whole-site PDF), and the next deploy on main publishes `/pdf/<section>.pdf` (and the whole-site PDF) that two CI runs reproduce byte for byte.
- **Invariant**: a print or PDF never comes out dark, never includes slide decks or OpenAPI overview pages, and never appears in the sitemap, search, feeds, `llms.txt`, the agent API or the OKF bundle.
- **Boundary**: the whole-site PDF is a print of the built site in reading order. It is not a book or manuscript content type, which stays *Won't*.

## Purpose

Today a reader in dark mode who prints a doc-kitty page gets a near-black PDF, and screen chrome (header, lightbox triggers, machine links) prints with it. A site also cannot offer a section, or the whole documentation set, as one PDF. This mission makes every page print cleanly and lets a site publish deterministic, tagged PDFs built in CI from the site it already renders.

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| Print layer | The print stylesheet plus the force-light print hook, on for every site | "print theme" |
| Print document | One HTML document that holds a whole section, or the whole site, in reading order behind a cover page | "book", "manuscript" |
| Section PDF | The PDF of one section's print document, published at `/pdf/<section>.pdf` | "export" |
| Whole-site PDF | The PDF of the whole-site print document, opt-in at site level | "book", "site export" |
| Appendix section | A section that the whole-site PDF places after the main body | |
| PDF exclusion | A section id or page kind that never enters a print document | |
| Print control | The page control that prints the page and, when available, offers the section PDF | "print button" alone |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Print any page cleanly, in either theme (Priority: P1)

A reader on any doc-kitty page, in the light or dark theme, prints the page or saves it as PDF. The output is light, keeps the page title, status, date and metadata band, and leaves out the header, sidebar, table-of-contents rail, search, theme select, pagination, lightbox triggers and dialog, code copy buttons and deck-hub chrome. Diagrams fit the page, code wraps, external links show their URL, and closed disclosures print open.

**Why this priority**: a reader in dark mode prints a black page today, on every site.

**Independent Test**: emulate print media on fixture pages in both themes and inspect what is displayed and the resolved colours.

**Acceptance Scenarios**:

1. **Given** a reader in the dark theme, **When** they print, **Then** the page background is light and diagram colours resolve to their light values, and afterwards their dark theme is restored without being written to storage.
2. **Given** a browser that prints without firing the print event, **When** the dark theme prints, **Then** a stylesheet-only fallback still gives light colours.
3. **Given** a page with an external link, an internal link and a glossary link, **When** it prints, **Then** only the external link shows its URL.
4. **Given** a long code line or a wide diagram, **When** it prints, **Then** the code wraps and the diagram fits the printable width.

---

### User Story 2 - Download a section, or the whole site, as one PDF (Priority: P2)

A maintainer marks a section `pdf: true` in `sections.yaml`, and optionally turns on the whole-site PDF in the site config. On the next deploy on main, readers can download `/pdf/<section>.pdf` and the whole-site PDF. Each opens on a cover page (site name, section label and purpose, build date, table of contents), then holds every published page in reading order, one page per sheet, with working in-document links.

**Why this priority**: it is the second half of the epic's "done when" and the operator's whole-site ruling.

**Independent Test**: build the example with one PDF section and the whole-site PDF on, run the PDF command, and check the files, their structure and their reproducibility.

**Acceptance Scenarios**:

1. **Given** a section with `pdf: true`, **When** the site builds, **Then** a print document exists for it and for no other section, and it is hidden from search, sitemap, feeds and agent surfaces.
2. **Given** the built site, **When** the PDF command runs twice with the same source date, **Then** the PDFs are byte-identical.
3. **Given** a section holding a slide deck or an OpenAPI overview page, **When** its print document renders, **Then** that page is absent. A configured exclusion list can add sections or page kinds to the exclusions, but can never bring decks or OpenAPI overview pages back.
4. **Given** a section whose whole-site placement is appendix, **When** the whole-site PDF renders, **Then** that section comes after the main body; its own section PDF, if enabled, is unchanged.
5. **Given** the whole-site PDF is on, **When** it renders, **Then** it holds every section that is not excluded, whatever that section's own PDF setting, then pages outside any registered section, then appendix sections.
6. **Given** a PDF, **When** the gate checks it, **Then** it has pages, a structure tree, mark info, the site language, and as many outline entries at the page-title level as the document has printed pages.

---

### User Story 3 - Print from a page control (Priority: P2)

A site turns on the print control. Each page shows a "Print / Save as PDF" control. When the page's section has a PDF, the control also offers "Download section PDF".

**Why this priority**: discoverability; the browser's own print already works after Story 1.

**Independent Test**: build with the control on, open a page in a PDF section and a page outside one, check the control, its name, keyboard reach and print visibility.

**Acceptance Scenarios**:

1. **Given** the control is off (default), **When** a page renders, **Then** no control appears.
2. **Given** the control is on, **When** a reader activates it with the keyboard, **Then** the browser print dialog opens.
3. **Given** the page's section has a PDF, **When** the control renders, **Then** it links the section PDF; otherwise no download link appears.
4. **Given** the control is on, **When** the page prints, **Then** the control itself is hidden.

---

### User Story 4 - CI builds, checks and publishes the PDFs (Priority: P2)

A maintainer opens a PR touching code, example content or workflows. A path-scoped, advisory CI lane prints the PDFs from the drafts-off build, runs the PDF gate and the determinism check. On main, the deploy publishes the PDFs with the site.

**Why this priority**: without CI the PDFs drift or break silently.

**Independent Test**: inspect the workflow wiring and run the lane's steps locally against a built dist.

**Acceptance Scenarios**:

1. **Given** a change only to this repository's own `docs/`, **When** CI runs, **Then** the PDF lane is skipped.
2. **Given** a code change, **When** CI runs, **Then** the PDF lane runs without a second site build and does not block `ci-ok`.
3. **Given** a push to main, **When** deploy runs, **Then** `dist/pdf/*.pdf` is published with the site; pull requests publish nothing.
4. **Given** the PDF step fails during deploy, **When** deploy runs, **Then** the deploy fails and the previous site stays live, so no published page links a missing PDF.

### Edge Cases

- The whole-site PDF is `/pdf/site.pdf`. A section with id `site` cannot enable its own PDF (the file names would collide); the build fails with a named error. Its print route `/print/site/` would not collide, but the rule is kept simple: the name `site` is reserved for PDFs.
- A section with `pdf: true` and no published pages fails the gate rather than emitting an empty PDF.
- Before the PDF step runs (pull requests, local builds), the print control's download link points at a PDF that is not in the dist yet. The link checks treat the expected PDFs (known from config) as valid targets, and every other `/pdf/` link as broken.
- An unknown `pdf` value in `sections.yaml` is an advisory warning, never a hard failure; it is treated as absent (the site default applies).
- A draft page follows `DK_PUBLISH_DRAFTS`; a page in an excluded folder is absent.
- Client-mode diagrams must have re-rendered in the light theme before the PDF is printed; a timeout fails the command with a clear error.
- Two pages with the same heading text in one print document get distinct anchors.
- Links in a print document become absolute site URLs, so the print stylesheet must not print their URLs and the build gate checks them against the built site itself.
- No `<tabs>` component exists in this repository and the example has no MDX; the tabs print rule ships, and its test is descoped with a note.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Print chrome hidden | As a reader, I want printing to hide the header bar, sidebar, TOC rail, search, theme select, pagination, lightbox triggers and dialog, code copy buttons, deck-hub chrome, machine entry points and page formats, so that only content prints. (#385) | High | Open | [build] | no |
| FR-002 | Page identity kept | As a reader, I want the page title, status, updated date and metadata band to print, so that the printout identifies itself. (#385) | High | Open | [ratchet] | yes — paired with FR-001 on the same fixture page |
| FR-003 | Dark prints light | As a reader in dark mode, I want printing to switch to the light theme and restore mine afterwards without storing it, without client-mode diagrams re-rendering into raw source mid-print (they keep their rendered state; build-mode diagrams follow the light tokens), so that I never print a dark page. (#386) | High | Open | [build] | no |
| FR-004 | Stylesheet-only light fallback | As a reader whose browser prints without the print event, I want a fallback derived from the site's resolved tokens to force light colours, so that the print is light anyway. (#386) | High | Open | [build] | no |
| FR-005 | Print surfaces and width | As a reader, I want a white page, full printable width, fills kept only on asides, code blocks and diagrams, and each diagram scaled to the printable width and no taller than the printable page height, so that the print is legible. (#385) | High | Open | [build] | no |
| FR-006 | Page breaks and wrapping | As a reader, I want headings never to end a page, figures, diagrams, asides, code blocks and table rows to avoid splitting, paragraphs with orphans/widows of 3, and code that wraps, so that nothing is cut. (#387) | Medium | Open | [build] | no |
| FR-007 | External link URLs | As a reader of paper, I want external content links to print their URL after the text, and internal, glossary, anchor, hero and metadata-band links not to, with a theme able to turn this off. (#388) | Medium | Open | [build] | no |
| FR-008 | Disclosures print open | As a reader, I want disclosures to keep printing open; the print rules now in the disclosure and OpenAPI sheets keep their behaviour (folded into the print layer or left in place), the disclosure print fallback keeps working and the new print hook does not conflict with it, and the deck print rules stay untouched. (#386, #389) | Medium | Open | [ratchet] | yes — paired with the FR-009 print test on a page with a closed disclosure |
| FR-008a | Tabs print every panel | As a reader, I want every tab panel to print with the tab list hidden. The rule ships; the per-panel label and the browser assertion are descoped because the repository has no tabs component and the example has no MDX. (#389) | Low | Open | [build] | yes — no fixture exists; recorded as a descope |
| FR-009 | Print-media browser test | As a maintainer, I want a browser test that emulates print in both themes on the diagram, Markua, Gherkin and OpenAPI fixture pages and asserts hidden chrome, light background, no laid-out lightbox trigger and light diagram tokens, running in the existing a11y lane on the dist it already receives. (#390) | High | Open | [build] | no |
| FR-010 | Printing guide | As a site author, I want a "Printing and PDF" how-to guide covering what prints, dark-prints-light, theme overrides and paper size, and the section and whole-site PDFs. (#391) | Medium | Open | [build] | no |
| FR-011 | ADR-0081 | As a maintainer, I want an ADR recording PDF from built HTML via Chromium, why not pandoc or WeasyPrint, the `pdf` configuration and its resolution order, the reserved `/print/` route and `/pdf/` URLs, date pinning, the whole-site PDF scope boundary, exclusions, appendix sections, pandoc + Typst as the deferred PDF/UA route, and the operator's rulings. (#382) | High | Open | [build] | no |
| FR-012 | `pdf` key in `sections.yaml` | As a maintainer, I want a section's `pdf` key to set two things separately: whether the section gets its own PDF, and its whole-site placement (main body, appendix, or omitted), with `pdf: true` / `pdf: false` as shorthand for the first; every registry reader carries it, and an unknown value is an advisory warning and treated as absent, so the site default applies. (#382, operator guidance) | High | Open | [build] | no |
| FR-013 | Site `pdf` option | As a maintainer, I want a site-level `pdf` option for a section default, the whole-site PDF switch and the exclusion list (paper size is a theme `@page` concern, not a config key), with an authored section value winning over the site default. (#382) | High | Open | [build] | no |
| FR-014 | Section print document | As a reader, I want `/print/<section>/` for each PDF-enabled section only, rendering every published page in sidebar/hub order through the site's own content rendering, behind a cover page with site name, section label and purpose, pinned build date and a table of contents, one page per sheet with its hero; the document has one top-level heading and each page title sits one level below it. (#380) | High | Open | [build] | no |
| FR-015 | Whole-site print document | As a reader, I want `/print/` for a site with the whole-site PDF on, holding every section that is not excluded, whatever its own PDF setting, in registry order with appendix sections last, behind a cover page with the site title and description. (operator ruling) | High | Open | [build] | no |
| FR-016 | Links and anchors in print documents | As a reader, I want per-page namespaced ids, in-document links for pages in the same document, and absolute site URLs for every other link. (#380) | High | Open | [build] | no |
| FR-017 | Exclusions | As a maintainer, I want slide decks and OpenAPI overview pages always excluded from every print document (a fixed floor no setting removes), hub card grids and the hub surface-link footer left out, and further excluded sections and page kinds configurable on top of that floor. (#380, operator guidance) | High | Open | [build] | no |
| FR-018 | Hidden from discovery | As a maintainer, I want print documents `noindex`, out of search, the sitemap, `llms.txt`, the agent API, RSS and the OKF bundle, with the route reserved against collisions. (#380) | High | Open | [build] | no |
| FR-019 | Print document build gate | As a maintainer, I want the build gate to assert a print document for each enabled section (and the whole site when on) and for no other. (#380) | High | Open | [build] | no |
| FR-020 | `dockitty-pdf` command | As a maintainer, I want a command (`--dist`, `--base`, optional `--sections`) that serves a built dist and prints each print document to `dist/pdf/<name>.pdf`, forcing the light theme and waiting for client-mode diagrams to finish re-rendering, with exit codes 0/1/2 like `dockitty-export-okf`, using the already-installed Chromium. (#392) | High | Open | [build] | no |
| FR-021 | PDF metadata and date pinning | As a maintainer, I want the PDF title (the section label, or the site title for the whole-site PDF), language and producer set and both PDF dates pinned to `SOURCE_DATE_EPOCH` (falling back to the last commit time), recorded as documented build-clock fields. (#393) | High | Open | [build] | no |
| FR-022 | Determinism test | As a maintainer, I want a test that prints twice with the same source date and asserts byte-identical PDFs, covering build-mode Mermaid, PlantUML and code blocks, reporting the first differing offset and its object. (#394) | High | Open | [build] | no |
| FR-023 | PDF gate | As a maintainer, I want a gate asserting one PDF per enabled print document and no other, each with at least one page, structure tree, mark info, site language and as many outline entries at the page-title level as printed pages; no PDF/UA claim. The optional font-embedding check is descoped: runners have no `pdffonts`. (#395) | High | Open | [build] | no |
| FR-024 | Advisory CI lane | As a maintainer, I want a `pdf` lane that runs only for code, example content or workflow changes, reuses the drafts-off dist (not the drafts-on a11y dist #396 names, because deploy publishes drafts off) and the existing Chromium, runs the command, gate and determinism test, and stays out of `ci-ok` for now. (#396) | Medium | Open | [build] | no |
| FR-025 | Deploy and served surfaces | As a reader, I want the deploy on main to publish `dist/pdf/*.pdf` with the site, a PDF failure to fail the deploy, the served-surfaces record and the build gate to know the expected PDFs from config, and the PDFs to stay out of the sitemap, `llms.txt`, the agent API, RSS and the OKF bundle. (#397) | Medium | Open | [build] | no |
| FR-026 | Print control | As a site, I want an opt-in (page-chrome option, off by default), keyboard-reachable, named print control, placed by the page-title carrier and restylable or hideable by a theme through its class, that calls the browser print and, when the section has a PDF, offers "Download section PDF", hidden in print and AA in both themes. (#379) | Medium | Open | [build] | no |
| FR-027 | Configuration and migration docs | As a consumer, I want the configuration reference, section-registry architecture page, CI/CD docs and a migration note updated, with changelog fragments. (#382, #396, #379) | Medium | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Determinism | Two PDF runs on the same dist with the same `SOURCE_DATE_EPOCH` differ in 0 bytes. | Reliability | High | Open |
| NFR-002 | Contrast | The print control meets WCAG 2.2 AA (text 4.5:1, target 24x24 px) in both themes; axe reports 0 violations on its fixture page. | Accessibility | High | Open |
| NFR-003 | Lane cost | The PDF lane adds no second site build and completes the example's PDFs in under 5 minutes of lane time. | Performance | Medium | Open |
| NFR-004 | No new runtime dependency | The published toolkit gains 0 new runtime or peer dependencies; the PDF command reuses the existing optional `playwright` peer. | Maintainability | High | Open |
| NFR-005 | Unchanged surfaces | Sitemap and agent-index URL counts of the example stay at their current pins (78 and 73) after the print routes are added. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | PDF location | PDFs live in `dist/pdf/` and deploy with the site on main only; `/pdf/<section>.pdf` and `/pdf/site.pdf` are public URL contracts. | Business | High | Open |
| C-002 | Opt-in | Section PDFs are opt-in per section; the whole-site PDF is opt-in at site level; the print layer is on for every site. | Business | High | Open |
| C-003 | Not a manuscript type | The whole-site PDF adds no book or manuscript content type; that plan stays *Won't*. | Business | High | Open |
| C-004 | Lane advisory | The PDF lane is not added to `ci-ok`; joining it is an operator decision. | Technical | High | Open |
| C-005 | Built output only | The PDF lane reads built output only and never runs a generated-section producer (#359). | Technical | High | Open |
| C-006 | Theme layer | Print styling is presentation: a theme can override it (ADR-0008, ADR-0011); deck print rules stay untouched. | Technical | Medium | Open |
| C-007 | Out of scope | Paged-media polish (#383) and the pandoc/Typst PDF/UA route (#384) are not delivered; no PDF/UA claim. | Business | Medium | Open |
| C-008 | Do not block on diagram fixes | Delivery does not wait for #369/#370; diagram-heavy sections should wait for those fixes before their PDFs are promoted. | Business | Medium | Open |

### Key Entities

- **Section PDF setting**: per section, whether it has its own PDF (absent means the site default) and its whole-site placement (main body by default, appendix, or omitted).
- **Site PDF settings**: section default, whole-site switch, additional excluded sections and page kinds (on top of the fixed floor: decks and OpenAPI overview pages). Paper size defaults to A4 and a theme overrides it with `@page`.
- **Print document**: name (section id, or the reserved whole-site name), cover data (site name, label, purpose, build date, contents), ordered pages.
- **PDF artefact**: file under `dist/pdf/`, title, language, producer, pinned dates, page count, outline entries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 4 fixture pages printed in each theme (8 cases), 8 of 8 have a light page background, hidden header/sidebar/TOC rail and no laid-out lightbox trigger. — [build] · no-op passable: no
- **SC-002**: The example builds a print document and a PDF for every PDF-enabled section and the whole site, and for no other name. — [build] · no-op passable: no
- **SC-003**: Two PDF runs on the same build produce byte-identical files (100% of PDFs). — [build] · no-op passable: no
- **SC-004**: Every produced PDF passes the structure gate (pages, structure tree, mark info, language, outline entries per printed page). — [build] · no-op passable: no
- **SC-005**: A reader in dark mode who prints any page gets a light result, also when the print event is not fired. — [build] · no-op passable: no

## Assumptions

- Chromium already installed by the shared build composite (Playwright 1.62.1) is the only renderer.
- A4 is the default paper size; a theme switches to Letter through `@page` (no config key).
- The whole-site PDF is named `site`; a section with id `site` cannot enable its own PDF.
- The print control is enabled through the existing page-chrome options rather than a new slot (operator preference), a deliberate deviation from #379's slot wording; a theme restyles or hides it through its class.
- The example enables section PDFs on `guides` (diagram-light) and on `architecture`, the diagram and code fixture section the determinism check needs (build-mode Mermaid, PlantUML, code), and turns the whole-site PDF on to exercise it. C-008's advice (wait for #369/#370 before promoting diagram-heavy PDFs) is for production sites; the example is a fixture.
- In a client-mode diagram site, a browser print keeps the diagrams as they were rendered (the print hook pauses the re-render, which would otherwise print the raw source); build-mode diagrams and the PDF command are light in every case.
- The section's index page becomes the cover body of its print document (its title is the cover title), so no page repeats the document title.

## Dependencies

- Follow-up: #369 and #370 improve diagram fidelity; not blocking.
- Related: #300 gets the two PDF dates as documented build-clock fields.
- Related: #359 generated-section contract; the lane reads built output only.
