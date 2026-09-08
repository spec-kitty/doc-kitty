# Phase 1 Data Model: Example content from ars-rethorica

Content/config entities (this is a content + light-pipeline mission; "data model" =
page/frontmatter/config shapes, not a database).

## Showcase page (converted chapter / intro / preamble)
- **Location**: `example/docs/rhetoric/<...>.md` (section = first path segment `rhetoric`).
- **Frontmatter**: `title` (chapter title, incl. editor-added titles from the source),
  `description` (≤180 chars), `doc_status: active`, `updated`, `type: Reference`,
  `kind: Explanation`, `tags: [rhetoric, ...]`, `glossary_context: rhetoric`,
  `audience: [{profile: <persona-slug>, guidance_text}]`,
  `external_references: [{type: biblio, id: freese-rhetoric-1926}]`, optional `related`.
- **Body**: prose + `[^^N_M]` footnotes + `{blurb, icon: pencil}` editor's-note callouts +
  `{#id}` anchors + degraded root-absolute `[text](/rhetoric/.../#anchor)` xrefs +
  in-body CC-BY-SA notice/link. Prefixed with `<!-- markdownlint-disable -->`.
- **Invariant**: exactly one body `#` H1; no literal Markua markers post-render (SC-002).

## Section / Book
- **Registry entry** (`example/docs/_meta/sections.yaml`): `{id: rhetoric, label: Rhetoric,
  order: <45>, type: Reference}` — single top-level entry.
- **Books**: subfolders `book-one/` (populated), `book-two/`, `book-three/` (landing-only).
  Nest automatically as Starlight sidebar sub-groups.
- **Landing/Hub**: `index.md` with `kind: Hub` per section/book.

## Footnote (pipeline entity)
- **Source form**: reference `[^^N_M]`, definition `[^^N_M]:` <text> (block, often after `{pagebreak}`).
- **Normalised form**: GFM footnote consumed by remark-gfm → rendered reference link + back-linked
  notes list (`<section>`/`<ol>` footnotes region).
- **Rules**: inert when `markua` preset OFF (NFR-001); no-op on `kind: Presentation`; unmatched
  marker/definition degrades to harmless text, never fails build.

## Reader persona
- **Location**: `example/docs/context/audience/<slug>.md`, `type: Context`, `kind: Persona`,
  `doc_status: active`, fields `role`, `goals[]`, `responsibilities[]`, optional `hero_image {src, alt}`.
- **Referenced by**: `audience: [{profile: <slug>, guidance_text}]` on rhetoric pages.

## Glossary term
- **Location**: `example/.contextive/definitions.yaml` → context `rhetoric` → `terms[] {name,
  definition, aliases?, examples?, meta?}`. ~10 terms.
- **Generated page** (build output, not authored): `example/docs/glossary/rhetoric/index.md`
  (`kind: Glossary`, `glossary_context: rhetoric`).

## Attribution
- **About/license page**: `example/docs/rhetoric/about-and-license.md` — CC-BY-SA-4.0 terms +
  dual credit (Freese/Perseus public-domain source; Dejongh revamp).
- **Bibliography record** (`example/docs/_meta/bibliography.yaml`): `{id: freese-rhetoric-1926,
  type, title, authors, container, url, issued, ...}` (+ Perseus source record).
