---
title: "ADR-0032: Generate the ADR index; two-tree mechanism with a lockfile sync-check"
description: The own-tree ADR index becomes a generated artifact kept honest by a regeneration-clean CI check; the example tree drops its table and lets the Hub layout auto-list.
doc_status: active
updated: 2026-08-31
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0002-readme-as-index
  - adr/0030-markua-preprocess-to-directive
  - context/convention
---

# ADR-0032: Generate the ADR index (two-tree mechanism + lockfile sync-check)

## Status

**Accepted** — 2026-08-31. Introduced by the QOL adoption-enabler mission
(issue #44); resolves the ADR-index drift that ADR-0030 exposed.

## Context

The `adr/README.md` table (`ID | Title | Status | Date`) was hand-maintained. It
drifted: ADR-0030 landed without its row, and the committed table lagged the
actual ADR set. A hand table has no mechanical guarantee that it matches the
files it indexes.

The obvious fix — "delete the table and let the `kind: Hub` layout auto-list" —
is correct only where a Hub layout actually runs. But the two trees differ:

- **`example/docs/`** is the single Astro-built site (`package.json` `build` →
  `pnpm --filter example build`; `example/astro.config.mjs`;
  `content.config.ts base: 'docs'`). Its Hub pages render on build.
- **doc-kitty's own `docs/`** tree is validated by the bare-Node gates but is
  **never** Astro-rendered. There is no build step to run the Hub layout over
  it, so deleting its table would leave the own tree with **no** index at all.
  This is exactly where ADR-0030 drift occurred.

The Hub layout also cannot reproduce what the own-tree table needs: ascending
ADR-number ordering and a decision Status pulled from each ADR's body `## Status`
section (Starlight Hub cards are title/description, alphabetical).

## Decision

Use a **two-tree mechanism**, matched to which tree is rendered:

1. **Own tree (`docs/adr/`) — a generated artifact.** `src/scripts/generate-adr-index.mjs`
   recursively discovers `docs/adr/**/NNNN-*.md` (era subfolders included;
   `template.md` excluded), reads the frontmatter `title`/`updated` and the body
   `## Status` token, and rewrites **only** the `|`-prefixed table region of
   `docs/adr/README.md` — preserving the H1, the intro prose above, and the
   trailing prose below. Dates are UTC-sliced to `YYYY-MM-DD` so output is
   byte-idempotent. The ADR **files are the source of truth**; the table is
   derived. This is genuine generation, not hand-maintenance.

2. **Example tree (`example/docs/adr/`) — the Hub layout.** The redundant table
   is deleted; the `kind: Hub` layout auto-lists the ADRs on build. A
   build-artifact assertion checks that the built `/adr/` HTML contains the
   Hub-rendered link to the example ADR, so the auto-list is proven against
   rendered HTML, not source Markdown.

3. **Sync-check as a lockfile (not a bijection gate).** `generate-adr-index.mjs --check`
   regenerates to a buffer and exits non-zero if the committed `docs/adr/README.md`
   is not regeneration-clean. It is wired as an explicit CI step
   (`validate:adr-index`). This is a *lockfile* check — like `pnpm-lock.yaml`, it
   fails when the committed generated file diverges from its source, and the fix
   is always "re-run the generator and commit". It deliberately does **NOT**
   reintroduce a hand-maintenance / index-bijection gate that would require
   humans to keep a table in step by hand (C-004).

A separate referential-integrity check (reusing `collectDanglingRelated` from
`check-links.mjs`) fails on any ADR→ADR reference that points at a non-existent
ADR, so cross-references cannot dangle.

## Consequences

### Positive

- The own-tree index cannot silently drift: a stale table reds CI, and the
  remedy is mechanical (re-run the generator).
- Status and Date are read from the authoritative places (body `## Status`;
  frontmatter `updated`), so the table stays faithful to each ADR.
- The example tree stops carrying a redundant hand table; its index is the
  rendered Hub.

### Negative

- Two mechanisms index ADRs (generator for the own tree, Hub for the example),
  because the two trees render differently. The `--check` gate keeps the
  generated one honest; the build assertion keeps the rendered one honest.

### Risks

- If a future ADR uses an unusual `## Status` prose shape, the token-extraction
  rule (strip `**`, take the leading token up to the first `.`/`—`/whitespace)
  may need extending; the generator test pins the current real-corpus shapes.

## Alternatives considered

### Option A: Keep the hand table, just append the missing row + add ref-integrity

Rejected: drift recurs by construction — nothing mechanically ties the table to
the files.

### Option B: Build doc-kitty's own `docs/` as a second Astro site so a Hub renders it

Rejected: a build-topology change of Mission-B scale, and a Hub still cannot do
ADR-number ordering or body-`## Status` extraction.

## Deferred follow-up (C-006)

A number-ordered, Status-aware Hub **card** for multi-ADR *rendered* trees is
deferred: the example demo is single-ADR, and the own tree already gets full
fidelity via the generator. Filed as a follow-up rather than built here.

## References

- Research Decision 5 (the ADR-index topology BLOCKER resolution).
- [ADR-0002](./0002-readme-as-index.md) — README-as-index.
- [ADR-0030](./0030-markua-preprocess-to-directive.md) — the drift that exposed this.
