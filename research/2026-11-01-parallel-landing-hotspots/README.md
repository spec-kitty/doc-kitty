# Parallel landing hotspots: research note (2026-11-01)

Read-only research before three changes that let several sessions land PRs at
once without each merge putting the other open PRs into conflict. The remedy is
the one spec-kitty/spec-kitty is adopting: per-PR changelog fragments, no
hand-edited shared index files, and merge-queue readiness. The process decision
is recorded in ADR-0072.

## Evidence

The hottest files on `main` in the last 14 days (orchestrator count) and in the
50 commits this shallow clone holds:

| File | 14 days | 50 commits | Class |
|------|--------:|-----------:|-------|
| `CHANGELOG.md` | 41 | 14 | Shared list every PR appends to |
| `docs/guides/consumer-setup.md` | 28 | 12 | Organic content, not a hotspot to fix |
| `docs/adr/README.md` | 21 | 11 | Generated table, committed by hand |
| `src/lib/config.ts` | n/a | 8 | Code (option registry), organic |
| `tests/a11y/routes.ts` | n/a | 3 | Hand-kept list, not hot |

`docs/changelog/README.md` is a hand-kept, curated list (14 of 36 entries), but
it did not change in the window.

## Changelog

- `CHANGELOG.md` is Keep a Changelog: `## [Unreleased]`, then
  `## [x.y.z] — YYYY-MM-DD` sections with `### Added`, `Changed`, `Fixed`,
  `Security`, `💥 Breaking`, `Documentation`, `Known limitations`. Entries are
  bullets with a bold lead that carries the issue number.
- The link references at the bottom are stale: there is no `[0.5.0]` link, and
  `[Unreleased]` still compares from `v0.4.0`.
- Readers of the file:
  - `example/src/changelog-loader.ts` renders it on the example site's
    `changelog/releases` page, including `[Unreleased]`.
  - `src/scripts/assert-changelog-page.mjs` (`pnpm assert:changelog`, CI
    `build-example` lane) fails on any `## ` heading other than `[Unreleased]`
    or `[x.y.z]`, and on a release missing from the built page.
  - `.github/workflows/release.yml` fails when `## [<version>]` is missing.
- `docs/changelog/<date>-<slug>.md` files are themed write-ups (full doc
  frontmatter, several PRs each, validated as docs). They are not one-to-one
  with CHANGELOG entries, and no `[Unreleased]` entry has one.
- Guidance: `docs/ops/releasing.md` step 3 says to move `[Unreleased]` by hand.
  Mission task files under `kitty-specs/` tell implementers to add a root
  `CHANGELOG.md` entry. There is no CONTRIBUTING file or PR template.
- Path filters: root `*.md` is `repo_docs` (doc-sanity lane); a new top-level
  folder matches no group and would run no lane.

## ADR index

- `src/scripts/generate-adr-index.mjs` rewrites the first `|` table in
  `docs/adr/README.md`; `--check` (`pnpm validate:adr-index`) fails CI when
  the table is stale. So every ADR-adding PR edits the same table rows.
- This repo's own `docs/` tree is validated, not rendered. On a rendered site
  the `kind: Hub` page derives ADR cards at build time (`Hub.astro`), and
  `example/docs/adr/README.md` carries no table. The committed table exists only
  for reading on GitHub.
- ADR numbers are picked by hand (next is 0072), so two parallel PRs can take
  the same number. Nothing checks for a duplicate number today.
- Workflows: none pushes to `main`. `update-a11y-baselines.yml` is the only
  job that commits; it pushes a `ci/...` branch and opens a PR as
  `github-actions[bot]`, which is the pattern a regeneration bot can reuse.
  Branch protection on `main` could not be read from this session.

## Merge queue

- The only required check is the `ci-ok` job in `ci.yml` (on `pull_request`
  and `push` to `main`). There is no `merge_group` trigger anywhere, so a
  queue would wait forever for `ci-ok`.
- `detect-changes` uses `dorny/paths-filter` v4.0.3. Its source handles
  `merge_group` natively: it diffs `merge_group.base_sha..head_sha` with git.
- No expression reads `github.event.pull_request.*`, `head_ref` or
  `base_ref`. Concurrency is `ci-${{ github.ref }}`, unique per queue entry.
- No label guards exist. The workflow-parsing tests are
  `draft-publication-workflows`, `plantuml-service-hardening` and
  `regen-workflow-render-setup` (Vitest, `fast`), plus
  `.github/scripts/*.test.mjs` (node:test, not run in CI).
- `consumption-test.yml` is not required and uses `paths:`, which
  `merge_group` does not support; it stays out of the queue.
- A full CI run takes 8 to 10 minutes. `main` has linear history (rebase
  merges, several commits per PR).

## Recommendations

1. Fragments in a root `changelog.d/` folder, one file per PR, named
   `<issue>-<slug>.md`, with a one-line frontmatter `section:` and the bullet as
   the body. Assembled into a version section by `src/scripts/changelog.mjs`
   at release time; the example site renders pending fragments as
   `[Unreleased]`. Keep `docs/changelog/` for themed write-ups.
2. Drop the per-PR `validate:adr-index --check` gate and regenerate the table
   after merge with a bot PR (or a direct push if `main` allows the bot). Add a
   duplicate-number check, which a merge queue then catches across PRs.
3. Add `merge_group:` to `ci.yml`, a `pr:pause-ci` label guard that keeps
   `ci-ok` red, and run the `.github/scripts` tests in CI.

## Operator ruling

The operator chose `docs/changelog/unreleased/` for the fragments, to match
spec-kitty/spec-kitty, and excluded that folder from every docs gate
(frontmatter, links, markdownlint, Vale) and from any index. Recommendations 2
and 3 were accepted as written, with no branch-protection bypass for the bot.

