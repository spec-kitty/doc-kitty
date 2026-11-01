---
title: Activating and operating CI/CD
description: How a repository admin turns the CI/CD pipeline into a required merge gate and operates its path-scoped lanes.
doc_status: active
updated: 2026-11-01T00:00:00Z
type: Operations
kind: How-To
authors:
  - human:stijn
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

Two out-of-band settings turn the pipeline into an enforced gate: the required
check and GitHub Pages. The merge queue and the `pr:pause-ci` label keep it
working while many PRs land at once.

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

### Require the merge queue on `main`

CI runs on the `merge_group` event, so `main` can use a merge queue
([ADR-0072](../adr/0072-parallel-landing-without-shared-files.md)). The queue
tests each PR on top of the PRs ahead of it and merges only what passes, so
parallel PRs no longer need rebasing one by one.

1. In **Settings → General → Pull Requests**, keep **Allow rebase merging**
   on; the queue can only use a method the repository allows.
2. In the `main` rule (**Settings → Branches**, or the ruleset that covers
   `main`), enable **Require merge queue**, and turn off **Require branches to
   be up to date before merging**: the queue already tests each PR on the
   latest `main`.
3. Set **Merge method** to **Rebase and merge**. `main` keeps a linear history
   of each PR's commits. Rebasing gives them new SHAs, so they are not the
   author's signed commits; check this against **Require signed commits** if
   that rule is on.
4. Set **Build concurrency** to **3**, and the group size to **minimum 1,
   maximum 3**. A full CI run takes 8 to 10 minutes, and a larger group means
   one red PR sends more of its neighbours back to the queue.
5. Enable **Only merge non-failing pull requests**.
6. Set **Status check timeout** to **30 minutes**.
7. Keep `ci-ok` as the one required check. The queue waits for it on its
   `gh-readonly-queue/main/…` branch. In a ruleset, set its source to the
   GitHub Actions app, so no other integration can post a `ci-ok`.

### Create the `pr:pause-ci` label

Create a label named exactly `pr:pause-ci`. A PR that carries it runs no CI lane,
and its `ci-ok` is red, so it cannot merge or enter the queue. Use it to free
runners while a PR is still being reworked; remove it to run CI again. The
label is read on pull requests only, so it never pauses a queue run or `main`.

Two manual actions get around the pause, so avoid them on a paused PR: **Re-run
all jobs** on an older run replays that run's payload, which had no label, and a
manual dispatch of CI on the PR's branch does not read labels. Either can post a
green `ci-ok` while the label is on. The queue still tests the PR again before
it merges.

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

### The ADR index bot

PRs do not edit the ADR table in `docs/adr/README.md`
([ADR-0072](../adr/0072-parallel-landing-without-shared-files.md)). After a
merge that touches `docs/adr/`, the **ADR index** workflow
(`.github/workflows/adr-index.yml`) regenerates the table. When it changed, the
workflow force-pushes it to the `ci/adr-index` branch, dispatches CI there so
`ci-ok` shows on the branch head, and opens one PR. Later runs update the same
branch and PR. When the table on `main` is current again, the workflow deletes
the branch, which closes a leftover PR. It never pushes to `main`.

Opening the PR needs **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests**. Without it the
workflow warns and links the compare page in its run summary; open the PR from
there. Whoever opens it is its author and cannot approve it, so a second person
reviews it. Review and merge the bot PR like any other. `ci/adr-index` is the
bot's branch: each run rebuilds it from `main` and force-pushes it, so do not
commit to it by hand.

Until the bot PR merges, the table on `main` can lag a merged ADR. The ADR
files are the source of truth, and this tree is not rendered, so the lag is
harmless. Per PR, CI fails two ADRs that share a number
(`pnpm validate:adr-ids`). With the merge queue on, CI runs on the queue's
combined commit, so two queued PRs that took the same number are caught before
either lands. Before the queue is on, strict branch protection ("require
branches to be up to date") does this: the second PR must update onto the
first, which re-runs the check.

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
