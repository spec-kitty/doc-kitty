---
title: "ADR-0036: Diagram-figure ownership — one node type per pipeline stage"
description: remark emits one dkMermaid node, rehype wraps the figure, and a standalone sheet owns caption presentation — closing the double-pre and branded-CSS-drop defects (#59/#60/#68).
doc_status: active
updated: 2026-09-04
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0022-reveal-integration-and-token-theme
  - adr/0023-diagram-render-and-metadata-seam
  - adr/0024-diagram-token-promotion-and-brand-wiring
  - adr/0013-m1-chrome-substrate-single-layer
  - context/convention
---

# ADR-0036: Diagram-figure ownership — one node type per pipeline stage

## Status

**Accepted** — 2026-09-04. Introduced by the diagram-component-css mission
(issues #59, #60, #68), which fixed a defect ADR-0023 left implicit: it named
a render owner and a metadata→figure seam, but not which pipeline stage
*owns the figure's markup and presentation*. This ADR states that contract
explicitly and closes the gap.

## Context

Before this mission, every rendered Mermaid diagram was wrapped in a stray
outer `<pre>` (`<pre><figure class="dk-diagram"><pre class="mermaid">…`), so
diagrams displayed inside a scrollable, monospace code-card instead of as a
plain figure, with a non-wrapping caption and a spurious keyboard tab stop
(#59). Branded docs pages additionally shipped that figure's caption
completely unstyled, because the `.dk-diagram*` rules — like the pre-existing
`.dk-callout*` rules — lived in `theme.css`, which a brand theme *replaces*
wholesale rather than layers onto (#68). The caption stylesheet itself had
also never been written (#60).

Investigating why, three source comments each named a different owner for
the same figure:

- `config.ts`'s fence transform claimed it emitted a real `<pre
  class="mermaid">` element.
- `diagram-figure.ts` (rehype) claimed it owned wrapping that `<pre>` in the
  `<figure>`.
- `dk-reveal-theme.css:157` claimed presentation was owned by
  `figure.dk-diagram`.

All three were locally true and jointly wrong: the fence transform stamped
`hName: 'pre'` onto a node that was *still typed* `code`. `mdast-util-to-hast`
routes any `code`-typed node through its own code handler, which applies the
projected `data.*` to the element it builds and then **unconditionally**
wraps that element in its own outer `<pre>` — so a still-`code`-typed node
carrying an `hName` projection double-wraps by construction
(`mdast-util-to-hast@13.2.1`, `handlers/code.js:43,46`, verified against the
installed source). No source-level owner was actually wrong about their own
layer; the defect lived in the seam between "what type is this mdast node"
and "what hast the type handler is allowed to emit" — a seam none of the
three comments named.

Separately, `.dk-diagram*` was about to repeat `.dk-callout*`'s exact
delivery mistake: `config.ts` replaces `customCss` slot 0 (the static
`theme.css` token catalog) with a generated, tokens-only sheet when a brand
theme is active, so any component *rule* living in `theme.css` — not just its
tokens — is silently dropped on a branded build. `theme.css` was structurally
the wrong home for component presentation, independent of the double-`<pre>`
bug.

## Decision

Fix the ownership seam explicitly, one node type per pipeline stage, and
never let it re-drift:

1. **remark emits a single, well-formed `<pre class="mermaid">` via a custom
   node type — never by projecting `hName` onto a `code` node.**
   `mermaidFenceTransform` (`src/lib/config.ts`) retypes each
   `code`/`lang === 'mermaid'` mdast node **off** `code` (to `dkMermaid`)
   *before* projecting `hName: 'pre'` / `hProperties` / `hChildren` onto it.
   `mdast-util-to-hast`'s unknown-node handler then honours that projection
   verbatim, emitting one clean `<pre class="mermaid">` element with no
   wrapper. This is the codebase's own established pattern (`markuaSpan`,
   `deckSection` already use custom types) — a retype, not a new idiom.
   Retyping off `code` also strengthens the deliberate Shiki/expressive-code
   sidestep: a non-`code`-typed node can never be claimed as a code block by
   Starlight's code highlighter.

2. **rehype (`diagram-figure.ts`) owns wrapping that `<pre>` in
   `<figure class="dk-diagram">`.** It matches the `<pre class="mermaid">`
   shape the fence transform now reliably emits, and builds the
   `<figcaption>` from the caption fields the remark metadata pass stashed
   on `file.data`. This half of the seam was already correct; it is
   unchanged by this fix.

3. **A delivered, standalone component stylesheet owns figure/caption
   presentation — not `theme.css`.** `.dk-diagram*` (and the relocated
   `.dk-callout*`, moving the same defect class it shared) live in
   `src/styles/dk-components.css`, wired as its **own** `customCss` entry
   (`DK_COMPONENTS_CSS_SHEET`, `customCss[1]` in `theme.ts` — never slot 0,
   which a brand theme replaces) and linked explicitly by `DeckLayout.astro`,
   because the out-of-frame deck route receives no global `customCss`
   injection at all (ADR-0022 decisions 4/5). Both the in-frame docs shell
   and the out-of-frame deck shell now ship the same component rules,
   branded or not.

## Consequences

### Positive

- The double-`<pre>` defect class is closed **by construction**: a
  `dkMermaid`-typed node cannot be re-claimed by `mdast-util-to-hast`'s
  `code` handler, so a future edit cannot silently reintroduce the wrapper by
  forgetting the retype — reviewers only need to check that the node stays
  off `type: 'code'`.
- Branded docs pages and out-of-frame decks both receive `.dk-callout*` and
  `.dk-diagram*` styling; the branded-CSS-drop defect class (#68) is closed
  for both existing and future global components, not patched once for
  diagrams alone.
- The three-way ownership ambiguity that let #59 ship unnoticed is now
  resolved in prose: one stage, one owner, stated here rather than
  reconstructed from three disagreeing comments.

### Negative

- Two seams to keep aligned instead of one: a future component family still
  needs its own deliberate placement decision (never `theme.css` slot 0)
  rather than an obvious default: it must be added into
  `dk-components.css` or an equivalent non-slot-0 sheet.
- The rehype `diagram-figure.ts` pass depends on the fence transform's
  output shape (`<pre class="mermaid">`, matched by tag + class); a future
  change to either half must keep that hast contract, not just the mdast
  node type.

### Risks

- A future remark/rehype consumer added between the fence transform and
  `diagramFigure` could, in principle, choke on the custom `dkMermaid` mdast
  type if it assumes only known node types. No such consumer exists in this
  pipeline today (`diagramMeta` runs *before* the retype and keys on the
  original `code`/`mermaid` shape, so it is unaffected). If one is ever
  needed, the documented fallback is unwrapping the stray `<pre>` downstream
  in `diagram-figure.ts` instead — deliberately not chosen as the primary fix
  because it treats the hast symptom rather than the mdast cause.

## Alternatives considered

### Convert the fence to `<pre class="mermaid">` in a rehype pass instead of remark

Rejected: this re-opens the Shiki/expressive-code timing problem the
existing remark-based approach was already built to avoid (a `code`-typed
node reaching a later rehype stage is exactly what expressive-code claims
and highlights).

### Leave the mdast node typed `code`, unwrap the stray `<pre>` in `diagram-figure.ts`

Rejected as the primary fix, kept as a documented fallback only. This
patches the downstream *symptom* (malformed hast) rather than the upstream
*cause* (an `hName` projection onto a node type whose handler always wraps),
and leaves malformed hast for any other consumer that reads the tree before
`diagramFigure` runs.

### Fold `.dk-diagram*`/`.dk-callout*` into `theme.css`

Rejected: `theme.css` occupies `customCss` slot 0, which a brand theme
replaces outright with a generated, tokens-only sheet — component rules
placed there are dropped on every branded build, reproducing #68 instead of
closing it.

## References

- [ADR-0022](./0022-reveal-integration-and-token-theme.md) — the deck's
  out-of-frame client-script and no-global-injection pattern that
  `DeckLayout`'s explicit `dk-components.css` link follows.
- [ADR-0023](./0023-diagram-render-and-metadata-seam.md) — the render-owner
  and remark-metadata/rehype-figure seam this ADR narrows to the figure's
  *markup and presentation* ownership specifically.
- [ADR-0013](./0013-m1-chrome-substrate-single-layer.md) — the `customCss`
  layering contract this decision relies on (slot 0 vs. later entries).
- Issues #59 (double-`<pre>`), #60 (unstyled caption), #68 (branded CSS
  drop).
- `mdast-util-to-hast@13.2.1`, `handlers/code.js:43,46` (the unconditional
  outer-`<pre>` wrap for any `code`-typed node).
