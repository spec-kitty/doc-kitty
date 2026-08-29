---
title: "ADR-0030: Render Markua by preprocessing to remark-directive"
description: Support a curated Markua subset by compiling its non-CommonMark blocks into remark-directive containers plus a small attribute-list plugin, rather than a micromark syntax extension.
doc_status: draft
updated: 2026-08-29
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/research/markua-syntax-support
  - architecture/research/astro-markdown-extensions
  - adr/0008-swappable-theme-layer
  - adr/0009-finalize-metadata-contract
---

# ADR-0030: Render Markua by preprocessing to `remark-directive`

> **Draft placement.** This ADR is authored here in the mission's `contracts/` so
> it passes through review as content; a work package lands it at
> `docs/adr/0030-markua-preprocess-to-directive.md`. The number `0030` is the next
> after `0029` and may shift if another ADR lands first.

## Status

Proposed. *(The work package that lands this ADR at
`docs/adr/0030-markua-preprocess-to-directive.md` flips the status to **Accepted** on
merge — spec C-001/FR-013/SC-006 say the mission ratifies the approach; recorded in
the plan concern map, IC-00/IC-07.)*

## Context

[Markua](https://leanpub.com/markua) is Leanpub's Markdown dialect, a superset of
CommonMark and GFM. A page in plain Markdown never touches Markua, but a
Leanpub-authored page hits a handful of constructs — asides, callouts, figure
images, crosslink ids, and callout icons — that plain Markdown ignores or renders as
literal text. doc-kitty wants an **opt-in** subset of Markua to render as its authors
intended, without changing base rendering and without coupling pages to MDX
(design-readiness item 7; [`markua-syntax-support.md`](../architecture/research/markua-syntax-support.md)).

Two Markua constructs are not CommonMark, so remark will not parse them natively:

- **Line-prefix blocks** — `A>` asides and the `B> C> D> E> I> Q> T> W> X>` callout
  shorthands. CommonMark blockquotes require `>` at line start, so remark reads
  `W> text` as a paragraph whose literal text is "W> text".
- **Attribute lists** — `{width: "75%"}`, `{#id}`, `{class: warning}` on their own
  line, or `[span]{#id}` after a span. remark treats a `{…}` line as ordinary text.

Everything downstream (asides, callouts, images, ids, icons) can reuse mechanisms
the repo already runs: `remark-directive`, `astro:assets`, Starlight asides, Astro's
built-in heading-id rehype, and the theme's token/CSS surface (ADR-0008 `--dk-*`
tokens in `theme.css`, per-kind rendering ADR-0009). The decision is **how to get those
two constructs into the AST**, and it needs recording before implementation because it fixes a rendering
seam and pins the normaliser's block-detection rules.

## Decision

Support the subset by **preprocessing Markua into `remark-directive` syntax**
(option b of the research), not by writing a micromark syntax extension:

1. A **normaliser** compiles the line-prefix runs (`A>` and the shorthands) and the
   `{aside}…{/aside}` / `{blurb, class: …}…{/blurb}` wrappers into `remark-directive`
   container directives (`:::aside`, `:::tip`, `:::caution`, …). Its **block-detection
   rules are pinned** in
   [`normaliser-block-detection.md`](../../kitty-specs/markua-syntax-support-01M167JG/contracts/normaliser-block-detection.md)
   — how a run is recognised and where it ends, how `{aside}`/`{blurb}` open/close is
   matched (balanced, nestable), how detection avoids consuming an adjacent
   CommonMark blockquote or a fenced code block containing `>`, how the three
   redundant callout forms normalise to one directive per class, and how an
   unbalanced wrapper degrades to text.
2. A small **remark attribute-list plugin** attaches `{…}` values to the following
   block (images, ids) and to spans (`[span]{#id}`, `word{#id}`), writing onto
   `hProperties`.
3. Downstream: a rehype pass rewrites images into an accessible `<figure>` driven by
   `astro:assets`; ids land on `hProperties` with **explicit winning** over the
   auto-generated heading id (C-005); the four Starlight-mapped classes render as
   Starlight asides (`tip`→`tip`, `warning`→`caution`, `error`→`danger`,
   `information`→`note`) and the classes with no Starlight equivalent
   (aside, discussion, question, exercise, generic, center) render as **hand-emitted
   hast** — an `<aside class="dk-callout dk-callout--{variant}">` element styled by a
   `--dk-callout-*` token family in `theme.css`, **not** a `.astro` component (see
   decision 4); callout icons resolve through a curated Font Awesome → Starlight seed
   map with graceful drop and a build warning for unmapped names.
4. **Theme callouts are emitted hast, not an `.astro` component.** The Starlight
   `components` map is **frozen at exactly four carriers** (`config.ts` Seam 3,
   ADR-0013/ADR-0015 decision 3 — the map is applied after `...overrides` so a consumer
   cannot add a fifth, and WP08 asserts it), and doc-kitty has **no directive→component
   seam** (no remark/rehype plugin mounts a `.astro` component; they emit hast). So a
   markua plugin on a plain `.md` page **cannot** cause a `Callout.astro` to render — it
   would be dead code and a split-brain second DOM copy. The six theme classes are
   therefore emitted as raw hast, exactly the way `rehype/diagram-figure.ts` builds its
   `<figure>` styled by `--dk-diagram-*`. One plugin owns the callout DOM.

