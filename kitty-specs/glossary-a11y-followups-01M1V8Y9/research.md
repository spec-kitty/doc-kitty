# Research: Glossary a11y follow-up cluster (#77/#78/#79)

No NEEDS CLARIFICATION markers and no new/upgraded dependencies, so research is
confined to the three design decisions the implementers need pinned.

## D1 — Term affordance mechanism (#77)

- **Decision**: `aria-label = "<visible text>, glossary term"` on the glossary
  term anchor, composed inside the single shared builder. Recorded as decision
  `01M1V8ZYHJYYVGY438PB166WAX` (confirmed with the user), spec C-002.
- **Rationale**: It is an *attribute*, so it never enters the `textContent`-based
  links-used surface (FR-005) — no change to the "On this page" list or its
  count-pins. It is server-rendered, so it works with JS off (FR-002). Composed
  from the link's own children, both emitters stay byte-identical for free once
  IC-01 unifies them (NFR-001). Leading with the visible text keeps the accessible
  name in sync with the visible/spoken name and with voice-control "click <text>"
  (NFR-005).
- **Alternatives considered**:
  - *Visually-hidden text child* (`<span class="dk-visually-hidden"> (glossary
    term)</span>`): universally supported, but a real text node pollutes
    `textContent`, so the used-list surface and its count-pins would need extra
    exclusion logic in both the builder-side text concat and `collectLinksUsed`.
    Rejected — more moving parts, more regression surface, for no AT benefit over
    aria-label.
  - *`aria-roledescription="glossary term"`*: semantically the closest (relabels
    the role, keeps the pure accessible name), but AT support is patchier than
    aria-label and some screen readers ignore it. Rejected for reliability.

## D2 — Popover placement/caret e2e guard (#78)

- **Decision**: assert the *observable* positioning outputs, not the caret DOM:
  `popover.dataset.placement === 'bottom'` for a term with ample space below, and
  `=== 'top'` for a term forced low in the viewport; assert caret presence via the
  positioning contract's observable proxy — the `--dk-glossary-caret-left` custom
  property is set on the popover, and the `::after` pseudo-element has a non-`none`
  computed `border-*-color` for the active placement.
- **Rationale**: the caret is drawn by `::before`/`::after` pseudo-elements
  (`preview-popover.client.ts` `ensureStyle`), so there is no caret *element* to
  query. `data-placement` + the caret custom property are the JS-set, observable
  signals that a refactor would move. The flip logic (`preview-popover.client.ts`
  `position()`) chooses `top` when `spaceBelow < popoverHeight && spaceAbove >
  spaceBelow`, so the low-term case must guarantee little space below and more above.
- **Approach for the "low term" case**: use a small viewport height and/or scroll a
  late-in-document term so it sits near the viewport bottom before focusing it; the
  demonstrator route already has three `cargo` auto-links across three sections
  (one per section) plus the `:term` `policy` link — pick a high one and a low one.
  Run in both colour modes like the sibling assertions.
- **Alternatives considered**: asserting exact pixel `top`/`left` — rejected as
  brittle (the manual-pixel-pass fragility #78 is trying to replace). Screenshot
  diffing — rejected (this repo's visual baselines are font-flaky locally; #78
  wants a deterministic DOM/CSS assertion).

## D3 — Shared node type for the extracted builder (#79)

- **Decision**: the shared builder returns a minimal structural node shape both
  callers already use. `glossary-autolink.internal.ts` defines `MdNode` and
  `glossary-term.ts` defines `MdastNode`; both are hand-rolled structural
  interfaces (deliberately not `@types/mdast`, per the diagram-meta precedent).
  The shared builder declares its own minimal return interface (or reuses one),
  and each caller keeps its local node interface — assignment works structurally.
- **Rationale**: keeps the "no `@types/mdast` dependency" invariant the sibling
  plugins established; avoids a type-only coupling that would pull unified/mdast
  types into the pure glossary lib. The builder only needs `type`, `url`,
  `children`, `data.hProperties`.
- **Signature**: `glossaryLinkNode(context, contextSlug, anchor, termName,
  children, basePrefix)` — the auto-linker call site wraps its `surface` string as
  `[{ type: 'text', value: surface }]` (the only per-caller delta, already noted in
  #79). Href stays single-sourced via `glossaryTermUrl` (C-004).
- **Guard**: the existing live cross-emitter parity test proves the two emitters
  still match after the extraction; extend it (and the two per-builder golden
  tests) to include the new `aria-label` so the golden literals move together.

## Adversarial evidence

No security-impacting dependency decision in this mission (no dependency added,
upgraded, or removed), so the supply-chain adversarial pass is N/A. A bounded
2–3 lens opus adversarial squad WILL run over the integrated diff before the PR
(pre-merge point-cut), per the delivery discipline; its findings are folded or
filed as follow-ups there, not in this planning artifact.
