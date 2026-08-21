---
title: "ADR-0007: Path-scoped CI/CD lanes"
description: Run each CI lane only for the change it can affect, gated by a single aggregate check.
status: active
updated: 2026-08-21
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/ci-cd-pipeline
  - adr/0005-frontmatter-doc-status-and-divio-type
---

# ADR-0007: Path-scoped CI/CD lanes

## Status

Accepted

## Context

doc-kitty needs CI/CD that runs unit and integration tests, documentation sanity
checks, and example-site deployment. The stated requirement is efficiency: a
documentation-only change must not trigger code checks, and a code-only change
must not trigger the documentation build.

This ADR records the strategy and the settled parameters. The lane layout, job
graph, and check lists live in the design:
[CI/CD Pipeline](../architecture/ci-cd-pipeline.md).

## Decision

Detect the change surface once, then run lanes conditionally.

- A `detect-changes` job classifies the diff into path groups (`code`,
  `example_content`, `repo_docs`, `workflows`, plus an `ignored` set that runs no
  CI). Each lane runs only when its group changed.
- One `ci-ok` aggregate job is the sole required check. It passes when the
  applicable lanes pass and skipped lanes do not block a merge.

The efficiency split turns on one fact: `example_content` is deployed, so it
builds; `repo_docs` is not deployed, so it runs sanity checks only.

Settled parameters:

- Node 22 and above only. No Node 20, no version matrix.
- `markdownlint` and a `Vale` prose stylecheck run from the first release.
- GitHub Pages deploys on the mainline branch only. No per-PR previews.
- A nightly smoke flow checks the live site and runs only when the deployment SHA
  changed since the last run. Playwright-based checks (click-through, visual
  regression, deep accessibility) are deferred to M2. The M0 nightly uses `lychee`
  for links and Lighthouse CI for SEO and a subset of accessibility.

## Consequences

A doc-only change skips code checks, and a code-only change skips the doc build,
so most PRs run one lane instead of three. The single `ci-ok` check keeps branch
protection simple even though individual lanes skip.

The path groups need care: a file in the wrong group runs the wrong lanes. The
group definitions live in the design doc and are covered by the acceptance
criteria there.

## Alternatives considered

Separate path-triggered workflows per lane. Rejected: skipped required checks
block merges, and there is no single status to gate on.

Run everything on every PR. Rejected: it wastes the build on doc-only changes,
which is the case the requirement calls out.

## References

- [CI/CD Pipeline](../architecture/ci-cd-pipeline.md)
