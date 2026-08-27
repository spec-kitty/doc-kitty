---
title: "ADR-0026: Glossary source, validation, and the codegen-into-collection generation seam"
description: The glossary loads once from the Contextive definitions file, validates build-fatally against a pinned schema, and generates one Markdown page per context into the docs collection.
doc_status: active
updated: 2026-08-26
type: ADR
kind: ADR
authors:
  - stijn@spec-kitty.ai
related:
  - plans/features/glossary-and-contextive
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - adr/0009-finalize-metadata-contract
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0018-citation-catalog-collections
---

# ADR-0026: Glossary source, validation, and the codegen-into-collection generation seam

## Status

Accepted. Establishes the M4 (Glossary) source-of-truth load, validation posture, and
page generation. Settles post-spec squad finding **AS-6** (generated pages are
non-authored). Pairs with
[ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md) (resolution +
auto-link) and [ADR-0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md)
(the per-page block). Grounded in
[findings-D](../../research/2026-08-21-astro-feature-discovery/findings-D-contextive-diagrams.md)
topics 1–2.

## Context

The glossary source is a single Contextive **Community** file,
`.contextive/definitions.yaml` (`contexts[] → terms[] → { name, definition, aliases,
examples, meta }`) — the same file the Contextive IDE extension reads, so vocabulary is
maintained once (FR-001, NFR-006). Four seams are load-bearing:

1. **Activation.** The feature is **presence-driven**: with no definitions file the build
   succeeds, no `/glossary/` route exists, and no auto-links appear (FR-001). A global
   config toggle on top of presence is **out** (spec open-question, resolved: not added).

2. **Validation.** Invalid input must be **build-fatal** with a message naming the
   offending context/term/field (FR-002), and a URL in `meta` with a non-allowlisted
   scheme is build-fatal too (FR-004, the M5 `safeHref` posture).

3. **Registration — the AS-6 risk.** Generated glossary pages are **non-authored**. The
   `docs` collection is a `glob({ base: 'docs', pattern: ['**/*.{md,mdx}','!**/log.md'] })`
   (schema.ts). Anything not on disk under `docs/` is invisible to `getCollection('docs')`,
   `_meta/sections.yaml`, the sidebar, the sitemap (config.ts draft filter globs `docs/`),
   the agent API, and `llms.txt`. FR-013 requires all of those to pick up the glossary, so
   an **injected virtual route** (which none of them see) does not satisfy the spec.

4. **Single parse, one shared matcher.** The definitions file is parsed and validated
   **once**; the resulting term/alias → anchor map is the single artifact shared by the
   page generator, the auto-linker, `:term`, and the "On this page" block (Key Entities;
   D6). Parsing per-consumer would risk drift and break determinism (NFR-004).

## Decision

1. **One loader, parse-and-validate once, build-fatal on invalid (`src/lib/glossary/
   load.ts`).** It reads `.contextive/definitions.yaml`, validates against a **pinned
   Contextive schema** (a zod schema mirroring the pinned Community format, versioned in
   the file header), and on any violation **throws** with a message naming the
   context/term/field — the build fails (FR-002). It scheme-checks every URL in `meta`
   with the shared `safeHref` allowlist and treats a non-allowlisted scheme as fatal
   (FR-004). The loader is **presence-gated**: absent file → it returns "no glossary" and
   every downstream seam early-returns (FR-001). Parsing is Astro-free and unit-tested.

2. **The loader emits the shared term-index (the one shared matcher's data).** From the
   validated model it builds the **term/alias → { context, anchor } map** once — anchors
   are `slug(term.name)`, deterministic (NFR-004) — plus the per-context term lists for
   page generation. This single artifact is imported by the generator, the resolver
   (ADR-0027), and the block (ADR-0025). Aliases are keyed exactly like names (FR-012).

3. **Pages are codegen'd as Markdown files INTO the `docs` collection — not an injected
   route (settles AS-6).** A build step writes `docs/glossary/index.md` (the hub listing
   contexts) and `docs/glossary/<context>/index.md` (one page per context) with real
   frontmatter (`kind: Glossary`, `glossary_context: <context>`, `title`, `doc_status:
   active`) and body rendering each term's `definition`/`meta` **through the site's real
   markdown pipeline** (never plain text; FR-003/FR-004), each term at a deterministic
   `#<anchor>`, and a context's `domainVisionStatement` if present. Because the files land
   under `docs/`, the existing `glob` loader ingests them, so the **sidebar, sitemap,
   agent API, and `llms.txt` pick them up with zero new wiring** (FR-013). Generation is
   **presence-gated and idempotent**: same input → byte-identical files (NFR-004); no
   definitions file → no files written, no `/glossary/` route.

4. **The generated pages set `glossary_context` on themselves, so the glossary auto-links
   its own terms.** A generated context page declares its own context, so ADR-0027's
   resolver links cross-references between terms deterministically without collision
   ambiguity.

5. **Where the generator runs is an Astro integration hook, single-owner (config.ts).**
   The generation step is wired in the **one** integration WP that owns config.ts (D2, the
   M5 WP03 pattern) — presence-gated so a diagram/glossary-free site's integration array
   stays byte-identical (mirrors the `diagrams` opt-in). The generator writing into a
   source-controlled `docs/glossary/` tree is the **terminal example WP's** on-switch (D3):
   until the example `.contextive/definitions.yaml` exists, the generator is a no-op and
   the corpus is unchanged.

## Consequences

### Positive

- FR-013 is satisfied *for free*: files under `docs/` are seen by every generator because
  they go through the same glob the whole site already uses — no per-generator glue, no
  sitemap/agent-API/llms.txt special-casing.
- One parse, one shared index → determinism (NFR-004) and no cross-consumer drift.
- Presence-gating keeps a glossary-free site byte-identical (NFR-002), matching the M5
  opt-in discipline.

### Negative

- Codegen writes files into the tracked `docs/` tree, so the generated glossary is visible
  in git diffs and must be regenerated when the definitions file changes. Accepted:
  visibility is the point (the same files the sidebar/sitemap consume), and regeneration is
  deterministic.

### Risks

- **Contextive schema drift** — the Community format could change. Mitigation: the schema
  version is pinned and validated on load (FR-002); a drift fails the build loudly rather
  than mis-parsing.
- A stale generated tree (definitions changed, pages not regenerated) could diverge.
  Mitigation: generation is idempotent and gated in the build; the terminal WP's count-pins
  assert the generated set matches the fixture.

## Alternatives considered

### Serve glossary pages from an injected Astro route (`injectRoute`)

Rejected. An injected route is invisible to `getCollection('docs')`, `_meta/sections.yaml`,
the sidebar, the sitemap filter, the agent API, and `llms.txt` — a direct FR-013 failure.
Codegen-into-collection is the only option that satisfies the "generators pick them up"
requirement.

### Merge multiple `.contextive` files / support Contextive Cloud

Rejected — out of scope (C-002/C-003, NFR-006): Community single-file only, no Cloud API.

### Render `definition`/`meta` as pre-escaped plain text

Rejected — FR-003/FR-004 require the real markdown pipeline; plain text loses formatting
and the scheme-check posture.

## References

- [ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md) (the resolver +
  auto-linker sharing this index),
  [ADR-0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md),
  [ADR-0018](./0018-citation-catalog-collections.md) (the file-loader-into-collection
  precedent), [ADR-0009](./0009-finalize-metadata-contract.md) (`kind: Glossary` is already
  in the open vocabulary), [ADR-0013](./0013-m1-chrome-substrate-single-layer.md).
- Spec FR-001/002/003/004/013; NFR-004/006; C-002/003; post-spec squad AS-6.
