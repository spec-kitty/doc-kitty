# Contract — Title-slide fit + stage cap + vertical-stack affordance (#66) & wide cap (#67)

## C-STAGE-1 — Title slide fits the stage
- **Given** the deck title slide at the default stage,
- **Then** it shows `h1 + hero` only, and its rendered content height ≤ the reveal logical
  stage height (no focal content clipped).
- The former overflow content (intro paragraph + first Mermaid diagram) appears on its own
  following slide, fully visible.
- The intro paragraph's `quokka showcase sentinel` remains within the published
  `data-pagefind-body` region (still indexed to the deck).

## C-STAGE-2 — No slide overflows
- Every slide's content is bounded in **stage units** (not viewport `vh`); no slide clips
  or introduces a spurious scroll region. Legit diagrams remain intact figures.

## C-AFFORD-1 — Vertical-stack affordance
- **Given** an active leaf that belongs to a vertical stack (a down and/or up route
  exists),
- **Then** a visible, labelled up/down affordance is shown.
- **Given** an active leaf with no vertical route,
- **Then** no up/down affordance is shown (no misleading cue).
- Affordance controls are real labelled `<button>`s (AX-2), keyboard-reachable; reveal's
  keyboard navigation is unaffected; the `slidechanged`→diagram-render ordering (NFR-004)
  is preserved.

## C-WIDE-1 — Wide-screen frame cap (#67)
- **Given** a documentation page at ≥ 100rem viewport width (1600/1920/2560px),
- **Then** the `.main-frame` band is capped (max-width ≈ 90rem) and horizontally centered:
  left and right empty margins differ by no more than a small tolerance.
- **Given** a viewport below the breakpoint,
- **Then** the layout is unchanged from `main` (cap does not apply).
- The rule targets the DOM-verified Starlight `.main-frame` class and lives in a base
  global sheet (survives brand swaps).
