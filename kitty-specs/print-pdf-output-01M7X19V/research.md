# Research and decision log: print and PDF output

Code facts are in [research/code-grounding.md](./research/code-grounding.md). Each entry below is a decision the operator's policy lets the mission take itself (obvious or cheap to reverse). Escalations are listed at the end.

## D-01 Print sheet delivery: client-script import, not a global sheet

- **Decision**: `src/lib/print/print.client.ts` imports `print.css` and the generated print-token module; `PageTitle.astro` loads the script.
- **Rationale**: `GLOBAL_COMPONENT_SHEETS` would force a matching `?url` import in `DeckLayout.astro` (which throws otherwise) and put screen-irrelevant rules on the deck. The disclosure precedent keeps the deck clean and the sheet applies before first paint.
- **Alternatives**: a `GLOBAL_COMPONENT_SHEETS` entry (rejected: deck coupling); a `customCss` entry (rejected: theme replacement logic and golden churn either way).

## D-02 Print-token fallback generated from the emitter

- **Decision**: `emitPrintTokenSheet(resolved)` emits the resolved light value of each mode-varying token under `@media print { :root:root[data-theme='dark'] { … color-scheme: light } }`.
- **Rationale**: (0,3,0) beats both `theme.css`'s `:root[data-theme='dark']` and a brand's own dark block regardless of order; light-theme prints are untouched so brand light values survive. No light value is hand-restated.
- **Limit**: a brand that ships per-mode colour in a CSS file (spec-kitty `tokens.css`) gets the Default light palette in the fallback path only; the JS hook gives brand-exact colours. Documented in the guide and ADR.

## D-03 Diagram completion signal

- **Decision**: the client renderer sets `<html data-dk-diagram-theme="light|dark">` after a render settles with no pending scope. The CLI waits for `light` (timeout 30 s, exit 1).
- **Rationale**: waiting for "an `<svg>` exists" passes on the stale dark SVG.

## D-04 `pdf` key shape

