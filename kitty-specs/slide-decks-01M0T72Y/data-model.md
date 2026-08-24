# Data Model: Slide Decks (reveal.js) — M6

M6 adds **no persisted store** and **no new frontmatter field**. The "data" is the deck
Markdown (an existing `docs`-collection record) and the in-memory mdast → slide-`<section>`
tree the transform builds at build time. Entities below are structural, not schema.

## Deck (Presentation page)

- **What**: a `docs`-collection Markdown page with `kind: Presentation`, located under
  `presentations/`. Its frontmatter is the **existing** metadata contract — no new fields.
- **Key fields consumed**: `title`, `description`, `hero_image` (title slide + social card);
  `doc_status` (generator gating); `related`/`external_references` (resolved as for any doc).
- **Invariants**:
  - `kind: Presentation` **and** path under `presentations/` ⟺ rendered out-of-frame.
    A `kind: Presentation` page elsewhere is a **hard build/validator error** (FR-022).
  - `Presentation` is already a legal `type` and `kind` (no schema change).
- **Represents (two forms)**: the source page **and** its rendered deck ("deck" = both).

## Slide tree (built at build time, in memory)

The transform maps `root.children` (mdast) into an ordered list of slide nodes
(`data.hName='section'`). Node kinds:

- **Title slide** — synthesized from `title`/`description`/`hero_image` for the content
  before the first `##`. Always first; always has a heading.
- **Horizontal slide** — one per `##`; or a **headingless slide** forced by a body `---`
  (the `thematicBreak` is consumed, not rendered as `<hr>`; the section is emitted with an
  `aria-label`, e.g. `Slide N`).
- **Vertical stack** — the **outer** `<section>` produced when a `##` slide has `###`
  children; contains **only** inner sections.
- **Vertical slide** — an **inner** `<section>` from a `###` (or the converted first-inner
  holding the `##` slide's own content).
- **Ordering invariant**: slides are emitted in **document order** (the linear fallback
  depends on it). `####`+ headings stay inside the current slide (two nav axes only).

```
root.children ──▶ [ TitleSlide, Horizontal | Stack[Inner, Inner…], Headingless, … ]
                    (document order preserved)
```

## Slide directive (invisible authoring construct)

- **`<!-- .slide: k="v" … -->`** — an mdast `html` comment node; parsed attributes merge
  onto the **enclosing** section's `hProperties`. Multiple in one slide → merge, last-wins
  per key.
- **`<!-- .element: … -->`** — parsed attributes/classes (incl. `fragment`) merge onto the
  **immediately-preceding sibling** node's `hProperties`. No preceding sibling → warn + skip.
- **Unknown key** — `file.message()` warning; **never** fails the build.
- **Attribute grammar**: `key="value"` pairs (`/([\w-]+)\s*=\s*"([^"]*)"/g`) plus bare tokens.

## Speaker note

- **`Note:` block** — a paragraph whose first text starts with `Note:`; transformed into an
  `<aside class="notes">` that is a **direct child** of its slide's `<section>`.
- **Role**: surfaced by the reveal Notes plugin in speaker view; a plain aside in the
  fallback. The **only** reveal chrome present in the static `dist` → carries
  `data-pagefind-ignore`. v1: single block after `Note:` (multi-block deferred, C-008).

## Deck route + URL contract

- **Route**: `example/src/pages/presentations/[...slug].astro`, `prerender = true`,
  `getStaticPaths()` over `getCollection('docs')` filtered to `kind: Presentation`.
- **URL invariants (ADR-0021)**:
  - Exactly **one** HTML at `/presentations/<deck>/`, containing `.reveal > .slides`,
    **not** the Starlight article shell (route-uniqueness).
  - The emitted path is **byte-identical** to the URL llms.txt and the agent API derive
    from the collection slug (generator↔route parity; same trailing-slash/base normalization
    as the sitemap filter).

## Reveal theme mapping

- **Sheet**: `--r-*: var(--dk-*)` under `.reveal` (colors, fonts, `--dk-width-deck`),
  imported **only** by `DeckLayout`. reveal core sheet + this sheet never global / never a
  shared chunk on doc pages (build-asserted; core sheet by signature).
- **Tokens**: brands set `--dk-*` only; `--dk-width-deck` (existing) drives deck width; the
  deck bg/text `--dk-*` pair must be WCAG 2.2 AA (verified in foundation).

## Discovery surfaces (per page)

| Surface | Deck included? | Mechanism |
|---|---|---|
| sitemap | yes (published) | scans built pages; `doc_status` draft-filtered |
| llms.txt | yes (published) | `SECTION_ORDER`/`SECTION_LABEL` gains `presentations` |
| agent API | yes (published) | reads `docs` collection |
| Pagefind | yes (published) | `data-pagefind-body` on `.slides`; note aside ignored |
| RSS | **no** | excluded on `kind: Presentation` |
| draft deck | **no** (all) | `doc_status: draft` gating |
