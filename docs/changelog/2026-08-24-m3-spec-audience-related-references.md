---
title: M3 specified — audience, related & external references
description: The M3 mission spec landed and passed a four-lens post-spec adversarial review, folded into rev 2.
doc_status: active
updated: 2026-08-24
type: Changelog
kind: Changelog
tags: [planning, metadata, relationships]
related:
  - plans/features/audience-related-external-references
  - plans/roadmap
---

# 2026-08-24 — M3 specified: audience, related & external references

Mission **M3** (`audience-related-external-references`) is specified on
`feat/audience-related-external-references`. M3 wires the `audience`, `related`, and
`external_references` frontmatter — whose shapes M1 froze and M2 built molecules for
but left deliberately unwired — into consistent, accessible on-page blocks; it gives
audiences a home (persona pages under `context/audience/` with attribute fields and
an Audiences hub) and backs citations with a shared `bibliography`/`tools` catalog
resolved at build, plus a `/api/bibliography.json` agent projection.

## A post-spec adversarial squad hardened the spec

Four profile-loaded, read-only lenses reviewed the draft in parallel —
testability (`reviewer-renata`), architecture seams (`architect-alphonso`),
decomposition (`planner-priti`), and terminology (`lexical-larry`). Their
convergent findings are recorded in the mission's
`reviews/post-spec-squad.md` and folded into spec **rev 2**. The two that would
have bitten hardest:

- **The persona relocation blast radius was understated.** Moving the example
  persona from `personas/` to `context/audience/` touches four hard-coded gate sites
  (two in `assert-chrome-artifacts.mjs`, two in `tests/a11y/routes.ts`), not one — a
  bare `git mv` would have reddened the `a11y` and chrome lanes. Rev 2 enumerates
  every site and requires an atomic move.
- **The example page-count invariant would move, owned by no requirement.** The new
  Audiences hub is a published page, so the pinned `EXPECTED_INDEX_ENTRY_COUNT` /
  `EXPECTED_SITEMAP_URL_COUNT` in `assert-build-artifacts.mjs` must move with it. Rev
  2 adds a requirement that owns those pins and decides the relocated persona's
  publication status (now `active`, with a draft page retained for the
  draft-exclusion demonstrator).

Rev 2 also resolved the content-block rendering seam toward carrier-body rendering
(the slot-props path was ADR-0015-incompatible), kept `toAgentRecord` pure with a
separate corpus-aware `resolveRelated`, split resolver vs. schema fixtures by their
owning lane, and canonicalized the terminology (one "stale-target status marker",
"catalog" not "registry", a defined citation/reference/catalog-record vocabulary).

The mission is ready for `/spec-kitty.plan`.
