---
title: M4 shipped — glossary + Contextive
description: A multi-context project glossary sourced from a Contextive definitions file, with per-section auto-linking, a hover preview, and an auto per-page "On this page" block.
doc_status: active
updated: 2026-08-27
type: Changelog
kind: Changelog
tags: [glossary, contextive, accessibility]
related:
  - plans/features/glossary-and-contextive
  - architecture/glossary
  - plans/roadmap
---

# 2026-08-27 — M4 shipped: glossary + Contextive

**A docsite now turns a single Contextive `.contextive/definitions.yaml` into a browsable,
per-bounded-context glossary and auto-links your domain terms across the docs — maintained
once, in the same file that powers the author's IDE.** The feature is entirely
**presence-driven**: drop in a definitions file and it activates; with no file the build is
byte-for-byte what it was before.

## What you get

- **Glossary pages, generated.** One page per bounded context at `/glossary/<context>/` plus a
  `/glossary/` hub, each term rendered from its markdown definition at a stable anchor. The
  pages are real files in the docs collection, so they show up in the sidebar, the sitemap, the
  agent API, and `llms.txt` with no extra wiring.
- **Auto-linking that refuses to guess.** The first eligible mention of each term (or alias)
  per section becomes a link — whole-word, case-insensitive, never inside code, headings, or
  existing links. When the same term is defined in two contexts, the page's own
  `glossary_context` settles it; if nothing settles it, the term is **left plain with a
  greppable build warning** rather than linked to the wrong definition. The build still exits 0.
- **A hover preview and a new tab.** Hovering a glossary link shows a custom definition popover
  built to WCAG 2.2 **1.4.13** (hoverable, Esc-dismissible, persistent, both colour modes);
  clicking opens the full definition in a new tab. With JavaScript off, links are ordinary
  anchors and the popover is simply absent.
- **An auto "On this page" block.** Below the content, a single block lists the page's external
  references, related pages, and the glossary links it used — deduped, omitted when empty,
  present without JavaScript.
- **Escape hatches.** `:term[text]{context=hr}` forces a link (and resolves a collision);
  `:term[text]{link=false}` suppresses one; `glossary_autolink: false` opts a whole page out; an
  ignore-list keeps common words quiet.

The preview script loads only on pages that actually have glossary links, and the whole build
stays browser-free.

## Notes for consumers

- Only the two new optional frontmatter fields — `glossary_context` and `glossary_autolink` —
  are added to the metadata contract (ADR-0028). Existing pages are unaffected.
- The glossary lands in the sidebar via Starlight's tree-autogeneration. A configurable named
  **Reference** nav group via `_meta/sections.yaml` is a tracked follow-up (the registry is not
  yet wired).

## How it was built

Design decisions are recorded in ADRs **0025–0028** and `docs/architecture/glossary.md`. The
mission ran the full arc — a post-spec squad (rev 2), a post-plan/tasks squad that reshaped the
biggest-risk seam (the "On this page" block re-derives its glossary links at render rather than
threading a dead frontmatter channel, and composes the M3 reference/related renderers without
editing them), nine work packages, and a post-merge security/fidelity/correctness squad whose
findings and dispositions are in the mission's `reviews/`. The post-merge squad's two security
hardening items (a `</script>` payload-breakout and a meta-URL markdown-link bypass) were fixed
before this landed; its structural correctness findings are filed below.

Refs #13
Refs #16
Refs #17
Refs #18
