# Contract: `regenerate` job render setup

**Mission**: a11y-baseline-plantuml-service-01M3M00V · **Issue**: #106
**Surface**: `.github/workflows/update-a11y-baselines.yml`, `regenerate` job.

The `regenerate` job runs **inside** the pinned
`mcr.microsoft.com/playwright:v1.62.1-noble` container and builds the example with an
auto-detected BUILD render mode. To render the PlantUML demonstrator at build time it
MUST provide a render server reached over the container network. This contract is the
invariant the guard test (`src/tests/regen-workflow-render-setup.test.ts`, FR-005)
enforces.

## Invariants

1. **Service present** — the job declares a `plantuml` service using image
   `plantuml/plantuml-server:jetty` (self-hosted; never `plantuml.com`, C-001).
2. **Deterministic BUILD render** — `env.DK_DIAGRAM_BUILD_RENDER: 'on'` (do not rely
   on Chromium auto-detect).
3. **By-name networking (load-bearing)** — `env.DK_PLANTUML_SERVER_URL` is exactly
   `http://plantuml:8080/svg/`. The render URL MUST NOT contain `localhost`: from
   inside the job container the service is reachable by its network name on port
   8080, not on a mapped host port. No host `ports:` mapping is declared or relied on.
4. **Readiness before build** — a wait-for-server step (`shell: bash`, polling
   `http://plantuml:8080/`) runs BEFORE the "Build example site" step, so the first
   PlantUML render never races an unready jetty server.
5. **@beoe cache parity** — a `@beoe` render-cache restore step reuses the exact
   pinned `actions/cache` SHA and the same `path`/`key`/`restore-keys` as `ci.yml`'s
   `build-example`, with `env.DK_BEOE_CACHE_DIR` set (FR-004; optimization).

## Non-goals / confinement

- `ci.yml` and its `build-example` job are byte-unchanged (NFR-003).
- No npm dependency added; `pnpm-lock.yaml` unchanged (NFR-004).
- The existing `regenerate` steps (trust-workspace, corepack, frozen install,
  `--update-snapshots`, detect/commit/push, github-script PR-open, no-op report, and
  the `GITHUB_TOKEN` no-recursion note) are preserved (C-002).

## Verification

- **Static guard** (unit CI, `code-quality` lane): the guard asserts invariants 1–4
  against the workflow text — RED against the pre-fix file, GREEN after, and RED on a
  `localhost`-form URL (proven by mutation).
- **End-to-end** (out of unit-CI scope): dispatch **Update a11y baselines** against a
  branch whose example includes the PlantUML page; the "Regenerate visual baselines"
  step passes and the run reaches the detect/commit/PR steps. Reproducible offline in
  the pinned container with a networked `plantuml/plantuml-server:jetty`.
