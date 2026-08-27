---
title: M4 specified — glossary + Contextive
description: The M4 glossary mission spec landed and passed a four-lens post-spec adversarial review, folded into rev 2.
doc_status: active
updated: 2026-08-26
type: Changelog
kind: Changelog
tags: [planning, glossary, contextive]
related:
  - plans/features/glossary-and-contextive
  - plans/roadmap
---

# 2026-08-26 — M4 specified: glossary + Contextive

Mission **M4** (`glossary`) is specified on `feat/glossary`. M4 turns a single Contextive
definitions file (`.contextive/definitions.yaml`) into browsable, per-bounded-context
glossary pages and **auto-links** the first use of each term per section across the docs —
with a hover definition preview, a new-tab click-through, and an auto per-page "On this page"
block. The same file also powers the author's IDE, so vocabulary is maintained once.

Six design forks were settled with the mission owner before authoring: full **multi-context**
support in v1; **per-page `glossary_context`** scoping where a page's context resolves a
collision and an **unresolved collision is left unlinked with a build warning** rather than
guessed; **first-occurrence-per-section** auto-linking with hard node-skip guards; a **hover
preview + new-tab click**; and a `:term[text]{context=…}` **escape hatch**. Generated pages
appear in the sidebar (Starlight tree-autogeneration) and every generator (sitemap, agent API,
`llms.txt`); a configurable named **Reference** nav group via `_meta/sections.yaml` was
deferred at implementation (that registry is still unwired) to a follow-up. Build-time diagram
rendering and PlantUML remain a separate follow-up (issue #13).

## A post-spec adversarial squad hardened the spec

Four profile-loaded, read-only lenses reviewed the draft in parallel — testability
(`reviewer-renata`), architecture seams (`architect-alphonso`), decomposition
(`planner-priti`), and terminology (`lexical-larry`). Findings and dispositions are recorded
in the mission's `reviews/post-spec-squad.md`; the testability and terminology fixes are
folded into spec **rev 2**. The ones that would have bitten hardest:

- **The flagship acceptance test could not pass.** A case-sensitive matching rule
  contradicted the "cargo"/"Cargo" example, and "first per section" had no defined section
  boundary — so the core "N links" count was unassertable. Rev 2 makes matching whole-word
  **case-insensitive** and defines a section as H2→next-H2 (pre-first-H2 body implicit,
  H3+ nested), and it de-vacuums the a11y gate: the example must be asserted to actually
  produce links before the accessibility scan runs (the M5 render-gate lesson).
- **The glossary mission's own vocabulary leaked.** The `:term[word]` directive used the
  term's own banned synonym "word", the `glossary: false` opt-out was ambiguous, and
  "collision" vs "ambiguity" were conflated. Rev 2 uses `:term[text]`, renames the opt-out
  to **`glossary_autolink: false`**, and defines **unresolved collision** as canonical.
- **The per-page block sits on an ADR-0017 fault line.** The "glossary links used on a page"
  datum originates in the remark pass, but M3 renders references as prop-less carrier-body
  components with no channel to remark data — so "just append a block" is not possible. Rev 2
  renames the block to **"On this page"** (to stop clashing with the M3 "External references"
  label) and surfaces the data-channel decision, plus the generated-page registration
  question (non-authored pages must be codegen'd into the collection to reach the sidebar,
  sitemap, agent API, and `llms.txt`) and the new `remark-directive` dependency, as explicit
  plan-phase ADR work.

The mission is ready for `/spec-kitty.plan`, which authors the glossary ADRs (source +
generation, auto-link + `:term`, and the "On this page" block / ADR-0017 companion) before
implementation.
