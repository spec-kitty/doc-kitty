---
title: "ADR-0002: README-as-index (with frontmatter)"
description: Use README.md as the section index, and give it frontmatter.
doc_status: active
updated: 2026-08-21
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
---

# ADR-0002: README-as-index (with frontmatter)

## Status

Accepted

## Context

Common Docs uses a frontmatter-free `index.md` per directory. We want section
landing pages to render on GitHub/Bitbucket *and* on the docsite from one file,
and we lean on metadata harder than the base convention.

## Decision

Use `README.md` as the reserved section index, and — unlike vanilla Common Docs
— give it the same required frontmatter as any page. The loader rewrites
`**/README.md` to its directory slug at load time (no file copying). `log.md`
remains reserved and frontmatter-free and is excluded from the collection.

## Consequences

### Positive

- One file serves repo browsing and the rendered site.
- Section indexes carry metadata, so they feed nav/RSS/agent-API like any page,
  and Starlight gets the title it needs.

### Negative

- Diverges from Common Docs' frontmatter-free index rule (a documented twist).
- A repo migrating from vanilla Common Docs must rename `index.md` → `README.md`
  and add frontmatter.

## Update (2026-09-03) — superseded in part by ADR-0033 (`indexBasename`)

The adopter-loader-migration mission (issues #37/#48) amends the "use
`README.md`" stance above: **`README.md` remains the default** section-index
basename (this ADR's rationale — one file for repo browsing and the rendered
site — still holds and is why it stays the default), but it is no longer the
**only** recognized basename. A configurable, case-insensitive `indexBasename`
option additionally accepts `index.md`, so a project whose convention already
names section indexes `index.md` needs no file renames. See
[ADR-0033](./0033-flexible-section-identity.md) for the full decision, the
per-surface honoring list, and the both-files-present collision rule. This
Decision above is otherwise unchanged and is **superseded in part**, not
replaced.

## Alternatives considered

### Option A: Keep index.md frontmatter-free, derive title from H1

Closer to base Common Docs, but weakens the metadata-first goal.

## References

- [Convention](../context/convention.md)
- [ADR-0033](./0033-flexible-section-identity.md) — the partial supersession
  recorded above.
