# Mission Specification: Regen workflow PlantUML service

**Mission Branch**: `fix/a11y-baseline-plantuml-service`
**Created**: 2026-09-28
**Status**: Draft
**Input**: GitHub issue [#106](https://github.com/spec-kitty/doc-kitty/issues/106) — "update-a11y-baselines workflow can't regenerate baselines for PlantUML pages (no plantuml service)"

## Context

The on-demand **Update a11y baselines** workflow (`.github/workflows/update-a11y-baselines.yml`)
regenerates the committed Playwright visual baselines (`tests/a11y/__screenshots__/**`)
for a target branch, inside the pinned `mcr.microsoft.com/playwright:v1.62.1-noble`
container, and opens a PR back into that branch. Its `regenerate` job builds the
example site inline with `pnpm build`, then runs `pnpm test:a11y --update-snapshots`.

Chromium is baked into the pinned image, so the inline build auto-detects **BUILD**
diagram render mode and tries to render the example's PlantUML demonstrator fence at
build time. Unlike the `build-example` job in `ci.yml`, the `regenerate` job declares
**no `services: plantuml`** and sets no `DK_DIAGRAM_BUILD_RENDER` /
`DK_PLANTUML_SERVER_URL`, so PlantUML has no render server. The build-only PlantUML
assertion in `tests/a11y/diagram.spec.ts` ("PlantUML accessible figure — build only")
then fails in both light and dark, and the job exits non-zero **before** the
detect/commit/PR steps run — so no baselines are ever produced for any branch whose
example includes the PlantUML page.

`build-example` in `ci.yml` already solves this for the main CI lane, but it runs
**directly on the runner**, so it reaches the service on a mapped `localhost` port.
The `regenerate` job runs **inside a container**, where GitHub attaches service
containers to the same Docker network and they are reached by their **service name**
on the service's own port — never `localhost`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Regenerate baselines for a PlantUML-bearing branch (Priority: P1)

As the repository operator, I dispatch **Update a11y baselines** for a branch whose
example site includes the PlantUML demonstrator, and the job renders that page at
build time, regenerates the visual baselines, and opens the baseline PR — instead of
aborting at the "Regenerate visual baselines" step.

**Why this priority**: This is the whole defect. Today the job cannot produce
baselines for any such branch, forcing a manual local-Docker workaround (as used
while landing #105). P1: the workflow is unusable for its stated purpose on the
affected branches.

**Independent Test**: Dispatch the workflow against a branch that carries the
PlantUML page; the "Regenerate visual baselines" step passes and the run reaches the
detect/commit/PR steps. Reproducible offline by running the pinned container with a
networked `plantuml/plantuml-server:jetty` and the render env, mirroring the manual
regeneration already proven while landing #105.

**Acceptance Scenarios**:

1. **Given** a branch whose example includes the PlantUML demonstrator, **When** the
   `regenerate` job runs the inline `pnpm build`, **Then** the PlantUML fence renders
   to a static SVG at build time (the render server answers) and the build succeeds.
2. **Given** that build, **When** `pnpm test:a11y --update-snapshots` runs, **Then**
   the "PlantUML accessible figure — build only" assertion passes in both light and
   dark and the job proceeds to the detect/commit/PR steps.
3. **Given** the container-networked service, **When** the build resolves
   `DK_PLANTUML_SERVER_URL`, **Then** the URL targets the service **by name**
   (`http://plantuml:8080/svg/`), not `localhost`.

---

### User Story 2 - The render setup is guarded against silent regression (Priority: P2)

As a maintainer, I want a check that fails if the `regenerate` job ever loses its
PlantUML render setup again, so this exact gap (a build-mode job with no render
server) cannot silently reappear.

**Why this priority**: The bug is a config omission that produced a green-looking
file for months. A guard turns "someone deletes the service block" into a red gate
rather than a rediscovered outage. P2: prevents recurrence but is not itself the
user-facing fix.

**Independent Test**: A test parses `update-a11y-baselines.yml` and asserts the
render setup is present and container-correct; it is RED against the pre-fix file and
GREEN after.

**Acceptance Scenarios**:

1. **Given** the pre-fix workflow (no `services.plantuml`, no render env), **When**
   the guard runs, **Then** it fails.
2. **Given** the fixed workflow, **When** the guard runs, **Then** it passes, and it
   also fails if the URL is set to a `localhost` form (the container-networking
   invariant is asserted, not just presence).

### Edge Cases

- **Server slow to accept connections**: jetty maps/starts a beat after the service
  container is created. A wait-for-ready step must gate `pnpm build` so the first
  PlantUML render never races an unready server (a failed render fails the build
  loudly, per #13 WP03).
- **`localhost` regression**: reaching the service on `localhost:<port>` from inside
  the job container silently fails to connect; the URL must use the service name.
- **No baseline changes**: the existing no-op path (report "already current", open no
  PR) must still hold once the build succeeds.
- **A real axe violation**: `--update-snapshots` rewrites visual bytes but a genuine
  axe violation must still fail the job — the fix must not mask that.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | PlantUML render server in the regenerate job | As the operator, I want a `plantuml/plantuml-server:jetty` service attached to the `regenerate` job so the containerized build can render PlantUML at build time. | High | Open | [build] | no — RED without the service block |
| FR-002 | Deterministic BUILD render pointed at the service by name | As the operator, I want `DK_DIAGRAM_BUILD_RENDER=on` and `DK_PLANTUML_SERVER_URL=http://plantuml:8080/svg/` on the job so the build renders deterministically and reaches the service over the container network (not `localhost`). | High | Open | [build] | no — RED without the env, and RED if `localhost` is used |
| FR-003 | Wait for the server before building | As the operator, I want a wait-for-ready step before `pnpm build` so the first PlantUML render never races an unready jetty server. | High | Open | [build] | no — removing it re-introduces the startup race |
| FR-004 | @beoe Mermaid render cache parity | As the operator, I want the job to restore and save the `@beoe` Mermaid render cache (with `DK_BEOE_CACHE_DIR`), keyed as in `build-example`, so an unchanged diagram is served from disk and skips a Chromium relaunch. | Medium | Open | [build] | yes — a caching optimization; passes without exercising a cache hit |
| FR-005 | Regression guard on the workflow's render setup | As a maintainer, I want an automated check asserting the render setup (service, env, by-name URL, wait step) so the gap cannot silently return. | Medium | Open | [ratchet] | no — RED against the pre-fix workflow |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Job reaches its output steps | For a branch whose example includes the PlantUML demonstrator, the `regenerate` job completes the "Regenerate visual baselines" step (exit 0) and proceeds to the detect/commit/PR steps — i.e. the #106 failure mode no longer occurs. | Reliability | High | Open |
| NFR-002 | Container-to-service networking | The render URL resolves the service by its network name on port 8080 (`http://plantuml:8080/svg/`); no `localhost` and no host-port mapping is relied upon for reachability from inside the job container. | Correctness | High | Open |
| NFR-003 | Change confinement | The behavioral change is confined to `.github/workflows/update-a11y-baselines.yml`; `ci.yml`/`build-example` and their pass/fail semantics are unchanged. Supporting artifacts are limited to a `[Unreleased]` changelog entry and the FR-005 guard test. | Maintainability | Medium | Open |
| NFR-004 | Supply-chain pinning | Any newly-referenced third-party action is pinned to a full commit SHA (reuse the `actions/cache` SHA already pinned in `ci.yml`); the pinned Playwright image tag is unchanged. | Security | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Self-hosted PlantUML only | The render server is the self-hosted `plantuml/plantuml-server:jetty` service; NEVER `plantuml.com` (charter C-001 / diagram build-render doctrine). | Technical | High | Open |
| C-002 | Preserve existing job behavior | The workspace-trust, corepack, frozen-lockfile install, `--update-snapshots`, detect/commit/push, and github-script PR-open steps (and the `GITHUB_TOKEN` no-recursion note) are preserved; the fix only adds the render setup. | Technical | High | Open |
| C-003 | Bash-pinned scripted steps | Any new scripted step that uses bashisms runs under `shell: bash` (the container defaults `run:` to `sh`/dash), matching the file's existing convention. | Technical | Medium | Open |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a branch whose example includes the PlantUML demonstrator, a dispatched **Update a11y baselines** run passes the "Regenerate visual baselines" step and reaches the detect/commit/PR steps (previously it exited non-zero there). — [build] · no-op passable: no
- **SC-002**: The FR-005 guard is RED against the pre-fix `update-a11y-baselines.yml` and GREEN against the fixed file, including a RED on a `localhost`-form URL. — [ratchet] · no-op passable: no
- **SC-003**: The rendered PlantUML page in the regenerated build carries a static `<svg>` figure with a non-empty accessible name (the same shape `diagram.spec.ts` asserts in build mode). — [build] · no-op passable: no
- **SC-004**: The diff's behavioral change is one workflow file; `ci.yml` is byte-unchanged. — [folded] · no-op passable: yes
