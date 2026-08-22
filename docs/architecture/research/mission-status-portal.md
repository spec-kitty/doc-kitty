---
title: Mission status portal for kittified repos
description: "Generate a mission overview from a repo's Spec Kitty state so the docsite doubles as a status portal."
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

If the repo carries Spec Kitty state, render a mission board and per-mission pages:
mission name, phase, work-package progress, and links to the spec artifacts. It is
a published, read-only counterpart to the live spec-kitty dashboard. Support is
opt-in by presence: a non-kittified repo does not get the page; a kittified one
does.

## Where the data lives

Spec Kitty state is not one JSON file. The relevant, git-tracked sources:

- **`kitty-specs/<mission>/`** — Spec Kitty's convention for committed mission
  specs: `spec.md`, `plan.md`, `tasks.md`, `tasks/WP##-*.md`, `contracts/`,
  `decisions/`. Tracked when present. Note it is not present in doc-kitty itself
  yet, so detection must be presence-based.
- **Work-package status** — carried in each work-package file's frontmatter
  (`review_status`, `dependencies`), not a separate lanes file.
- **The event log** — `.kittify/canonical-events.jsonl` is git-tracked and is the
  authoritative machine-readable state (`.kittify/metadata.yaml` sets
  `event_log_authority`).

There is **no `lanes.json` and no `acceptance-matrix.json`**; requirement (FR)
coverage is derived at mission-review time, not stored as a file. Runtime state
(`.kittify/runtime/`, `.kittify/events/`, `.kittify/.dashboard`) and
`kitty-ops/ops-index.jsonl` are gitignored, so a static build cannot rely on them.

## How to read it

- `kitty-specs/` is **protected territory** in Spec Kitty doctrine: tooling that
  iterates or recomputes state over existing `kitty-specs/*/` is flagged as a
  violation pattern. A build that parses those files directly works against the
  doctrine, not only against a moving file format.
- Prefer the **orchestrator-api**, Spec Kitty's documented external-integration
  surface. It gives a stable read without reaching into protected files, and needs
  spec-kitty available at build.
- A **direct read** of the committed sources (work-package frontmatter plus
  `canonical-events.jsonl`) is a degraded, read-only fallback for when spec-kitty
  is not available at build. Keep it version-guarded.

## What it renders

A mission board: mission name, phase, work-package progress, and last activity;
per-mission pages linking the spec, plan, tasks, and decisions. FR coverage, if
shown, is computed, not read from a stored matrix.

## Relationship to the spec-kitty dashboard

The dashboard is a live localhost daemon (`.kittify/.dashboard`); this portal is a
published, static, read-only view. Public status versus local live. Complementary,
not a replacement.

## Deploy target

This is a surface a **consuming kittified repo** renders on its own docsite, not a
feature of doc-kitty's own site. doc-kitty ships the generator; the consuming
repo's build produces the portal from its Spec Kitty state.

## Privacy and access control

The portal is a **generated surface** built from Spec Kitty artifacts, not from the
`docs/` tree, so it needs its **own gating model**: which field on which artifact
keeps a mission or work package off the published board. ADR-0006's projection
(M8) redacts the authored `docs/` tree, and `doc_status` gates `docs/` pages; that
is a related but different mechanism and does not cover this generated surface for
free. See [ADR-0006](../../adr/0006-direct-render-default-projection-deferred.md).

On a public GitHub Pages deploy there is no access control: anyone can read the
board. Redaction must be provably complete before publish, and spec and decision
bodies should be treated as potential secret carriers.

## Considerations

- **Freshness** — a build-time snapshot; stamp it "as of <commit/build>".
- **Version drift** — spec-kitty evolves; the orchestrator-api contract is the
  stable read, and any direct file reader must be version-guarded.

## Open items

- Read via the orchestrator-api versus a direct committed-file fallback.
- The portal's own gating model, and the public-deploy constraint (redaction
  complete before publish; specs and decisions as potential secret carriers).
- The board's scope (which fields, and how much per-mission detail).
- Whether this is core or an optional kittify-integration module.
