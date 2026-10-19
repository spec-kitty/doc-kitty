---
title: "ADR-0060: Keep remark and rehype on Astro's unified() processor for Astro 7"
description: DocKitty renders Markdown through Astro's unified() processor on Astro 7, so every remark and rehype plugin keeps working; a Sätteri port is deferred.
doc_status: active
updated: 2026-10-18T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0049-openapi-reference-via-existing-integration
  - architecture/research/astro7-starlight-041-migration-spike
---

# ADR-0060: Keep remark and rehype on Astro's unified() processor for Astro 7

## Status

**Accepted** — 2026-10-18. Records the decision for issue #143 (epic #149),
made by the project owner and confirmed by the migration spike (#142).

## Context

Astro 7 renders `.md` with Sätteri by default. Sätteri has its own plugin API
and does not run remark or rehype plugins. Every DocKitty Markdown feature is a
remark or rehype plugin. The spike proved each one by counting its marker in
the built HTML, with identical counts on `main` and on Astro 7:

| Feature | Plugin stage |
|---|---|
| Deck split (`kind: Presentation` slides) | remark |
| Relative `.md` links (ADR-0047) | remark |
| Base-absolute links | rehype |
| Diagram metadata, figures, Mermaid and PlantUML | remark and rehype |
| Glossary term links and autolinking | remark |
| Markua callouts, attributes and footnotes (ADR-0041) | remark |
| The single `remark-directive` owner | remark |

On Sätteri, the plugins these integrations append through `updateConfig` are
dropped with a warning, so the site builds without any of these features. The
spike found that drop as breakage B1 (see the
[migration spike](../architecture/research/astro7-starlight-041-migration-spike.md)).

Astro 7 keeps the remark/rehype pipeline as an opt-in processor:
`markdown.processor: unified()` from `@astrojs/markdown-remark`, which becomes
an optional peer of Astro that a project installs itself.

## Decision

1. **DocKitty renders Markdown with `markdown.processor: unified()`** from
   `@astrojs/markdown-remark`, which becomes a direct dependency of the toolkit.
2. **The toolkit sets the processor itself, from an integration named
   `doc-kitty:markdown-processor` that runs before any integration that appends
   a plugin.** Adopters do not configure it. `doc-kitty:compress-html` follows
   it. **Ordering requirement:** an adopter integration listed before DocKitty's
   that appends remark or rehype plugins has them dropped, because Astro has
   already chosen Sätteri when it runs. List such integrations after DocKitty's.
3. **DocKitty integrations keep appending their plugins through `updateConfig`
   with `markdown.remarkPlugins` / `rehypePlugins`.** The spike showed that
   Astro 7 folds these legacy keys into the processor after each integration's
   setup, in integration order. Starlight inserts its own plugins in place. The
   resolved order is unchanged: the directive owner first, Markua before
   Starlight's asides, deck split and base links after Starlight. The condition
   is the one Decision 2 meets: if the processor is not `unified()` when the
   first plugin is appended, Astro has already chosen Sätteri and drops it.

## Consequences

### Positive

- Every DocKitty Markdown feature keeps working on Astro 7 with no plugin
  rewritten, and in the same order.
- Adopters change nothing; the processor choice stays inside the toolkit.
- The migration (#119, #144, #145, #146) can proceed without a parser port on
  its critical path.

### Negative

- **Deprecated options.** Astro 7 deprecates `markdown.remarkPlugins`,
  `markdown.rehypePlugins` and `markdown.remarkRehype` and prints, once per
  build: "`markdown.remarkPlugins`, `markdown.rehypePlugins`, and
  `markdown.remarkRehype` are deprecated. Pass them to `unified({...})` from
  `@astrojs/markdown-remark` directly instead."
- **A second Markdown processor in the dependency tree.** Sätteri still ships
  with Astro; `@astrojs/markdown-remark` and its unified stack are added
  alongside it.
- **Markdown that a third-party integration renders through Sätteri skips
  DocKitty's plugins.** For example, `starlight-openapi` descriptions (#140,
  ADR-0049) would get no glossary links and no link checks.

### Risks

- Astro may remove the deprecated options in a later major. The trigger below
  catches that before it ships.
- An integration ordered before DocKitty's processor integration that appends
  a plugin would have it dropped. The toolkit owns the integration order
  (`defineDocKittyIntegrations`) and pins it in tests.

## Alternatives considered

### Option A: Port DocKitty's plugins to Sätteri now (#148)

Every feature in the table above would need rewriting against a new plugin API
before the migration could ship, putting a parser port on the migration's
critical path. Rejected for now; deferred, not abandoned.

**Reopen this decision when** Astro announces removal of the deprecated
`markdown.remarkPlugins`/`rehypePlugins` options, or when DocKitty adopts a
Sätteri-rendering integration whose Markdown needs DocKitty's plugins (for
example #140).

### Option B: Pass plugins to `unified({...})` directly

This avoids the deprecation warning, but changes how every DocKitty integration
registers its plugins: they would have to hand them to one place that builds
the processor, instead of each appending through `updateConfig`. The ordering
guarantees DocKitty relies on would move from Astro's integration order into
that one constructor. It is a reasonable follow-up once the migration has
landed, not a prerequisite.

## References

- Issue #143 (this decision), epic #149, spike #142.
- [Astro 7 / Starlight 0.42 migration spike](../architecture/research/astro7-starlight-041-migration-spike.md),
  section "Can an integration still append plugins under unified()?".
- [ADR-0049](0049-openapi-reference-via-existing-integration.md): OpenAPI reference pages
  through an existing integration.
- Issue #148: Sätteri port (deferred).
