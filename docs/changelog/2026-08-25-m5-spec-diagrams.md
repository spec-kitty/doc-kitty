---
title: M5 specified — diagrams (client-side Mermaid)
description: The M5 mission spec landed and passed a four-lens post-spec adversarial review, folded into rev 2.
doc_status: active
updated: 2026-08-25
type: Changelog
kind: Changelog
tags: [planning, diagrams, mermaid]
related:
  - plans/features/diagrams
  - plans/roadmap
---

# 2026-08-25 — M5 specified: diagrams (client-side Mermaid)

Mission **M5** (`diagrams`) is specified on `feat/diagrams`. M5 lets authors write
diagrams as `` ```mermaid `` fenced code blocks and have them render **client-side** as
brand-themed, accessible **diagram figures** — on documentation pages **and** inside the
M6 out-of-frame slide decks — with a caption and an accessible name authored in the
diagram's own `%%` comment syntax, no external service, and a readable no-JS fallback.

Four product/scope forks were settled with the mission owner before authoring: diagrams
render inside decks in v1; packaging is an opt-in preset option
(`defineDocKittyIntegrations({ diagrams: true })`); the `%%` metadata field set is
`title`/`description`/`attribution`/`source`; and the `--dk-diagram-*` tokens are promoted
to the Default catalog with light-mode values. The **build-time static-SVG render** (both
engines) and **PlantUML** are a tracked follow-up (issue #13, "Enhanced diagram support").

## A post-spec adversarial squad hardened the spec

Four profile-loaded, read-only lenses reviewed the draft in parallel — testability
(`reviewer-renata`), architecture seams (`architect-alphonso`), decomposition
(`planner-priti`), and terminology (`lexical-larry`). Their findings are recorded in the
mission's `reviews/post-spec-squad.md` and folded into spec **rev 2**. The ones that would
have bitten hardest:

- **A description-only diagram was nameless.** Mermaid's `accTitle` sets the accessible
  *name*, `accDescr` only the *description* — and since `title` is optional and
  `description` is the primary field, a description-first diagram would have rendered
  without an accessible name and failed the a11y gate, masked by the all-fields
  demonstrator. Rev 2 derives the name from `title` **or `description`** and gates the
  title-absent path.
- **Two of the a11y assertions were vacuous.** axe does not evaluate SVG `<text>` contrast,
  and its unlabeled-graphic rule may not even fire on Mermaid's role — so the "AA contrast
  via axe on the rendered SVG" and "axe enforces the name" claims would have passed
  trivially. Rev 2 proves contrast with a **vitest** on the token hex pairs and asserts the
  accessible name **directly**, keeping axe for the surrounding HTML, and adds a
  **non-vacuous render-gate** (`figure svg[aria-labelledby]` present, `pre.mermaid` no
  longer raw) so a Mermaid syntax-error SVG can't slip through.
- **Four seams were being decided silently, and one left the branded example un-themed.**
  astro-mermaid ships its own render+re-theme loop, so a second doc-kitty observer would
  have raced it; the deck-script reachability and the rehype-after-astro-mermaid ordering
  were asserted without proof; and promoting `--dk-diagram-*` to the Default catalog alone
  would have left the *branded* example/deck rendering vanilla colours (the brand values
  live in an orphan asset). Rev 2 lifts these into two plan-phase ADRs — **ADR-0023**
  (single render owner, plugin-ordering contract + fallback, deck render-path) and
  **ADR-0024** (token promotion to Default **and** the brand `tokens.css`, orphan retired)
  — and the deck fence co-lands the showcase-deck render-wait so the already-scanned deck
  route stays green.

Rev 2 also flips the example `diagrams: true` in the transform work package (so the
pre-existing `overview.md` fence is never rendered unwrapped), makes the injection robust
to a leading `%%{ init }%%` directive or YAML frontmatter, bounds the a11y-guaranteed
diagram types (flowchart/sequence/class), asserts the footprint via Playwright network
capture, adds an opt-in-off unit test, and canonicalized the terminology (accTitle/accDescr
are **accessibility statements**, never "directives"; **diagram** the umbrella vs the
**rendered SVG** vs the **diagram figure**).

The mission is ready for `/spec-kitty.plan`, which authors the two gating ADRs (0023, 0024)
before implementation.
