---
title: Spec Kitty packs
description: "Generated hub pages for Spec Kitty packs and a repository's active charter, from one authored stub entry per source."
doc_status: draft
updated: 2026-11-12T00:00:00Z
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: Kittified repositories and packs repositories need their doctrine browsable next to their docs. The generated-section machinery already exists.
tags: [packs, doctrine, generated, kittified]
related:
  - architecture/research/packs
---

# Spec Kitty packs

An author writes one markdown entry with `kind: Pack` and a source, and the
toolkit generates a pack hub, one hub per artefact kind, and one page per
artefact. A kittified repository can also show its active charter: the packs it
selected and the artefacts in force.

Scope: Extended.

Design: [Spec Kitty packs as generated pages](../../architecture/research/packs.md).

## Slices

1. **ADR: the `Pack` stub and the generated `packs` section.** The stub's
   frontmatter contract, the new kinds (`Pack`, `Directive`, `Tactic`,
   `Procedure`, `AgentProfile`, `GlossaryPack`), the generator's producer stamp,
   and the site-level `packs` config. Records why the name is "packs" and not
   "charter".
2. **One pack from a local path.** A generator, run at `astro:config:setup`, that
   reads a pack directory and writes the pack hub, the kind hubs and the artefact
   pages for directives, tactics, procedures, agent profiles and glossary packs.
   The raw YAML is published next to each page. A `--check` drift gate. Fixture:
   `spec-kitty-open-packs/packs/go/`.
3. **Cross-links and backlinks.** Related artefacts and "Used by" from the DRG
   files, resolved by pack, kind and id. Pack dependencies on the pack hub.
4. **Active charter hub.** `source: { project: true }` reads the repository's
   `.kittify/` and renders the selected packs, overrides and resolved artefacts,
   with the tier each comes from.
5. **Git sources and publication policy.** `source.git` pinned to a commit or tag,
   a host allowlist, a cache, a `bundle` source for offline CI, and a site-level
   allow before a private pack is published.
6. **Remaining kinds and scale.** Missions, step contracts, templates, toolguide
   prose, styleguides and paradigms. Search weighting, `llms.txt` grouping, and
   rename aliases.
7. **Several versions of a pack.** A version switcher in the OpenAPI pattern.

Slice 1 comes first. Slices 2 and 4 can then run in parallel; slice 3 builds on
2. A spec-kitty request for a `pack export --json` command would let slice 2
read one versioned contract instead of the directory layout; it is tracked
upstream, not here.
