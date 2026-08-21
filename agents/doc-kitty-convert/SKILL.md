---
name: doc-kitty-convert
description: Convert an existing documentation set into the Common Docs — Kitty Variation. Handles migrating a vanilla Common Docs tree (index.md → README.md + frontmatter) and folding ad-hoc docs into the twelve-section structure, keeping the tree OKF v0.2 conformant. Use when asked to "migrate our docs", "convert to Common Docs", "adopt the kitty convention", or "make our docs OKF-compatible".
---

# Doc Kitty Converter

Bring existing documentation into the Kitty Variation without losing content.
Read [`../../docs/context/convention.md`](../../docs/context/convention.md) first.

## Case A — from vanilla Common Docs

The tree is already the twelve sections but uses frontmatter-free `index.md`.

1. For each `index.md`, `git mv` it to `README.md` in the same directory.
2. Add the required frontmatter to each new `README.md` (`title`, `description`,
   `status`, `updated`, `type` = the section's type). The bundle-root
   `docs/README.md` keeps `okf_version: "0.2"` and stays exempt from `type`.
3. Ensure every non-index file carries a valid `type` (OKF's hard requirement).
4. Leave `log.md` frontmatter-free.

## Case B — from ad-hoc docs

1. Inventory existing files and classify each into a section by subject
   (present-tense design → `architecture/`; decisions → `adr/`; how-to →
   `guides/`; etc.). Never conflate plans (future) / ADRs (past) / architecture
   (present).
2. Scaffold any missing structure: `node src/scripts/scaffold.mjs docs`.
3. Move content in, splitting files over ~300 lines (one concern per file), and
   add frontmatter. Preserve authorship in `authors`; link originals via
   `related` where useful.

## Always

- Stamp `generated: { by: agent/doc-kitty-convert, at: <ISO8601> }` on files you
  write or regenerate. Never fabricate optional metadata.
- Validate at the end: `node src/scripts/validate-frontmatter.mjs docs`.
- Point `AGENTS.md` / `CLAUDE.md` at `docs/README.md`.
- Report what moved, what was split, and any content that needs a human decision.
