---
title: Ticketing report page
description: "A build-time report of a repo's tracker tickets, via an adaptor layer, so the docsite also serves as a ticketing portal."
doc_status: draft
updated: 2026-08-22
type: Architecture
kind: Explanation
tags: [portal, ticketing, github, integration, acl]
related:
  - architecture/research/mission-status-portal
  - architecture/research/qa-portal
  - architecture/ci-cd-pipeline
  - adr/0006-direct-render-default-projection-deferred
---

# Ticketing report page

A feature request: render a report of a repository's tickets from its tracker, so
the docsite also serves as a ticketing portal. It joins the
[mission status](./mission-status-portal.md) and [QA](./qa-portal.md) ideas under
the shared theme of doc-kitty as a repository portal. Captured at FR level; it
would become a `plans/features/` spec and an ADR when scheduled.

## Approach

An **adaptor (anti-corruption) layer**. doc-kitty defines one consistent internal
ticket model. Each supported tracker has an **inbound mapper** that converts its
schema into that model. Rendering and the internal model never depend on a
tracker's shape; adding a tracker means adding a mapper, nothing else.

At build time, the selected adaptor pulls a **delta from a configured scope**,
normalizes it through the mapper, and stores the result in a cache. The page
renders from the cache and links out to the external system for the live view.

## Scope

- **GitHub first** — one adaptor over the GitHub API (issues to start; pull
  requests and Projects are later questions).
- Other trackers (Jira, GitLab, Bitbucket, Linear) are future adaptors against the
  same internal model.

## Timing

Build-time fetch, cache, and link. Not a live sync. The page is a snapshot stamped
"as of <commit/build>", with each ticket linking to its source of truth in the
tracker. This matches the snapshot posture of the status and QA portals.

## Internal model (sketch)

A tracker-neutral ticket: `id`, `source`, `url`, `title`, `state`, `labels`,
`assignees`, `milestone`, `created`, `updated`, and `closed`. The report groups by
state, label, or milestone and links each row to the external ticket. The mapper's
job is to fill this model from the tracker's payload.

## Opt-in configuration

Off by default. A site enables and configures it in its main config: the tracker,
the scope (repository, and filters such as label, milestone, or state), and where
the token comes from. Like the other portals, the surface is config-gated.

## Fit

Reuses the anti-corruption-layer paradigm from the charter's doctrine baseline, and
the build-time-and-link posture the other portals already take. The internal model
could feed the agent-API as machine-readable ticket status, and the report is a
candidate `kind` with a per-kind layout.

## Open items

- **Auth and secrets** — private repos and higher rate limits need a token
  (`GITHUB_TOKEN` or a PAT) supplied at build in CI, never committed. On a public
  deploy the rendered data is world-readable, so the scope must exclude anything
  sensitive; the token is build-only and must not leak into output.
- **Rate limits and delta** — fetch incrementally (an `updated` watermark since the
  last run) to stay within API limits.
- **Cache location** — a committed cache is reproducible and offline but churns the
  repo; a build artifact is clean but needs persistence across builds (the same
  problem the nightly smoke marker has). Decide per the CI design.
- **Entities** — issues first; whether pull requests and GitHub Projects are in
  scope.
- **Config schema** — how the tracker, scope, filters, and token source are
  expressed in the site config.
- **Adaptor contract** — pin the internal model and the inbound-mapper interface so
  a new tracker is a self-contained addition.
