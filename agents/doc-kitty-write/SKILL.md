---
name: doc-kitty-write
description: Write the actual content of a specific Common Docs — Kitty Variation file. Use when asked to write, fill in, or populate a doc — e.g. "write the architecture overview", "fill in the threat model", "document our API endpoints", "write an ADR for X". Distinct from scaffolding (empty stubs) — this produces real, substantive content, with correct frontmatter and the optional metadata that can be genuinely inferred.
---

# Doc Kitty Writer

Write a fully populated `docs/` file meeting the convention's content
requirements. Read [`../../docs/context/convention.md`](../../docs/context/convention.md)
first.

## Workflow

1. **Identify the target file** (use `doc-kitty-find` if unsure) and its section
   `type`.
2. **Explore the codebase** — `README.md`, `AGENTS.md`, existing `docs/`, config
   files, source layout, CI, migrations, tests. Extract as much as possible
   without asking.
3. **Ask only what you can't find**, batched into one message (owners, RTO
   targets, escalation contacts, …).
4. **Write complete content.** Never leave `TODO`. If something is genuinely
   unknown, write `> Not yet defined — update when X is decided.`
5. **Update related files** — the section `README.md` link list; the `adr/README.md`
   table if you wrote an ADR.
6. **Validate:** `node src/scripts/validate-frontmatter.mjs docs`.

## Writing standards

- Present tense for architecture/context/reference; imperative mood for
  guides/runbooks.
- Mermaid diagrams for architecture overviews/data models/infrastructure.
- Tables for env vars, endpoints, alerts, error codes.
- Numbered steps in guides and runbooks.
- Don't invent URLs, service names, or credentials not found in the codebase.

## Frontmatter

Required: `title`, `description`, `status` (`draft` unless told otherwise),
`updated` (today), `type` (section type). Always stamp:

```yaml
generated:
  by: agent/doc-kitty-write
  at: <ISO8601>
```

Add optional fields **only when genuinely inferable, never fabricated**:
`tags` (2–4 keywords from real content), `related`, `resource` (integrations
only), `sources` (only with a real citation), `stale_after` (`security/*` and
`configuration/*`: +6mo; `architecture/*`, `context/*`, `integrations/*`: +12mo),
and the Kitty `agent` block when you want to tune agent-API visibility/priority.
Never set `verified` — that's a human action.

## ADR rules

Never edit an accepted ADR — write a new one to supersede it. Number sequentially
(`NNNN-short-kebab-title.md`). Frontmatter `status` records the *document*
lifecycle (`active`); the *decision* status (Proposed/Accepted/…) lives in the
body `## Status` and the `adr/README.md` table.