- **Decision**: section key `pdf: true | false | { section?: boolean, site?: 'main' | 'appendix' | 'omit' }`. Site option `pdf: { sections?: boolean (default false), site?: boolean (default false), exclude?: { sections?: string[], kinds?: string[] } }`.
- **Rationale**: one key, two independent settings (own PDF; whole-site placement), so an appendix section can still have its own PDF (operator guidance). The authored section value wins over the site default.
- **Unknown values**: advisory warning, treated as default (#382).

## D-05 Exclusion floor

- **Decision**: `kind: Presentation` pages are always excluded; OpenAPI reference pages are never docs-collection entries and so never enter a print document. `exclude.kinds` and `exclude.sections` only add.
- **Rationale**: operator guidance says decks and API overviews are never in a PDF.

## D-06 Reading order (print order)

- **Decision**: depth-first walk of the section's slug tree: a folder's index page, then its children sorted by `sidebar.order` (when set), then title (`en`), then slug. Same comparator family as `selectHubChildren`.
- **Rationale**: `Astro.locals.starlightRoute` is not readable in a `StarlightPage` route's frontmatter (spike, 2026-11-20), so the Starlight sidebar cannot be reused directly. This is a print-specific order, close to hub order (`selectHubChildren` sorts by title) with `sidebar.order` honoured first; ADR-0081 documents it.
- **Index pages**: a section's index page is the cover body of its section document (its title is the cover `<h1>`), and in the whole-site document the section divider `<h2>` carries the index page body. No page title repeats the document title (one-`<h1>` gate, `assert-build-artifacts.mjs:2670-2676`).
- **Pages outside sections**: the docs root index is the whole-site cover body; folders with no registry entry follow the registered main-body sections, by folder name, before appendix sections.

## D-07 Print route rendering

- **Decision**: `StarlightPage` + `render(entry)` per page inside a wrapper component that takes `Astro.slots.render('default')` and rewrites the HTML string.
- **Rationale**: the spike rendered `architecture/` through the real pipeline (11 diagram SVGs, glossary links, one `<h1>`, no `data-pagefind-body`). Same remark/rehype plugins as the site.

## D-08 Id namespacing and links

- **Rewritten links** carry `data-dk-print-link`, and `print.css` skips them in the URL suffix rule, so internal links in PDFs do not print their URL. The link checkers skip `scheme:` hrefs, so the build gate maps every same-site absolute link in a print document back into the dist and fails a dangling one.

- **Decision**: prefix every `id` in a page with `p<N>-`; rewrite `href="#…"`, `xlink:href="#…"`, `url(#…)`, ARIA id references and `#id` selectors inside `<style>` blocks for known ids. Links to a page in the same document become `#p<N>` (or `#p<N>-<frag>`); every other root-relative link becomes an absolute site URL (`site` + `base`).

## D-09 Heading levels and outline

- **Decision**: one `<h1>` (cover). Section document: page titles `<h2>`, content demoted one level (h6 stays h6). Whole-site: section dividers `<h2>`, page titles `<h3>`, content demoted two levels. The gate counts outline items at the page-title depth.

## D-10 PDF post-pass without a library

- **Decision**: Node built-ins only. Overwrite `/CreationDate` and `/ModDate` in place (same width) and append one incremental update with a new Info dictionary (`Title`, `Producer (doc-kitty-pdf/<version>)`, both dates) and a trailer with `/Prev`.
- **Rationale**: no new dependency (NFR-004; a new runtime dependency would be an escalation). Skia emits classic xref tables (PoC on Chromium 157); any other shape fails with exit 1 and a clear message.
- **Dates**: `SOURCE_DATE_EPOCH`, else `git log -1 --format=%ct`, else exit 2.

## D-11 Paper size

- **Decision**: A4 via `@page { size: A4; margin: 18mm 16mm }` in `print.css`; a theme overrides `@page`. No config key.

## D-12 Expectations from config

- **Gate independence**: the build gate derives the expected document names from `sections.yaml` (through the extended `vocabulary-loader.mjs`) and the evaluated site config (`site-config-eval.mjs`), not from `print/manifest.json`; it reads the manifest only for page counts and titles.

- **Decision**: `defineDocKittyIntegrations` writes `DK_PDF_OPTIONS`; the route writes `dist/print/manifest.json` at build end (names, titles, page counts, title level). Served surfaces, the control, the link check and the gates read config or that manifest, never `dist/pdf/`.

## D-13 Print control placement

- **Test dist**: the example turns `printControl` on only if the a11y visual baselines are unaffected; otherwise a chrome fixture dist (`CHROME_DISTS`) carries it. Decided in WP06 after reading `tests/a11y/visual.spec.ts`.

- **Decision**: `chromeOptions.printControl` (default false), rendered by `PageTitle.astro` after the metadata band; theme restyles or hides it through `.dk-print-control`. No new slot (operator preference over #379's slot wording).

## D-14 CI lane

- **Decision**: job `pdf`, `needs: [detect-changes, build-example]`, `if: run_build_example`, Playwright container, downloads `example-dist-nodrafts`, runs CLI, gate, determinism. Not in `REQUIRED_LANES`.
- **Deploy**: `deploy.yml` runs `dockitty-pdf` after the composite build with `SOURCE_DATE_EPOCH` from the commit; a failure fails the deploy.

## D-15 Example opt-in

- **Decision**: `architecture` (Mermaid build-mode, PlantUML, code) and `guides` get section PDFs; the whole-site PDF is on; `rhetoric` is an appendix; `presentations` is excluded by the floor.

## D-03a Client-mode diagrams during a browser print

- **Decision**: `print.client.ts` sets `data-dk-printing` on `<html>` before forcing light and clears it a task after `afterprint`; the client renderer's `[data-theme]` observer returns early while it is set.
- **Rationale**: the re-render resets each node to its Mermaid source synchronously and redraws asynchronously, so a print snapshot taken in between shows raw source. Pausing keeps the rendered SVG (in the reader's theme). Build-mode diagrams use `var(--dk-diagram-*)` and follow the light tokens; the PDF command forces light before rendering and waits for the completion signal, so PDFs are always light. Documented limit; #369 is the place to make client diagrams theme-agnostic.

## D-01a Chrome-baseline goldens

- **Finding**: Astro emits `print.<hash>.css` as a file (the sheet exceeds the inline limit), and pages link it. The lightbox rule stays in `dk-components.css` (no change to that file), so only the new file block and its `<link>` differ. A literal, narrow normaliser in the chrome harness removes exactly those, with a control test proving a changed non-print rule still fails.

## D-16 Tabs

- **Decision**: ship the `starlight-tabs` print rule, descope its browser assertion (no tabs component, no MDX).

## D-17 Font check

- **Decision**: descope the optional `pdffonts` check (no tool on runners).

## Ordering against #369/#370

Delivery does not wait for them (C-008). Diagram-heavy sections should wait for those fixes before their PDFs are promoted; the guide says so.

## Escalations

None opened. The lane stays advisory, as #396 asks (C-004); joining `ci-ok` later is listed as an open operator decision in the PR, not escalated, because nothing in this mission makes it required.

## Supply chain

No dependency added, upgraded or removed (DIRECTIVE_051 controls: not applicable). `playwright@1.62.1` is an existing optional peer, exact-pinned.
