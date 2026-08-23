---
title: Metadata model and chrome (M1)
description: Finalized the frontmatter metadata contract, its validator, the whole-tree migration, and the per-kind metadata-driven page chrome.
doc_status: active
updated: 2026-08-23
type: Changelog
kind: Changelog
tags: [metadata, chrome, doc_status, kind, theme]
related:
  - architecture/metadata-model
  - adr/0009-finalize-metadata-contract
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0014-upgrade-starlight-for-route-data-api
---

# 2026-08-23 — Metadata model and chrome (M1)

Mission M1 landed the finalized metadata contract and the chrome the toolkit
renders from it.

**The contract.** Renamed `status` to `doc_status`, added a required `kind` axis
(open vocabulary), and carried the optional families — `hero_image` (alt required),
`social_thumb`, `related` as a bare slug or `{ ref, note }`, `external_references`,
`audience`, and `moscow`. The build-free `validate-frontmatter.mjs` gate and the
Astro schema enforce the same contract, checked against a shared fixture corpus.
Publication gating now keys off `doc_status`, and the agent-API records carry
`doc_status` and `kind`.

**The migration.** Every page in `docs/` and `example/docs/` moved to the finalized
contract, including both bundle-root `README.md` files, and the normative
[convention](../context/convention.md) was amended to match.

**The chrome.** Per-kind, metadata-driven page chrome renders on the theme's slot
surface: four Starlight carriers, the neutral `--dk-*` token catalog with its
`--sl-*` bridge, a page hero from `hero_image`, a metadata band with a text-labelled
`doc_status` pill, share metadata (Open Graph and Twitter) with a
`social_thumb` → `hero_image` → site-default fallback, and a `Hub` layout that
renders a section index as a described-link list.

**Decisions.** [ADR-0013](../adr/0013-m1-chrome-substrate-single-layer.md) records
the single-layer chrome substrate M1 ships and the seams a later theme build-out
extends. [ADR-0014](../adr/0014-upgrade-starlight-for-route-data-api.md) records the
Starlight upgrade to 0.32 — the route-data API the carriers read landed there, not
in 0.30.
