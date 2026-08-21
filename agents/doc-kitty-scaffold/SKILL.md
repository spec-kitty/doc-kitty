---
name: doc-kitty-scaffold
description: Scaffold the standard Common Docs — Kitty Variation docs/ structure in a project. Creates the twelve section directories and stub files with correct frontmatter, using README.md (not index.md) as the frontmatter-carrying section index. Use when asked to "set up docs", "scaffold documentation", "create the docs structure", or "add docs to this project".
---

# Doc Kitty Scaffolder

Scaffold the standard repo-root `docs/` structure defined by the **Common Docs —
Kitty Variation**. Read [`../../docs/context/convention.md`](../../docs/context/convention.md)
before writing anything — it defines the sections, frontmatter, and twists.

## Workflow

1. **Check what exists.** List the project root. If `docs/` exists, note which
   sections are present — never overwrite an existing file.
2. **Pick sections.** Default is all twelve: `context, architecture, adr, plans,
   api, configuration, integrations, security, guides, operations, migrations,
   changelog`. Ask only if the user wants a subset.
3. **Emit the tree.** Prefer the toolkit script — it applies the twists for you:

   ```sh
   node src/scripts/scaffold.mjs docs                       # all sections
   node src/scripts/scaffold.mjs docs --sections context,architecture,guides
   ```

   If writing by hand, follow the rules below.
4. **Wire agents in.** Ensure the repo-root `AGENTS.md` / `CLAUDE.md` points at
   `docs/README.md` as the starting point.
5. **Validate:** `node src/scripts/validate-frontmatter.mjs docs`.

## Rules (Kitty twists vs. Common Docs)

- The section index is **`README.md`**, not `index.md`, and it **carries
  frontmatter** (same required fields as any page; its `type` is the section's
  type).
- The **bundle-root** `docs/README.md` carries `okf_version: "0.2"` and is exempt
  from `type`.
- `log.md` is reserved and frontmatter-free (optional per-directory change log).

## Frontmatter for stubs

```yaml
---
title: Short descriptive title
description: One sentence describing what this document contains.
status: draft
updated: <today, YYYY-MM-DD>
type: <section type — Context, Architecture, ADR, …>
generated:
  by: agent/doc-kitty-scaffold
  at: <ISO8601>
---
```

Don't fabricate `tags`, `related`, `sources`, or `stale_after` at scaffold time —
there's no real content to infer them from. Leave that to `doc-kitty-write`.
