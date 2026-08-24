---
title: M6 specified — slide decks (static reveal.js from Markdown)
description: The M6 mission spec landed and passed a four-lens post-spec adversarial review, folded into rev 2.
doc_status: active
updated: 2026-08-24
type: Changelog
kind: Changelog
tags: [planning, presentations, reveal-js]
related:
  - plans/features/slide-decks
  - plans/roadmap
  - architecture/slide-decks
---

# 2026-08-24 — M6 specified: slide decks (static reveal.js from Markdown)

Mission **M6** (`slide-decks`) is specified on `feat/slide-decks`. M6 builds the
presentations renderer the prior missions reserved space for: authors write a deck as
plain Markdown (`kind: Presentation`) under `presentations/`, a build-time remark
transform splits `##`/`###`/`---` into reveal.js slide sections, a dedicated
out-of-frame route server-renders `.reveal > .slides > section`, and self-hosted
`reveal.js@6.0.1` (core + Notes only) enhances that DOM — with a mandatory no-JS
linear fallback, a `--dk-*` → reveal `--r-*` theme scoped to the deck route, and one
published example deck flowing into sitemap, llms.txt, the agent API, and Pagefind
(but not RSS).

Four product/scope forks were settled with the mission owner before authoring: the
deck stays a `docs`-collection page rendered out-of-frame; vertical `###` stacks ship
in v1; the example ships a **published** deck; and discovery honors
`sections.yaml`'s feeds (no RSS).

## A post-spec adversarial squad hardened the spec

Four profile-loaded, read-only lenses reviewed the draft in parallel — testability
(`reviewer-renata`), architecture seams (`architect-alphonso`), decomposition
(`planner-priti`), and terminology (`lexical-larry`). Their findings are recorded in
the mission's `reviews/post-spec-squad.md` and folded into spec **rev 2**. The three
that would have bitten hardest:

- **The design of record contained an architecturally infeasible claim.** ADR-0012
  says a `Presentation` page "anywhere routes to the deck renderer," but Starlight
  owns a single catch-all route and the only clean out-of-frame mechanism is a
  path-prefixed higher-specificity route that shadows Starlight under
  `/presentations/*`. Rev 2 narrows the switch to **path + kind**, charters the
  amendment of ADR-0012 and `slide-decks.md` this mission, and makes a `Presentation`
  filed off-section a hard error — so the contradiction can never ship. It also
  re-frames the mechanism honestly as **Astro route-override shadowing** (Starlight's
  route is shadowed, not "excluded") and adds a build assertion that the deck URL is
  unique and byte-identical across the deck route, llms.txt, and the agent API.
- **A P1 accessibility gate the specified lane could not enforce.** The draft asked
  the axe lane to verify keyboard navigation, keyboard traps, and reduced-motion —
  none of which axe-core exercises. Rev 2 splits a11y into what axe checks (accessible
  names, button labels, region, size-aware AA contrast) and a new Playwright
  **interaction** test that drives arrow/space/Esc and asserts focus, no trap, and
  computed `transition-duration: 0s` under reduced motion.
- **Two published pages would move the pinned example counts from the wrong step.**
  Both the discovery wiring (which decides RSS exclusion and section labelling) and the
  presentations overview Hub were scheduled after the deck they affect, forcing a
  double-pin or an RSS leak. Rev 2's Layered-landing note lands discovery wiring
  **before** the deck and co-lands the overview Hub **with** the deck under one count
  recompute — mirroring how M3 landed its Audiences hub.

Rev 2 also narrowed the Pagefind assertion to the only build-present reveal chrome
(the speaker-note `<aside>`), mandated a retained draft deck for the exclusion
demonstrator, required the headingless-slide `aria-label` to be emitted, keyed the RSS
exclusion on `kind: Presentation`, extended the CSS-non-leak check to reveal's core
sheet, and added a **Domain Language** section canonicalizing the slide vocabulary
(vertical *slide* vs. vertical *stack*, authoring vs. navigation *controls*, the three
`--dk-*`/`--r-*`/`--sl-*` cascades, and "enhance" as reveal decorating existing DOM).

The mission is ready for `/spec-kitty.plan`, which will author the two gating ADRs
(0021 routing seam, 0022 reveal integration) before foundation.
