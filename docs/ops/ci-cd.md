---
title: Activating and operating CI/CD
description: How a repository admin turns the CI/CD pipeline into a required merge gate and operates its path-scoped lanes.
doc_status: active
updated: 2026-08-22
type: Operations
kind: How-To
authors:
  - stijn@sddevelopment.be
tags: [ci, cd, ops, github-actions]
related:
  - architecture/ci-cd-pipeline
  - adr/0007-ci-cd-path-scoped-lanes
---

# Activating and operating CI/CD

For a repository admin. The pipeline ships as workflow files, but two settings
are configured in the GitHub UI and cannot live in the repo. Until you apply
them, the pipeline runs but does not gate: it is advisory. This page is the
checklist to make it a real gate and the notes to operate it afterwards.

The mechanics behind the lanes live in the
[CI/CD pipeline design](../architecture/ci-cd-pipeline.md) and
[ADR-0007](../adr/0007-ci-cd-path-scoped-lanes.md); this page does not repeat
them.

## Activate the gate

Two out-of-band settings turn the pipeline into an enforced gate. Apply both.

### Require the `ci-ok` check on `main`

1. Open **Settings → Branches → Branch protection rules** and add (or edit) a
   rule whose branch name pattern is `main`.
2. Enable **Require status checks to pass before merging**.
3. In the status-check search box, select **exactly one** check: `ci-ok`. Do not
   add any other check. `ci-ok` is the single aggregate check the pipeline
   pins; the per-lane jobs report through it.
4. Save the rule.

The required-check string is exactly the job id `ci-ok`. Selecting a per-lane
job (for example `code-quality` or `doc-sanity`) instead would break the
path-scoped design: those lanes skip on changes that do not touch them, and a
required-but-skipped check blocks the merge. `ci-ok` stays green when the
applicable lanes pass and treats a skipped lane as fine, so it is the only check
that behaves correctly as the required gate.

Until this rule requires `ci-ok`, skipped lanes do not gate anything and the
whole pipeline is **advisory** — red runs do not block a merge.

### Enable GitHub Pages

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.

The deploy workflow publishes the built example site to Pages on pushes to
`main`. Without this source setting, the deploy job has nowhere to publish.

## Operating notes

### What runs for which change

Each pushed change belongs to one change group, and only the lanes that group
can affect run. The rest report as skipped, and `ci-ok` stays green through the
skips.

| Change group | Lanes that run |
|---|---|
| `code` | code-quality, doc-sanity, build-example |
| `example_content` | doc-sanity, build-example |
| `repo_docs` | doc-sanity |
| `workflows` | everything (CI logic itself changed) |
| `ignored` | none |

The [lane matrix](../architecture/ci-cd-pipeline.md#lane-matrix) in the design
doc is authoritative, including the reasons each lane runs where it does.

### Nightly smoke and the deployed-since marker

A scheduled nightly flow exercises the live deployed site (link rot, SEO, a
subset of accessibility). It **reports**; it never gates a merge. To avoid
burning minutes on nights with no new deploy, it first compares the live Pages
deployment SHA against the SHA recorded by the previous run, persisted in a
durable git-ref marker. If the two match, the run exits early. Otherwise it runs
the suite and updates the marker to the deployed SHA. See
[nightly smoke](../architecture/ci-cd-pipeline.md#nightly-smoke--post-deploy-monitoring)
for the full gate and suite.

### Reading a red `ci-ok`

`ci-ok` fails only when one of its needed lanes failed or was cancelled — a
skipped lane never turns it red. To find the cause:

1. Open the failed run's checks and find the lane that is red, not `ci-ok`
   itself. `ci-ok` only aggregates; the real failure is upstream.
2. Read that lane's log. Typical causes: doc-sanity (frontmatter, dangling
   link, markdownlint, or Vale), code-quality (typecheck, lint, or unit test),
   or build-example (Astro build or a missing build artifact).
3. Fix the change, push, and let the same lane re-run. `ci-ok` goes green once
   every applicable lane passes.

### Fork PRs and secrets

The test and build lanes need no secrets, so they run and pass on pull requests
from forks. The deploy job and the nightly's Deployments-API call use
`GITHUB_TOKEN` and run only on the base repository, never on a fork PR. A fork
contributor therefore gets full `ci-ok` feedback without any secret exposure.
