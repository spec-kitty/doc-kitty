---
title: Mission status portal for kittified repos
description: "Generate a mission overview from a repo's Spec Kitty artifacts so the docsite doubles as a status portal."
status: draft
updated: 2026-08-22
type: Architecture
tags: [spec-kitty, portal, status, integration]
related:
  - architecture/research/qa-portal
  - adr/0006-direct-render-default-projection-deferred
---

# Mission status portal for kittified repos

An idea for first-class support of Spec Kitty ("kittified") repositories: when a
repo is governed by Spec Kitty, doc-kitty generates a mission overview so the
docsite doubles as a status portal. This is a proposal, not a decision.

It pairs with the [QA portal](./qa-portal.md) idea under a shared theme: doc-kitty
as a repository portal (docs, status, and QA), not only a docsite.

## The idea

If the repo carries Spec Kitty artifacts, render a mission board and per-mission
pages: mission name, phase, work-package progress, acceptance coverage, and links
to the spec artifacts. It is a published, read-only counterpart to the live
spec-kitty dashboard. Support is opt-in by presence: a non-kittified repo does not
get the page; a kittified one does.

## Data sources

- **`kitty-specs/<mission>/`** — the durable, committed mission specs: `spec.md`,
  `plan.md`, tasks, `lanes.json` (work-package lanes and status),
  `acceptance-matrix.json` (requirement coverage), `decisions/`. This is the
  reliable source.
- **`.kittify/` runtime and `kitty-ops/ops-index.jsonl`** — largely gitignored
  (confirmed in this repo), so they are not reliably present in a checkout. Do not
  depend on them for a static build.

## How to read the data (open decision)

- **Option A — read the committed artifacts directly** (`lanes.json`,
  `acceptance-matrix.json`, `spec.md` frontmatter). No spec-kitty dependency at
  build, but coupled to those file formats, which are spec-kitty-versioned and move.
- **Option B — call spec-kitty's own interface** at build (`spec-kitty status
  --json`, `context`, or the orchestrator-api). A stable contract, but it requires
  spec-kitty installed and a governed workspace during the build.

Lean: prefer Option B where spec-kitty is available (a stable contract on a moving
target), and fall back to Option A for a plain static snapshot. Build it as an
optional "kittify integration" gated on artifact presence, not as core.

## Relationship to the spec-kitty dashboard

The dashboard is a live localhost daemon (`.kittify/.dashboard`); this portal is a
published, static, read-only view. Public status versus local live. Complementary,
not a replacement.

## Considerations and risks

- **Format and version drift** — spec-kitty evolves; a direct file reader must be
  version-guarded, which is why the CLI/API contract is preferred.
- **Freshness** — a build-time snapshot; stamp it "as of <commit/build>".
- **Privacy** — mission specs can hold internal detail. The portal must respect
  publication gating (`doc_status`) and any confidentiality needs, which ties to
  the deferred projection/redaction path
  ([ADR-0006](../adr/0006-direct-render-default-projection-deferred.md), M8).

## Fit

A new generated surface, like the agent-API, opt-in by presence. It makes doc-kitty
a status portal for kittified repos, with the Spec Kitty product line as the first
consumer. A candidate feature and mission after the core docsite ships.

## Open items

- Read via committed files versus the spec-kitty CLI/API.
- The board's scope (which fields and per-mission detail) and privacy gating.
- Whether this is core or an optional kittify-integration module.
