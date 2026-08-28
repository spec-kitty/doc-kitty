---
title: Glossary
description: "How the glossary surface fits together: the load-once index, the shared resolver behind thin plugins, codegen into the docs collection, and the render-time links-used re-derive."
doc_status: active
updated: 2026-08-26
type: Architecture
kind: Explanation
authors:
  - stijn@sddevelopment.be
tags: [glossary, contextive, autolink, accessibility]
related:
  - adr/0025-glossary-on-this-page-block-and-remark-render-channel
  - adr/0026-glossary-source-and-generation-seam
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - adr/0028-glossary-frontmatter-fields
  - architecture/section-registry
  - plans/features/glossary-and-contextive
---

# Glossary

The glossary sources a project's domain vocabulary from a single Contextive
Community file (`.contextive/definitions.yaml`), auto-links its terms across pages,
shows a hover preview, and lists the terms each page used. This page maps the
surface — the parts and how they fit. The decisions behind it are
[ADR-0025](../adr/0025-glossary-on-this-page-block-and-remark-render-channel.md),
[ADR-0026](../adr/0026-glossary-source-and-generation-seam.md),
[ADR-0027](../adr/0027-auto-link-resolution-scoping-and-term-directive.md), and
[ADR-0028](../adr/0028-glossary-frontmatter-fields.md); those records stay
authoritative.

Audience: contributors working on the loader, resolver, plugins, page generator,
or the "On this page" block, and site authors who want to know what activates the
feature.

## Presence-gated activation

The whole feature is driven by one signal: the presence of
`.contextive/definitions.yaml` under the site root. There is deliberately **no**
config toggle. When the file is absent the integration is not added, no plugins
register, no pages generate, and the built corpus is byte-identical to a
glossary-free site (NFR-002). Landing the definitions file is the single
on-switch.

## Load once, one shared index

`loadGlossary` is the **single** place the definitions file is parsed and
validated (INV-G1). It validates against the pinned Contextive Community schema
and is **build-fatal** on invalid input, throwing a message that names the
offending context, term, and field; every `meta` value is scheme-checked with the
same allowlist the diagrams surface uses. From the validated model it builds one
`SharedTermIndex` — a `surface → candidates` map (term names and aliases share it,
lowercased) plus per-context data for page generation. That one index is imported
by the generator, the resolver, the `:term` directive, and the block, so nothing
re-parses and no two consumers can drift.

## The resolver behind thin plugins

Resolution lives in one pure function, `resolveSurface` (the one shared matcher):
given a surface, the page's own `glossary_context`, the index, and the ignore
list, it returns a `link`, an `unresolved` collision, or `none`. It does no I/O
and imports no framework, so it is unit-tested directly and behaves identically
everywhere it is called.

Two thin remark wrappers own only the gates and the vfile:

- **`glossary-autolink`** links the **first eligible occurrence per H2 section**,
  never rewriting inside code, headings, or existing links, and honours the
  per-page `glossary_autolink: false` opt-out. An unresolved cross-context
  collision is left as plain text and reported once per distinct surface through a
  stable, greppable `file.message` warning — the build still exits 0 (NFR-007).
- **`glossary-term`** turns a `:term[text]{context=…}` directive into the **same**
  link node the auto-linker emits, so an authored link and an auto-link are
  indistinguishable downstream. `:term` is the sanctioned escape hatch: it forces
  a link where a collision would otherwise be left unresolved, and `link=false`
  suppresses one.

The plugin order is fixed by the integration: `remark-gfm → remarkDirective →
glossary-term → glossary-autolink`, so a `:term` node already exists when the
auto-linker walks and is respected as the section's first eligible occurrence.

## Codegen into the docs collection

Generated glossary pages are **non-authored**, so an injected route would be
invisible to `getCollection('docs')`, the sidebar, the sitemap, the agent API, and
`llms.txt`. Instead `generateGlossaryPages` writes real Markdown files —
`docs/glossary/index.md` (the hub) and `docs/glossary/<context>/index.md` (one per
context) — into the globbed `docs` collection at `astro:config:setup`, before any
generator reads the collection. The generator is a pure function of the index:
contexts and meta keys are emitted in a stable sorted order with no timestamp, so
a rebuild produces byte-identical files and a dev-watcher never loops. Because the
pages are ordinary collection files, every downstream generator picks them up with
**zero new wiring**.

## Render-time re-derive of links-used

The "On this page" block lists the distinct glossary links a page actually used.
That datum is produced in the remark pass, but the frontmatter channel that would
carry it to render is **retired**: the docs schema strips undeclared keys and
`entry.data` freezes at load, so a remark-published key never survives. The block
therefore **re-derives** the list at render, re-running the SAME pure transforms
over the page's `entry.body` (parse → `remarkDirective` → `glossary-term` →
`computePageLinks`). Because those transforms are deterministic, the re-derived
list is byte-identical to what the pipeline linked — `:term` links included — so
"links used" can never drift from "links inserted". The block composes the M3
`external_references`/`related` renderers **by import** (an ADR-0017 companion); it
never edits an M3-owned file, and it is presence-gated so a glossary-free build
stays byte-identical.

## Hover preview footprint

Each glossary anchor carries only `data-glossary-term` and
`data-glossary-context`; the definition text rides a single per-page JSON payload
(`<script type="application/json" id="dk-glossary-definitions">`). The preview
island is injected page-wide but early-returns before pulling its heavier chunk on
any page with no glossary links, so a glossary-free route never requests the
popover code (NFR-003). The preview is a custom element built to WCAG 2.2 1.4.13 —
hoverable, Esc-dismissible, and persistent — because the `title` attribute cannot
meet that criterion. The anchors are plain links (`target="_blank"`,
`rel="noopener"`), so with JavaScript disabled the click-through and the "On this
page" list both still work (NFR-005).

## Navigation and the section registry

The glossary ships under a named **"Reference"** nav group (issue #18). The
`docs/glossary/` **content folder is unchanged** — the
[section registry](./section-registry.md) (`_meta/sections.yaml`) simply gives the
`glossary` section `label: Reference`, and the registry-driven Starlight sidebar
(`src/lib/config.ts`) renders it as a named, ordered group `autogenerate`-ing from
that same folder. (The group's `autogenerate.directory` is `docsDir`-prefixed —
`docs/glossary`, not bare `glossary` — because Starlight matches autogenerate routes
against a hard-coded `src/content/docs` root; see
[ADR-0029](../adr/0029-sidebar-autogenerate-content-root-coupling.md).) Relabelling
or reordering the group is now a `sections.yaml` edit alone — no theme edit. (The
section id is the folder name, so moving the group's content on disk is still a file
move.)

The registry also drives the discovery surfaces, but they consume it to different
depths. `llms.txt` (group heading) and the RSS `<category>` fallback resolve the
glossary's label to "Reference". The agent-API index applies the registry's section
*order* only — a page's `section` field stays the bare folder id (`glossary`), so
`/api/index.json` ranks the glossary with a finite order but does not relabel it.
Either way the glossary no longer falls through as an unknown, last-ranked section.
The frozen `SECTION_ORDER` / `SECTION_LABEL` in `metadata.ts` remain as the
no-registry fallback for a docs root without a `sections.yaml`.
