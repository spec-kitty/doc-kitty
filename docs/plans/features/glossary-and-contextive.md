---
title: Glossary + Contextive
description: "A multi-context project glossary sourced from Contextive, with per-section auto-linking, hover previews, and an auto per-page references block."
doc_status: active
updated: 2026-08-26
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: Ubiquitous-language support is high value; the auto-linking effort and a Contextive dependency keep it out of MVP.
tags: [glossary, contextive]
related:
  - plans/roadmap
  - plans/features/audience-related-external-references
---

# Glossary + Contextive

Mission M4. A project glossary that auto-links terms across pages and integrates
with Contextive as the shared source of domain vocabulary. Scope: Extended.

Design research: `research/2026-08-21-astro-feature-discovery/findings-D-contextive-diagrams.md`
(Topics 1–2). The decisions below were settled with the mission owner on 2026-08-26.

## Decided design

### Source of truth

- Adopt the Contextive schema directly: `.contextive/definitions.yaml`
  (`contexts[] → terms[] → { name, definition, aliases, examples, meta }`). One file
  feeds both the IDE (Contextive editor hover/autocomplete) and the docsite.
- A loader parses and **validates against the pinned Contextive schema; invalid input
  is build-fatal** (mirrors the M3 dangling-reference integrity posture).
- `definition` and `meta` are markdown — rendered through the real markdown pipeline,
  never emitted as plain text. Any URL in `meta` is scheme-checked (the M5 `safeHref`
  lesson).

### Bounded contexts (multi-context v1)

- Full multi-context support in v1. The same term may exist in more than one context.
- Pages: **one generated page per context** (`/glossary/<context>/#<term>`) plus a
  `/glossary/` hub that lists the contexts.

### Scoping + collision policy

- A page declares its context via **`glossary_context`** frontmatter.
- Term resolution for an occurrence: candidates = the contexts that define the term or
  one of its aliases.
  - Exactly one candidate → auto-link it.
  - Multiple candidates → if the page's `glossary_context` is one of them, link to that
    context's definition (the page context **resolves** the collision).
  - Otherwise (no `glossary_context`, or the word is absent from the page's context but
    defined in 2+ others) → **do not auto-link; emit a build warning** naming the term
    and the competing contexts so the author resolves it.

### Auto-linking

- Link the **first occurrence per top-level (H2) section**.
- Hard guards (load-bearing, each with its own test): never rewrite inside code spans or
  blocks, headings, existing links, or frontmatter; whole-word, case-sensitive matching;
  an ignore-list for noisy terms; a per-page **`glossary_autolink: false`** opt-out.
- Activation is presence-driven: the glossary generates when `.contextive/definitions.yaml`
  exists; auto-linking is on by default with the opt-outs above.

### Link behaviour + hover preview

- Hover/focus → a **native definition preview** (framework-light; built to WCAG 2.2
  1.4.13 — hoverable, dismissible with Esc, persistent). The preview JS loads only on
  pages that actually have glossary links (M5-style footprint discipline).
- Click → the full definition, opened in a **new tab** (`target="_blank"`, `rel="noopener"`).

### Per-page "On this page" block

- An **auto-generated "On this page" block** is appended below the page content (not
  authored inline), with labelled sub-lists composing the page's M3 metadata references
  (`external_references`/`related`) and the glossary links used on the page. (Renamed from
  "References" to avoid clashing with the M3 "External references" label and the Reference
  nav group.)

### Explicit escape hatch

- A **`:term[text]{context=hr}`** remark directive (works in plain `.md`) explicitly
  links a term to a chosen context — the sanctioned way to resolve an unresolved collision,
  and to force or suppress (`link=false`) a link where auto-detection is wrong.

### Navigation

- The generated `docs/glossary/` folder appears in the sidebar **for free** via Starlight
  **tree-autogeneration**, and in the sitemap, agent API, and `llms.txt` because the pages
  are real files under the globbed `docs` collection (see [Shipped decisions](#shipped-decisions-resolved)).
- Named-group relocation "under a **Reference** hub" is **deferred**. It would be driven by a
  `_meta/sections.yaml` registry, but that registry is **unwired** today — the only live
  section identity is the M3-frozen `SECTION_ORDER`/`SECTION_LABEL` in `metadata.ts`, which
  this mission must not edit. FR-013's named-group placement is therefore a documented
  deviation, tracked as the `sections.yaml`-registry follow-up (see
  [section registry](../../architecture/section-registry.md)).

## Shipped decisions (resolved)

The plan session authored four ADRs and the mission implemented them. They stay
authoritative; the architecture surface is [architecture/glossary](../../architecture/glossary.md).

- **Source + generation seam** —
  [ADR-0026](../../adr/0026-glossary-source-and-generation-seam.md). One loader
  (`loadGlossary`) is the single parse-and-validate site and builds one shared index;
  invalid input is build-fatal. Generated pages are **codegen'd into the `docs`
  collection** at `astro:config:setup` (`generateGlossaryPages` writes
  `docs/glossary/index.md` + `docs/glossary/<context>/index.md`), deterministic and
  idempotent — settling **AS-6** in favour of codegen-into-collection over an injected
  route. Because the files land under the globbed collection, `getCollection('docs')`, the
  sidebar (tree-autogen), the sitemap, the agent API, and `llms.txt` pick them up with zero
  new wiring.
- **Auto-link resolution + scoping + `:term`** —
  [ADR-0027](../../adr/0027-auto-link-resolution-scoping-and-term-directive.md). One pure
  shared matcher (`resolveSurface`) is fronted by thin remark wrappers; the
  unresolved-collision rule is skip-and-warn (a stable, greppable `file.message`, build
  still exits 0). `remark-directive`/`mdast-util-directive` is the **new pinned dependency**
  (AS-2), and plugin order is fixed: `remark-gfm → remarkDirective → glossary-term →
  glossary-autolink`.
- **Per-page "On this page" block + render channel** —
  [ADR-0025](../../adr/0025-glossary-on-this-page-block-and-remark-render-channel.md),
  resolving **AS-3**. The frontmatter `glossary_links_used` channel is **retired** — the
  docs schema strips undeclared keys and `entry.data` freezes at load, so a remark-published
  key never survives to render. The block instead **re-derives** the links-used list at
  render, re-running the SAME pure transforms over `entry.body` (parse → `remarkDirective` →
  `glossary-term` → `computePageLinks`), so "links used" can never drift from "links
  inserted". It composes the M3 renderers by import (ADR-0017 companion), never editing an
  M3-owned file.
- **Frontmatter fields** —
  [ADR-0028](../../adr/0028-glossary-frontmatter-fields.md). `glossary_context` and
  `glossary_autolink` are additive, optional fields (a new ADR per ADR-0009's own rule).

Resolved open questions:

- **Render channel (AS-3):** retired the frontmatter channel; render-time re-derive is the
  sole mechanism (ADR-0025).
- **Generated-page registration (AS-6):** codegen-into-collection (ADR-0026).
- **Global toggle:** rejected. Activation is **presence-gated** on
  `.contextive/definitions.yaml` alone — no `DocKittyOptions` flag — so a glossary-free site
  stays byte-identical (NFR-002, C-005).

## Out of scope (this mission)

- Contextive **Cloud** edition APIs (private beta) — the open Community file format only.
- Multi-file / merged `.contextive` sources beyond the single conventional file (revisit
  on demand).
- Build-time diagram rendering and PlantUML — that is the deferred issue #13, not here.
