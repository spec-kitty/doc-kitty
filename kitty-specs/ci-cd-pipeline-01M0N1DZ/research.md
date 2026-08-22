# Phase 0 Research — Path-Scoped CI/CD Pipeline

The engineering decisions are settled by [ADR-0007](../../docs/adr/0007-ci-cd-path-scoped-lanes.md)
and the [design doc](../../docs/architecture/ci-cd-pipeline.md); this file records
the confirmatory rationale and the mandatory supply-chain evidence for the new
tooling. No decision here re-opens the ADR.

## Decisions

### D-01 — Change classifier: `dorny/paths-filter` with constructed first-match

- **Decision**: Use `dorny/paths-filter` in a `detect-changes` job to emit per-group
  booleans, and derive first-match precedence (workflows → code → example_content →
  repo_docs → ignored) in the boolean logic, because the action itself is multi-match.
- **Rationale**: named in the design; no build needed; runs once and feeds `if:`
  guards. First-match must be constructed because a single file can match several
  filters (e.g. `example/astro.config.mjs` matches both a `code` glob and a naive
  `example/**`); the higher-precedence group wins.
- **Alternatives considered**: separate path-triggered workflows per lane (rejected
  by ADR-0007 — skipped required checks block merges); GitHub-native `paths:`
  filters (rejected — no single aggregate status, and trigger-level filtering causes
  the ignored-only deadlock).

### D-02 — Single required check: always-run `detect-changes` + `ci-ok`

- **Decision**: Lanes skip at the job level via `if:` on booleans; `detect-changes`
  and `ci-ok` always run. `ci-ok` uses `if: always()`, `needs:` all four upstream
  jobs, and fails if any need's result is `failure`/`cancelled` **or** if
  `detect-changes` did not succeed. A skipped need is a pass.
- **Rationale**: reconciles "ignored-only PR runs no heavy lane" with "ci-ok is the
  sole required check" — the required check always reports, so it is never stuck
  pending; and closes the `always()` false-green when the classifier fails.
- **Alternatives considered**: `paths-ignore` at the trigger (rejected — required
  check never posts → merge blocked forever); ci-ok needing only the three lanes
  (rejected — detect-changes failure reads as all-skip → false green).

### D-03 — doc-sanity toolchain: extend validator + markdownlint-cli2 + Vale(`error`)

- **Decision**: Extend `validate-frontmatter.mjs` to cover `docs/` and
  `example/docs/`; add internal link/`related` resolution; `markdownlint-cli2` with a
  shared `.markdownlint.jsonc`; Vale gated at `error` with a minimal starter style.
- **Rationale**: build-free, fail-fast (cheap → thorough) per design §"Doc sanity
  checks"; Vale starts minimal to avoid noise, expands over time.
- **Alternatives considered**: remark-lint (rejected — markdownlint is the design's
  choice); prose gate at `warning` (rejected — design pins `error`).

### D-04 — build-integration: Node assertion script over `example/dist/`

- **Decision**: A `assert-build-artifacts.mjs` script asserts existence + shape/count
  of sitemap, RSS, `llms.txt`, agent index JSON, README-as-index routing, and one
  rendered page against **today's** example output.
- **Rationale**: design §"Test taxonomy" — "a small Node assertion script over
  `dist/` suffices at first; graduate to Playwright when interactive components land"
  (M2). Pins the FR-011 shape+count that an earlier draft dropped.
- **Alternatives considered**: Playwright now (rejected — deferred to M2, C-009).

### D-05 — Deploy shares the build definition with build-example

- **Decision**: Author the `astro build` step once (composite action or a documented
  shared job/step) and consume it in both build-example and deploy; a push-triggered
  deploy re-runs that shared *definition* (it cannot reuse a PR run's artifact).
- **Rationale**: design §"Deployment" — "shares the build step with build-example",
  so what is gated equals what is published.
- **Alternatives considered**: independent build in deploy (rejected — silent
  divergence from the settled design; would need a new ADR).

### D-06 — Nightly gate: git-ref marker + Deployments API (newest successful)

- **Decision**: Read the live deployment SHA from the GitHub Deployments API
  (`environment=github-pages`, newest **successful/active**), compare to a
  `smoke/last-run` git ref, exit early if equal, else run and update the ref
  (`contents: write`, `[skip ci]`-style so the marker write does not retrigger).
- **Rationale**: design §"Trigger & the deployed-since-last-run gate"; git ref is
  durable (cache eviction only causes a harmless extra run). Filtering to a
  successful deployment avoids smoke-testing a pending/failed deploy.
- **Alternatives considered**: `actions/cache` marker (acceptable fallback, less
  durable — ADR leans git-ref); comparing against `main` HEAD (rejected — HEAD may
  differ from what is actually deployed).

### D-07 — Nightly suite: lychee + Lighthouse CI (thresholds)

- **Decision**: `lychee` for broken links (internal + external), Lighthouse CI for
  SEO + an accessibility subset + rendering integrity (console errors / failed
  requests via best-practices audits), each with a configured minimum-score /
  pass threshold in `lighthouserc.json`. Perf/Core-Web-Vitals is **not** an M0 gate.
- **Rationale**: mission brief's locked M0 nightly = lychee + Lighthouse; Playwright
  click-through/visual/deep-a11y deferred to M2 (C-009).
- **Alternatives considered**: axe-core/Playwright now (rejected — M2).

## Supply-chain evidence (DIRECTIVE_051)

Applies because the plan adds dependencies. Advisory in v1 — recorded, not gated.

| Control | Finding |
|---|---|
| Registry authenticity | npm packages (`markdownlint-cli2`, `@lhci/cli`) from the official npm registry; actions from GitHub Marketplace canonical repos (`dorny/paths-filter`, `lycheeverse/lychee-action`, `treosh/lighthouse-ci-action`, `actions/*`). |
| Package freshness | Pin actions to a commit SHA (or vetted major tag); avoid `@master`/`@main`. npm dev-deps pinned via the committed `pnpm-lock.yaml`. Surface first/last publish at add time. |
| Lifecycle scripts | None of the added packages require `preinstall`/`install`/`postinstall`. Deny-by-default stands; if any transitive script appears, it must be explicitly justified. |
| Node Active LTS | Node 22 is the Active LTS line — matches the CI floor; no skew. |
| Incident/IoC posture | No known-incident packages in scope; treat CAS/vendor incident feeds as authority if a version is flagged at implementation time. |

### Adversarial evidence disposition

Post-spec adversarial squad ran (see [reviews/post-spec-squad.md](./reviews/post-spec-squad.md)).
All contested findings were **changed** (folded into the spec) — none deferred, none
dropped. The dependency additions here are low-risk (lint/link/audit tooling, no
runtime code, no lifecycle scripts); no separate dependency-focused squad was run —
recorded as `deferred_with_rationale`: the supply-chain surface is dev-tooling only
and SHA-pinned, revisited if a flagged version surfaces during implementation.
