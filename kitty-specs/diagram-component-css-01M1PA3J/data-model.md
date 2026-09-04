# Data Model — DOM & CSS-delivery contracts

This mission has no runtime data model; its "entities" are the DOM structure and the stylesheet-delivery cascade the gates assert against.

## E1 — Diagram figure (rendered DOM)

**Corrected shape** (every diagram page, docs + deck):
```html
<figure class="dk-diagram" role="group">
  <pre class="mermaid">…source (with accTitle/accDescr)…</pre>
  <figcaption class="dk-diagram__caption">
    <span class="dk-diagram__desc">…</span>
    <span class="dk-diagram__attr">…optional…</span>
  </figcaption>
</figure>
```
**Invariants**:
- `figure.dk-diagram` is a block-level child of its content section — **no `<pre>` ancestor** (INV: fixes #59).
- `role="group"` retained; accessible name/description come from the diagram's `accTitle`/`accDescr` (unchanged).
- Exactly one `<svg>` per `pre.mermaid` after client render (INV-SINGLE-OWNER).
- Real (non-diagram) code blocks remain `<pre><code>` and keep code-card styling + focusable scroll region.

## E2 — Component stylesheet (delivery)

- A single standalone sheet carries `.dk-callout*` and `.dk-diagram*`/`.dk-diagram__caption`/`__desc`/`__attr`.
- Caption rules: `font-size: var(--dk-text-sm)`, `color: var(--dk-color-text-muted)`, `white-space: normal`, non-monospace `font-family`, centered, spaced; figure centered with vertical margin and `overflow-x:auto`.
- **Delivery invariant**: on a branded page, the linked/inlined CSS on any docs page or deck that renders a callout/diagram contains the corresponding rules.

## E3 — customCss cascade (config)

| Path | slot 0 | component sheet | reaches branded docs? | reaches decks? |
|------|--------|-----------------|-----------------------|----------------|
| No theme (default) | static `theme.css` | own entry (`customCss[1..]`) | yes (bundled) | via `DeckLayout` link |
| Theme active | generated token sheet (replaces slot 0) | own entry (survives) | **yes (this is the fix)** | via `DeckLayout` link |

**Invariant (NFR-004)**: the default-path `customCss` shape change is reflected in the invariant test deliberately; token/bridge contract otherwise unchanged.
