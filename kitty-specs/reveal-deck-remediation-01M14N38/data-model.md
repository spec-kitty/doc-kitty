# Phase 1 Data Model: Deck render surface

This mission is a brownfield remediation, not a new domain. The "data model" here
is the **client-side render-surface state** of a running deck — the entities and
state transitions the #12/#15 fixes reason about — plus the two authoring entities
(Deck, Slide) they derive from. No persistent datastore is involved (static SSG).

Canonical terms follow the spec's Domain Language: **Deck**, **Slide**
(horizontal / vertical-nested), **Render owner** (the single Mermaid module),
**Presentations hub**.

---

## Entities

### Deck (presentation)

- **Definition**: a Markdown collection entry under `presentations/` with
  `kind: Presentation`, front-matter (`title`, `description`, `doc_status`,
  optional `hero_image`), rendered out-of-frame by `DeckLayout`.
- **Fields relevant here**:
  - `title` — becomes the title-slide `<h1>` and the document `<title>`, and the
    deck-footer label.
  - `description` — page metadata ONLY. Emitted as `<meta name="description">`.
    **Invariant (FR-002/SC-002)**: never appears as visible slide body content.
  - `hero_image { src, alt }` — optional title-slide image.
- **Derived structure**: the deck body is split by the `deckSplit` transform into
  one `<section>` per slide (the title slide is synthesized first).
- **Published vs draft** (`doc_status`): a published deck exposes `.slides` to
  Pagefind (`data-pagefind-body`) and gets the remediated chrome; a draft/preview
  deck keeps `data-pagefind-ignore` and its existing draft treatment
  (unchanged — edge case "draft vs published deck").

### Slide

- **Definition**: a `<section>` inside `.reveal > .slides`.
- **Kinds**:
  - **Title slide** — synthesized from front-matter; always slide 1. Post-fix its
    body is `title` `<h1>` (+ optional hero image + any authored pre-`##` content);
    the `description` paragraph is removed.
  - **Horizontal slide** — a top-level `.slides > section` (from `##` or `---`).
  - **Vertical / nested slide** — an inner `<section>` inside a stack wrapper
    (from `###`). The stack wrapper is a nameless container; the leaf inner
    sections are the navigable slides.
- **Active-state fields (runtime, set by reveal)**:
  - `display` — `none` when inactive, `block` when active. **Root cause of #15**:
    a diagram rendered while `display:none` gets a zero-size box.
  - `.present` class — reveal marks the current leaf slide (and, for a stack, its
    parent) `.present`; the interaction spec keys on `section.present`.
- **Accessible name (invariant, NFR-001/AX-2)**: every leaf slide has a heading
  descendant OR an `aria-label`/`aria-labelledby`. Unchanged by this mission.

### Deck diagram

- **Definition**: a `pre.mermaid` node inside a slide, rendered client-side by the
  single **render owner** (`diagram-render.client.ts`).
- **Fields / runtime state**:
  - `source` — the original Mermaid definition text, cached in a closure Map by the
    render owner (kept out of the DOM) so a node can be restored and re-rendered.
  - `data-processed` — Mermaid's marker that a node has been rendered to `<svg>`.
  - `renderedBox` — the bounding box of the emitted `<svg>`. **Invariant
    (NFR-001/SC-003)**: once the diagram's slide is active, width > 0 AND
    height > 0.
- **Cardinality invariant (FR-005/NFR-007)**: **exactly one `<svg>` per diagram
  node** at all times after its first render — across navigation, rapid paging,
  and theme toggles.

### Deck chrome — footer

- **Definition**: `<footer class="dk-deck-footer">`, a sibling of `main.reveal`
  (NEW — currently absent). Fixed to the frame bottom; a single `contentinfo`
  landmark.
