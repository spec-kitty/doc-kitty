# Phase 0 Research: Regen workflow PlantUML service

## Decision 1 — Mirror `build-example`, adapted for container networking

- **Decision**: Copy `ci.yml` `build-example`'s render setup into the `regenerate`
  job, but address the PlantUML service by its **network name** on its own port
  (`http://plantuml:8080/svg/`), not a mapped `localhost` port.
- **Rationale**: `build-example` runs directly on the runner, so a mapped service
  port is a `localhost` port. The `regenerate` job runs **inside** the pinned
  Playwright container; GitHub attaches service containers to the same user-defined
  Docker network and they are reachable by the service label as hostname on the
  container's own port. A `localhost` URL from inside the job container would not
  reach the service. This is the single most important correctness fact of the fix
  and is called out in the issue.
- **Alternatives considered**: (a) map `ports: 8091:8080` and keep the `localhost`
  URL — rejected: host-port mapping does not make the service reachable at
  `localhost` from another container; (b) move the build out of the container onto
  the runner like `build-example` — rejected: the baselines MUST be regenerated
  inside the pinned image or they differ by host/font rendering (the whole reason the
  job is containerized).

## Decision 2 — Full parity including the `@beoe` Mermaid render cache

- **Decision**: Add the `@beoe` render-cache restore step and `DK_BEOE_CACHE_DIR`,
  keyed exactly as in `build-example` (operator decision DM-01M3M023898J8E1ZTEDAN71JSK).
- **Rationale**: Keeps the regenerate build behavior identical to the CI build (same
  render inputs → same rendered SVGs → baselines that match the a11y lane), and skips
  a Chromium relaunch for unchanged Mermaid diagrams. FR-004 flags it `no-op passable:
  yes` — it is an optimization, not load-bearing for the #106 failure.
- **Alternatives considered**: minimal-correct (skip the cache) — declined by the
  operator in favor of full parity.

## Decision 3 — Deterministic BUILD render, not auto-detect

- **Decision**: Set `DK_DIAGRAM_BUILD_RENDER: 'on'` explicitly.
- **Rationale**: `build-example` does the same ("don't rely on Chromium
  auto-detect"). It makes the render mode a declared property of the job rather than
  an incidental consequence of Chromium being baked into the image, which is exactly
  the implicit behavior that produced #106.

## Supply-chain posture (planning)

- **No package dependency change.** No entry in `package.json`/`pnpm-lock.yaml` is
  added, upgraded, or removed. `DIRECTIVE_051` deny-by-default install discipline is
  unaffected (`pnpm install --frozen-lockfile` step is unchanged).
- **Service image**: `plantuml/plantuml-server:jetty` — already used by `ci.yml`
  `build-example`; not a new trust decision. Self-hosted, never `plantuml.com`
  (C-001).
- **Action pin**: the only newly-referenced action is `actions/cache`, pinned to the
  same commit SHA `ci.yml` already trusts (`5a3ec84…`, v4.2.3). No unpinned or
  floating tag is introduced. The job container image tag is unchanged.
- **Adversarial evidence**: no security-impacting dependency decision is made, so no
  contested-finding ledger is required here. The container-networking correctness
  risk is carried as an Open Item and will be verified by the brownfield scout and
  the pre-PR correctness squad.

## Open items for the brownfield scout (verify before implement)

1. **Health-check tool in the pinned image**: `build-example` uses `curl -sf` to wait
   for jetty. Confirm `curl` exists in `mcr.microsoft.com/playwright:v1.62.1-noble`;
   if not, use a Node `fetch` probe (Node is guaranteed present). Reproduce offline
   via local Docker (the image is already pulled — used for the #105 manual regen).
2. **Guard-test home + harness**: find how the repo asserts on workflow/config files
   today (existing Vitest tests over `.github/**`, a YAML parser already in devDeps,
   naming/location convention). Add the guard there, in the same commit as the YAML.
3. **`actions/cache` in a container**: confirm it works from inside the job container
   on a hosted runner (it does on GitHub-hosted runners) and that `DK_BEOE_CACHE_DIR`
   under `github.workspace` is writable by the container user (the file already marks
   the workspace safe.directory for git).
4. **Exact `build-example` block to mirror**: `.github/workflows/ci.yml` service +
   env + wait + cache steps — copy structure, translate `localhost:8091` →
   `plantuml:8080` and drop the host `ports:` mapping.

## Brownfield verification (resolved before implement)

1. **`curl` in the pinned image**: RESOLVED — `docker run --rm
   mcr.microsoft.com/playwright:v1.62.1-noble` has `/usr/bin/curl` (8.5.0) and Node
   v24. The wait step uses `curl -sf` exactly like `build-example`; no Node-probe
   fallback needed.
2. **Guard-test home + path resolution**: RESOLVED — unit tests live in `src/tests/`
   (`vitest run` in the `@spec-kitty/doc-toolkit` package at `src/`); `pnpm --filter
   … test` runs with cwd = `src/`. Existing tests use `path.resolve(process.cwd(), …)`.
   The guard resolves the workflow via `import.meta.url` (cwd-independent): from
   `src/tests/` walk to repo root, then `.github/workflows/update-a11y-baselines.yml`.
   Text assertions only — no YAML parser dependency (none in devDeps).
3. **`actions/cache` in a container / `DK_BEOE_CACHE_DIR`**: RESOLVED (low risk) —
   `actions/cache` works from inside a job container on GitHub-hosted runners;
   `DK_BEOE_CACHE_DIR` under `${{ github.workspace }}` is writable (the job already
   marks the workspace a git safe.directory). Reuse the exact pinned SHA from `ci.yml`.
4. **Exact block to mirror**: RESOLVED — `.github/workflows/ci.yml` `build-example`:
   `services.plantuml` (image `plantuml/plantuml-server:jetty`, `ports: 8091:8080`),
   job `env` (`DK_DIAGRAM_BUILD_RENDER: 'on'`, `DK_PLANTUML_SERVER_URL:
   http://localhost:8091/svg/`, `DK_BEOE_CACHE_DIR: ${{ github.workspace }}/.beoe-cache`),
   "Restore @beoe diagram render cache" (`actions/cache@5a3ec84…` v4.2.3), and "Wait
   for the PlantUML server" (30×2s `curl -sf` loop). Container translation: URL →
   `http://plantuml:8080/svg/`, wait polls `http://plantuml:8080/`, **no** host
   `ports:` mapping.

## Not applicable

- **data-model.md / contracts/**: no data model or API surface — this is a CI-config
  change plus a static guard test. Intentionally omitted.