Support is **opt-in and additive**, gated behind an opt-in preset flag the same shape
as `diagrams`: with the preset **off**, Markua lines degrade to literal readable text
(portable on a plain-Markdown host); with it **on**, they render, and a page using
none of these constructs renders byte-identically either way. The spec (FR-011,
FR-012, Overview) and this ADR agree on this preset-opt-in activation model.

The **wiring seam is the mdast-level remark plugin route** (ratified, not a choice):
the normaliser runs as a remark plugin that emits `containerDirective` nodes, and
Starlight's own `remarkAsides` renders the four mapped names natively. A pre-parse
body-string route is **not reachable** through Astro/Starlight public config — there
is no raw-body hook, and the custom glob loader has no doc-kitty-controlled body seam
that would not forfeit native image optimisation. Two **bounded foundation spikes**
de-risk the ratified route before the render concerns build on it: (1) the mdast route
itself — plugin ordering (doc-kitty prepended before `starlight()`), fence/blockquote
handling, native-aside consumption, and explicit-id survival; and (2) the
ToC-heading-exclusion demotion pass (there is no native aside-heading exclusion).

## Consequences

### Positive

- Small blast radius: reuses `remark-directive`, `astro:assets`, Starlight asides,
  and the ADR-0008 theme surface the repo already runs — **no new dependency**.
- Base rendering stays byte-identical (FR-011, NFR-001); pages stay plain `.md` with
  no MDX coupling (C-002); Markua degrades to readable text rather than broken markup
  (FR-012).
- The mdast-level view makes fence and blockquote avoidance largely fall out for free
  (code and blockquotes are already distinct node types).
- **One DOM owner for callouts.** Emitting the theme callouts as hast (not a component)
  closes a split-brain risk: the emitting plugin is the single owner of the callout
  DOM, so there is no second copy in a `.astro` file to drift out of sync. It reuses
  the repo's established `diagram-figure.ts` pattern (raw hast + `--dk-*` tokens).

### Negative

- Not a full Markua parser: the redundant callout forms and the wrapper nesting must
  be handled by the normaliser's own rules rather than by a grammar, so the
  block-detection contract carries the correctness burden.
- Rendering the four mapped classes as Starlight asides couples to Starlight's aside
  handling; the peer range is capped `>=0.32.0 <0.33.0`, so a Starlight change fails
  loudly at install (the same fencing ADR-0029 uses).
- **Native-a11y-reuse vs attribute-support tradeoff (deliberate).** Reusing Starlight's
  `remarkAsides` for the four mapped classes means inheriting its tested aside a11y and
  styling — but `remarkAsides` **rebuilds** a mapped directive as a fresh aside and
  **discards its attributes/`hProperties`** (its restoration pass restores only
  unhandled text/leaf directives, never a `containerDirective`). We accept that a
  mapped-class callout carrying `{#id}` or `{icon: …}` cannot ride the native aside, so
  such a callout is **routed to the theme-callout hast** instead (a
  `dk-callout--{mapped-name}` fallback variant styled to echo the native aside — see the
  callout-mapping and icon-map contracts). Attribute-free mapped callouts — the common
  case — keep the native aside. This is a chosen tradeoff, not an accident.

### Risks

- **mdast plugin ordering** — native asides work only because doc-kitty's markua
  plugins run **before** Starlight's `remarkAsides`, guaranteed solely by prepending
  the integration before `starlight()` (as `diagrams`/`glossary` already do). Locked by
  an IC-06 assertion that a `T>` renders `starlight-aside--tip`, so a future array
  reorder fails loudly.
- **`remark-directive` ownership** — `remark-directive` is currently registered only by
  the glossary integration and only when glossary is active; the example ships
  `.contextive` definitions, so markua and glossary will both be active. A single owner
  registers `remark-directive` once, gated on (glossary-active **or** markua-active),
  with the cross-integration plugin order pinned (IC-01 task surface).
- **ToC heading exclusion** — there is no native aside-heading exclusion; the ratified
  demotion pass is a second bounded spike (IC-01/IC-02).
- **Explicit-id precedence** — **native and proven**: Astro's `rehypeHeadingIds` (runs
  last) assigns a slug only when `node.properties.id` is not already a string, so an
  explicit `{#id}` wins with no `rehype-slug` and no ordering shim. IC-04 asserts it.
- **Local image resolution** — the Markua `resources/`-relative convention reconciles
  with `astro:assets` via the native glob loader's page-relative resolution (lower risk
  than first carried); the figure concern proves a local and a web image both render,
  the local one optimised, with `{width:}` surviving the `__ASTRO_IMAGE_` round-trip.

## Alternatives considered

### Option A: a custom micromark syntax extension

A micromark extension for the line-prefix blocks plus a remark plugin for attribute
lists. The most faithful and robust against edge cases, and the most work; micromark
extensions are non-trivial to write and maintain. Not chosen for v1; reserved if the
preprocessing proves too fragile against code blocks and nesting.

### Option C: existing Markua-to-mdast tooling

None is mature. The closest (`@humanwhocodes/markdown-it-markua-aside`) handles only
asides/blurbs and targets markdown-it, not remark; the Markua tools that exist all
*write* Markua, none *read* it into an AST. The direction we need is unserved.

## References

- [Supporting Markua syntax](../architecture/research/markua-syntax-support.md)
- [Astro Markdown extensions](../architecture/research/astro-markdown-extensions.md)
- Mission block-detection contract (`normaliser-block-detection.md`), callout mapping,
  figure render, attribute-list, and icon-map contracts.
- [ADR-0008](./0008-swappable-theme-layer.md), [ADR-0009](./0009-finalize-metadata-contract.md)