- **Invariant (FR-003/SC-001)**: present and positioned at the bottom of the frame,
  visible on every slide (it is outside `.slides`, so it does not re-render per
  slide and does not enter reveal's slide DOM). Does not collide with the
  bottom-right `.dk-deck-controls`.
- **Related existing chrome (unchanged)**: `nav.dk-deck-controls` (labelled
  prev/next `<button>`s), wired to the reveal instance in `reveal-init`.

### Presentations hub + instructional banner

- **Definition**: the `kind: Hub` section index for decks (`Hub.astro` +
  `example/docs/presentations/README.md`), listing published decks with their
  `?print-pdf` export links.
- **New field**: an instructional banner — a purpose sentence + a "How to use"
  section (vertical navigation, reveal hotkeys, PDF export incl. background
  graphics).
- **Invariant (NFR-004)**: the banner must not add an axe violation and must not
  drop the hub's Pagefind-indexed child link text.

---

## Render-state transitions (#15 core)

The render owner is a state machine over the deck's diagram nodes. Two orthogonal
state axes: **slide activity** (reveal-owned) and **node render state**
(render-owner-owned).

### Slide activity (reveal-owned)

```
inactive (display:none, zero-box)
   │  reveal navigation → slide becomes current
   ▼
active (display:block, non-zero-box, .present)
   │  reveal navigation away
   ▼
inactive (stays in DOM; its rendered <svg>, if any, is retained)
```

`slidechanged` fires on each transition INTO active (horizontal or vertical index
change). The initially-active slide is active at ready WITHOUT a `slidechanged`.

### Node render state (render-owner-owned)

```
unrendered
   │  source cached at deck init (closure Map)
   ▼
cached-source
   │  its slide is active  →  render(scope = active-slide unrendered nodes)
   │  (single mermaid.run call site)
   ▼
processed  (exactly one <svg>, data-processed set, added to rendered set)
   │  [data-theme] toggle  →  restore source + clear data-processed → re-run
   ▲___________________________________________________________________│
        (still exactly one <svg>, new palette)
```

**Transition triggers (all funnel through the ONE `render(scope)` closure / ONE
`mermaid.run`)**:

| Trigger | Scope of `render()` | Guards |
|---|---|---|
| Deck ready, normal view | the initially-active slide's `pre.mermaid` | whole-document footprint guard already passed |
| Deck ready, `print-pdf` view | ALL `pre.mermaid` (every slide visible) | footprint guard; single pass |
| `slidechanged` | the newly-active `currentSlide`'s UNrendered `pre.mermaid` | skip nodes already `processed` (FR-005) |
| `[data-theme]` toggle | the RENDERED set (all visited nodes) | restore source + clear `data-processed`; keep one `<svg>` |

**Coalescing guard (DR-4, preserved)**: `isRendering` / `rerenderPending` — if a
trigger arrives while a run is in flight, it is coalesced into a single follow-up
run once the current run settles. Prevents overlapping runs producing a double
`<svg>` under rapid navigation.

**Footprint guard (NFR-002, whole-document)**: before any Mermaid import,
`document.querySelectorAll('pre.mermaid')`; if zero, return with no
`import('mermaid')`. A diagram-free deck resolves 0 Mermaid chunks. A deck with a
diagram anywhere imports Mermaid and wires the per-slide renderer even if slide 1
is diagram-free.

---

## Invariants (assertion targets for FR-008)

1. **INV-DESC (FR-002)**: the front-matter `description` value is present in
   `<head>` `<meta name="description">` and ABSENT from any slide `<section>` body.
2. **INV-FOOTER (FR-003)**: `.dk-deck-footer` exists, has a non-zero bounding box,
   and is positioned at the frame bottom on every active slide.
3. **INV-DIAGRAM-BOX (FR-004/NFR-001)**: once a diagram's slide is active, its
   `<svg>` has width > 0 and height > 0.
4. **INV-ONE-SVG (FR-005/NFR-007)**: exactly one `<svg>` per diagram node at all
   times after first render — across away-and-back navigation and theme toggles.
5. **INV-SINGLE-OWNER (NFR-002)**: exactly one `mermaid.run` code path; a
   diagram-free deck route resolves 0 Mermaid runtime chunks.
6. **INV-NO-LEAK (NFR-003)**: reveal/deck stylesheets are linked only from the
   deck document; 0 reveal core-CSS rules on non-deck pages.
7. **INV-A11Y (NFR-004)**: the deck route and presentations hub keep 0 new axe
   violations after the footer, banner, and per-slide render changes.
