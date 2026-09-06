---
title: "ADR-0027: Auto-link resolution, per-page scoping, and the :term directive"
description: A pure resolver owns collision, alias, and anchor resolution; a remark plugin auto-links the first per section; remark-directive parses :term; order is pinned after gfm.
doc_status: active
updated: 2026-08-26
type: ADR
kind: ADR
authors:
  - stijn@spec-kitty.ai
related:
  - plans/features/glossary-and-contextive
  - adr/0026-glossary-source-and-generation-seam
  - adr/0025-glossary-on-this-page-block-and-remark-render-channel
  - adr/0012-slide-decks-static-reveal-from-markdown
  - adr/0023-diagram-render-and-metadata-seam
---

# ADR-0027: Auto-link resolution, per-page scoping, and the `:term` directive

## Status

Accepted. Establishes the M4 (Glossary) resolution + auto-link + escape-hatch seam.
Settles post-spec squad findings **AS-1** (remark ordering + guards) and **AS-2**
(`remark-directive` is a new pinned dependency). Consumes the shared term-index from
[ADR-0026](./0026-glossary-source-and-generation-seam.md); feeds the used-terms list to
[ADR-0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md).

> **Addendum (2026-09-06, #64 term-link UX).** The emitted link node described
> below no longer carries `target="_blank"` / `rel="noopener"`: glossary targets
> are internal, so the shared node emits a plain **same-tab** link that now also
> carries a `dk-glossary-link` class (for the distinct-but-quiet dotted-underline
> affordance). The single-shared-node invariant this ADR establishes is unchanged
> — the class + dropped `target`/`rel` were applied at that one shared shape, so
> auto-links and `:term` stay byte-identical. Read every `target="_blank"`,
> `rel="noopener"` mention in the Decision below as superseded by this note.

## Context

The auto-linker turns a term/alias occurrence in prose into a `/glossary/<context>/#<term>`
link, at the **first eligible occurrence per H2 section** (FR-005), never inside code,
headings, existing links, or frontmatter (FR-006), matching **whole-word, case-insensitive**
(FR-006). It must resolve the *right* context per page and **refuse to guess** on an
unresolved collision (FR-007, NFR-007). Four seams are load-bearing:

1. **Resolution is not linking.** Deciding *which context* a surface form resolves to
   (single candidate → link; multiple → page context if a candidate, else unresolved
   collision → skip + warn; aliases as names) is pure logic over the shared index. It is a
   four-way shared contract (generator, linker, `:term`, block; D6) and, bundled into the
   AST plugin, makes that plugin too big to test (D1).

2. **`:term` needs a directive parser we don't have (AS-2).** `:term[text]{context=hr}`
   (with a `link=false` suppress form; FR-011) is remark **directive** syntax. The toolkit
   hand-rolls its remark today; **`remark-directive` + `mdast-util-directive` are new
   pinned dependencies** — a supply-chain decision recorded in `research.md`.

3. **Plugin order and guards (AS-1).** The linker must run **after remark-gfm** (so links,
   code, headings are already parsed nodes to guard against), the **directive parse must
   run before the linker** (so a `:term` node is not itself re-scanned as prose), and every
   rewrite is guarded by **ancestor node type** (never descend into `code`/`inlineCode`/
   `heading`/`link`; frontmatter is already stripped before remark, per the deck-split
   precedent). Astro's `updateConfig` **appends** to `remarkPlugins`, so order is
   controlled by registration order in the single integration WP (config.ts).

4. **Deck behavior must be explicit (AS-1/AS-4).** The out-of-frame deck (ADR-0012/0021)
   is a `kind: Presentation` page split into slide `<section>`s. The linker must have a
   **declared** behavior there, mirroring deck-split's `kind` early-return.

## Decision

1. **A pure resolver owns collision/alias/anchor resolution (`src/lib/glossary/
   resolve.ts`) — its own unit (D1).** Given `(surface, pageContext, sharedIndex)` it
   returns one of: `{ link: { context, anchor } }` (single candidate, or multi resolved by
   the page context), `{ unresolved: { competing: [ctxA, ctxB, …] } }` (multi, page context
   not among them or absent), or `{ none }` (surface not a term/alias, or ignore-listed).
   Aliases are treated exactly as names (FR-012). Anchors are `slug(name)` (deterministic,
   NFR-004). It is Astro-free, exhaustively unit-tested, and imported by the linker,
   `:term`, and — for the used-list — the block (ADR-0025). **This is the one shared
   matcher.**

2. **The auto-linker is a thin remark plugin over the resolver (`src/lib/remark/
   glossary-autolink.ts`).** It walks the mdast, tracks **sections** (an H2 begins a
   section; body before the first H2 is one implicit section; H3+ belong to their parent
   H2 — FR-005), and for the **first eligible** occurrence of each distinct surface per
   section calls the resolver:
   - `link` → rewrite the text node, splitting out a `link` node to
     `/glossary/<context>/#<anchor>` carrying `target="_blank"`, `rel="noopener"`
     (FR-009), and a `data-glossary-term`/`data-glossary-context` marker the hover island
     keys on.
   - `unresolved` → **do not link**; emit **one** `file.message` warning per distinct
     unresolved surface per page, in the stable greppable form NFR-007 pins
     (`[glossary] unresolved collision "<name>" in <ctxA>, <ctxB> — left unlinked`); build
     still exits 0.
   - `none` → leave the text.
   **Eligibility guard (FR-006):** whole-word (word-boundary), case-insensitive; never
   rewrite when any ancestor is `code`/`inlineCode`/`heading`/`link`; a substring inside a
   larger word never matches. The ignore-list and the per-page `glossary_autolink: false`
   opt-out (ADR-0028) are honored before any rewrite. The plugin is **presence-gated**: no
   shared index → early return, corpus byte-identical (NFR-002).

3. **The linker publishes its distinct used-list to `remarkPluginFrontmatter`.** After the
   walk, it writes the deduped `(surface, context, anchor)` list to
   `file.data.astro.frontmatter.glossary_links_used` (presence-gated — set only when ≥1
   link was inserted) — the channel ADR-0025 reads. Because the used-list is exactly the
   resolver's own decisions, "links used" cannot drift from "links inserted."

4. **`:term` is a remark-directive plugin, parsed before the linker (`src/lib/remark/
   glossary-term.ts`).** `remark-directive` (pinned) parses the `:term[text]{context=…}`
   text-directive; the M4 plugin turns it into the same `link` node shape the auto-linker
   produces, resolving via the resolver against the **explicit** `context` (overriding
   collision ambiguity and false positives; FR-011). `link=false` renders `text` as plain
   text (a sanctioned suppress). A `:term` occurrence **also counts as a used link** for the
   block, and **counts as the section's first eligible** so the auto-linker does not double
   it. Unknown/missing `context` on a `:term` → build warning (not fatal), consistent with
   the skip-and-warn posture.

5. **Pinned plugin order (config.ts, the single integration WP):**
   `remark-gfm` (Astro built-in) → `remarkDirective` → `glossary-term` → `glossary-autolink`.
   Registered **after** Starlight/gfm via `updateConfig({ markdown: { remarkPlugins: […] }})`
   append semantics (the deck-split/diagram precedent). The linker runs last among the M4
   plugins so directive nodes already exist and are skipped.

6. **Deck behavior is an explicit no-op (AS-1/AS-4).** The auto-linker **early-returns on
   `kind: Presentation`** (the deck-split guard shape) — a deck is not auto-linked. An
   author may still use `:term` on a deck (it is explicit, section-independent), and the
   hover island (ADR-0025's sibling; footprint-guarded like M5) renders on any page that
   actually has glossary links, deck or doc. This is the declared, tested deck contract.

## Consequences

### Positive

- The pure resolver is small and exhaustively testable; the AST plugin stays thin (D1).
  The resolver is the single source of truth for four consumers (D6) → no drift,
  determinism (NFR-004).
- Ordering and guards are pinned by stage and ancestor type, not by fragile append-order
  reasoning — the AS-1 failure mode is designed out.
- `:term` and the auto-linker emit the *same* link node, so the hover island, no-JS
  fallback, and used-list treat them uniformly.

### Negative

- Two new pinned dependencies (`remark-directive`, `mdast-util-directive`). Mitigated by
  the supply-chain check (research.md) and the fact they are widely-used unified packages.

### Risks

- **Plugin append-order** could be perturbed by a Starlight/Astro upgrade. Mitigation: a
  build/unit assertion that a `:term` and an auto-link both resolve on the example page
  (order-sensitive) — a regression fails the gate.
- **Whole-word case-insensitive** over-linking common words. Mitigation: the ignore-list,
  `glossary_autolink: false`, and `:term[…]{link=false}` (FR-008/011); first-per-section
  bounds volume.

## Alternatives considered

### One big auto-linker WP (resolution + AST rewrite together)

Rejected (D1) — untestable resolution buried in tree-walking; four consumers would each
re-derive resolution. The pure-resolver split is the decomposition decision.

### Hand-roll `:term` parsing instead of adding `remark-directive`

Rejected — re-implementing directive tokenization is more risk than a pinned, standard
dependency, and would diverge from the documented `:name[content]{attrs}` syntax.

### Case-sensitive matching

Rejected in rev 2 (squad T-01): case-sensitivity broke the "cargo"/"Cargo" natural-prose
flagship test. Whole-word case-insensitive is the pinned rule (FR-006).

### Auto-link decks like doc pages

Rejected — a slide is a dense, layout-sensitive surface; silent auto-links would disrupt
reveal sizing and the first-per-section model is ill-defined across slides. Decks get the
explicit `:term` only (Decision 6).

## References

- [ADR-0026](./0026-glossary-source-and-generation-seam.md) (the shared index),
  [ADR-0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md) (the
  used-list consumer), [ADR-0012](./0012-slide-decks-static-reveal-from-markdown.md) /
  [ADR-0023](./0023-diagram-render-and-metadata-seam.md) (the `kind`-guard + append-order
  precedents).
- Spec FR-005/006/007/009/011/012; NFR-002/004/007; post-spec squad AS-1/AS-2/AS-4.
