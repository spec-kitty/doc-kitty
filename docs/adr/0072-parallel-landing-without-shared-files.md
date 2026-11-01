---
title: "ADR-0072: Land PRs in parallel without shared hand-edited files"
description: Changelog entries become per-PR fragment files, the ADR index table is regenerated after merge instead of in each PR, and CI is ready for a merge queue.
doc_status: active
updated: 2026-11-01T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0007-ci-cd-path-scoped-lanes
  - adr/0032-adr-index-generation
  - ops/releasing
---

# ADR-0072: Land PRs in parallel without shared hand-edited files

## Status

Accepted

## Context

Several cloud sessions now open PRs against `main` at the same time. Each merge
put every other open PR into conflict, because almost every PR edits the same
few lines. Over the 14 days to 2026-11-01:

- `CHANGELOG.md` was touched by 41 commits. Every PR adds a bullet to the one
  `## [Unreleased]` section, usually at the top of the same subsection.
- `docs/adr/README.md` was touched by 21. Every PR that adds an ADR also adds a
  row to its table, because CI runs `generate-adr-index.mjs --check` and fails a
  stale table ([ADR-0032](./0032-adr-index-generation.md)). Two parallel PRs
  also pick the same next ADR number by hand.
- `docs/guides/consumer-setup.md` was touched by 28. That is organic churn in a
  long guide, and is not changed here.

A merge queue would test each PR on top of the PRs ahead of it, but it does not
remove conflicts in shared lines, and CI does not run on the `merge_group`
event yet, so a queue would wait forever for `ci-ok`.

spec-kitty/spec-kitty is adopting the same three remedies. The research is in
`research/2026-11-01-parallel-landing-hotspots/`.

## Decision

1. **Changelog entries are fragments.** A PR adds one file,
   `docs/changelog/unreleased/<issue>-<slug>.md`, with a `section:` frontmatter key
   (`Breaking`, `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`,
   `Documentation`) and the entry as its body. `## [Unreleased]` in
   `CHANGELOG.md` holds only a note. The folder sits next to the themed
   write-ups, as in spec-kitty/spec-kitty, but holds entries, not pages: the
   frontmatter and link gates (`--exclude`), markdownlint and Vale all leave it
   out, and no index lists it, so a fragment touches no shared file. A
   `README.md` there explains the format and keeps the folder present between
   releases.
   - `src/scripts/changelog.mjs --check` (`pnpm validate:changelog`, in the
     doc-sanity lane) fails a bad fragment and any entry written under
     `[Unreleased]`.
   - At release, `pnpm changelog:release <x.y.z>` writes the fragments into
     `## [x.y.z] — <date>` in Keep a Changelog order, moves the compare links
     and deletes the fragments. Released history is never rewritten, so the
     published file keeps its shape and `release.yml` and
     `assert:changelog` read it as before.
   - The example site's release-history page shows the fragments as
     `[Unreleased]`, so the site still shows pending changes.
2. **The ADR index table is regenerated after merge, not in each PR.** The
   table exists only for reading this repository on GitHub: the repo's own
   `docs/` tree is not rendered, and a rendered hub derives its ADR cards at
   build time. The per-PR `validate:adr-index` gate goes. A workflow on `push`
   to `main` regenerates the table and opens or updates a single bot PR. A per-PR
   check that ADR numbers are unique replaces the hand-picked number's safety
   net; in a merge queue it runs on the combined commit, so it catches two
   queued PRs that took the same number.
3. **CI is ready for a merge queue.** `ci.yml`, which produces the only required
   check (`ci-ok`), also runs on `merge_group`. No CI expression reads
   pull-request-only context; the change classifier already diffs
   `merge_group.base_sha` to `head_sha`. A `pr:pause-ci` label on a PR skips the
   heavy lanes and keeps `ci-ok` red, never green.

Each decision ships as its own PR, in this order.

## Consequences

- Parallel PRs no longer conflict on `CHANGELOG.md` or the ADR table. A fragment
  is a new file, so two PRs never touch the same path.
- The one-time migration moved the ten `[Unreleased]` entries into fragments.
  A PR opened before it that edits `[Unreleased]` conflicts once; it moves its
  entry into a fragment.
- Fragments in `[Unreleased]` are ordered by issue number, not by merge order: within each section, numbered fragments by number, then unnumbered ones by name.
- `docs/adr/README.md` on `main` can lag a merged ADR until the bot PR lands. The
  ADR file itself is the source of truth.
- The dated pages in `docs/changelog/` keep their role: themed write-ups of a
  body of work, with a hand-kept `README.md`. Fragments sit beside them in
  `unreleased/` and are never pages.
- `validate-frontmatter` and `check-links` gain a repeatable
  `--exclude <folder>` option, for a docs tree with no site config.

## Considered and rejected

- **Reuse `docs/changelog/<date>-<slug>.md` as fragments.** Those pages carry
  full doc frontmatter, pass Vale and the link gates, and cover several PRs
  each. Making them one-per-PR would change what that section is for.
- **A root `changelog.d/` folder.** It needs no gate exclusions, but
  spec-kitty/spec-kitty keeps its fragments under `docs/changelog/unreleased/`,
  and the operator chose one layout for both repositories.
- **Generate the ADR table at build time.** This tree is never built, so there
  is no build to run it in.
- **A bot that pushes the regenerated table straight to `main`.** Branch
  protection requires `ci-ok` and a review, and a push with `GITHUB_TOKEN` does
  not trigger CI. A bypass can be granted later; the bot PR works without one.
- **Rely on a merge queue alone.** A queue serialises merges but each PR still
  has to be rebased past every shared-line edit ahead of it.

## References

- `research/2026-11-01-parallel-landing-hotspots/README.md` — the evidence.
- [ADR-0007](./0007-ci-cd-path-scoped-lanes.md) — the single
  required `ci-ok` check.
- [ADR-0032](./0032-adr-index-generation.md) — the generated ADR index.
- [Releasing](../ops/releasing.md) — the release runbook.
