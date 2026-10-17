# Mission Specification: Gate config hardening

**Mission Branch**: `fix/gate-config-hardening`  
**Created**: 2026-10-17  
**Status**: Draft  
**Input**: Issues #172, #173 and #174 (follow-ups from the PR #171 landing), with the operator decisions recorded as Decision Moments.

## Intent Summary

- **Primary actor:** a site maintainer who runs DocKitty's build gates (`assert:artifacts`, `check-redirect-coverage`) locally or in CI.
- **Trigger:** a build that sets `vite.envDir`/`envFile`, whether in the config or in a base config the config imports, or a site that mounts the agent-API index at a custom `indexPath`.
- **Outcome:** the gates use the same env settings as the build, and a custom index path can pass the dead-link check through an explicit `--index-path`.
- **Invariant:** a gate never quietly guesses. If a config exists and cannot be evaluated, the gate fails closed with exit 2. `--env-dir` is the only way to bypass evaluation.
- **Boundary:** an `envDir` set inside an integration's `updateConfig` hook stays a documented limit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draft gates follow the evaluated config (Priority: P1)

A maintainer's `astro.config.mjs` spreads a shared base config from another file, and that file sets `vite.envDir: 'env'`. Today the gate searches only the config file's text, finds nothing, and reads the site root's `.env*`. It then expects draft routes the build never emitted, or the reverse. After this mission the gate evaluates the config and reads `env/`.

**Why this priority**: a wrong verdict from a release gate. It is fail-open, and it is silent.

**Independent Test**: build a fixture site whose imported base config sets `envDir`. Run the gate without `--env-dir`. It resolves the draft setting from that directory.

**Acceptance Scenarios**:

1. **Given** a config that imports a base setting `vite.envDir`, **When** `assert:artifacts` runs without `--env-dir`, **Then** it reads `.env*` from that directory.
2. **Given** a config that sets `vite.envFile: false`, **When** the gate runs, **Then** it reads no env files.
3. **Given** a config that throws or times out on evaluation, **When** the gate runs without `--env-dir`, **Then** it exits 2 with a message that names the config and the `--env-dir` override.
4. **Given** the same failing config, **When** the gate runs with `--env-dir <dir|false>`, **Then** it skips evaluation and uses the flag.
5. **Given** a site with no `astro.config.*`, **When** the gate runs, **Then** it behaves as it does today.
6. **Given** `check-redirect-coverage` with both `--docs` and `--env-dir`, **When** it runs, **Then** `--env-dir` decides the env files, and the config is still evaluated once for the index names, as it is today.
7. **Given** the three CI invocations that run these gates without `--docs` (`.github/workflows/ci.yml`), **When** CI runs them on the example, **Then** they evaluate `example/astro.config.mjs` and stay green with no new flags.

---

### User Story 2 - Dead-link check at a custom index path (Priority: P2)

A site mounts the agent-API index at `/v2/data/index.json`. Today `assert:artifacts` fails because it insists on `api/index.json`. After this mission the maintainer passes `--index-path /v2/data/index.json`. The gate reads that index, derives the site base, and checks that every `_links` href resolves to a built file.

**Why this priority**: an `indexPath` option exists, but its own gate rejects every value except one.

**Independent Test**: a fixture build with a custom index path passes when the flag is given. With a planted dangling href it fails.

**Acceptance Scenarios**:

1. **Given** a build with its index at `dist/v2/data/index.json`, **When** the gate runs with `--index-path` set to that path, **Then** every `_links` href is checked and the gate passes.
2. **Given** the same build with one dangling href, **When** the gate runs with the flag, **Then** it fails and names the href.
3. **Given** a default build, **When** the gate runs without the flag, **Then** it checks `api/index.json` exactly as today.
4. **Given** a flag path whose file does not exist, **When** the gate runs, **Then** it fails and names the path.
5. **Given** an index whose `self` does not end in `/<flag path>` (for example, because the flag included the site base), **When** the gate runs, **Then** it fails, and the message suggests dropping the base prefix.
6. **Given** a flag containing `..` or a filesystem-absolute path, **When** the gate runs, **Then** it exits 2.

---

### User Story 3 - The config split finishes (Priority: P3)

A contributor looking for the sitemap draft filter finds it with the other route-shaping logic. Every runtime export of `./config` stays as it is, and a test guards the export list.

**Why this priority**: internal tidiness with no user-facing change.

**Independent Test**: the export-list test passes. The sitemap tests import the filter from its new module.

**Acceptance Scenarios**:

1. **Given** the move, **When** a consumer imports `sitemapDraftFilter` from `./config`, **Then** it is the same function.
2. **Given** a change that drops or adds a runtime export of `./config`, **When** the tests run, **Then** the export-list test fails.

### Edge Cases

- A config evaluates, but sets no `vite` key: the env directory is the site root (unchanged).
- A relative `envDir` resolves against the site directory. An absolute one is used as given.
- `--env-dir false`, `envDir: false` and `envFile: false` each mean "read no env files".
- `--index-path` is a path relative to `dist/`, because `dist/` never nests the site base. One leading `/` is stripped. The site base is `new URL(self.href).pathname` minus `/<flag path>`. `self` must be an absolute URL; a relative `self` fails.
- Config evaluation timing out counts as a failed evaluation (exit 2).
- A config that branches on the build mode is evaluated without a mode. It is a documented limit (C-004).
- Config evaluation runs at most once per gate run, even when several checks need it.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Gates use the evaluated env settings | As a maintainer, I want `assert:artifacts` and `check-redirect-coverage` (without `--docs`) to take `envDir`/`envFile` from the evaluated config, including a value from an imported module, so that the gate's draft verdict matches the build. The no-`--docs` path gets the same behaviour the `--docs` path already has, with one evaluation per run through the shared cache (#173). | High | Open | [build] | no |
| FR-002 | Fail closed on an unevaluable config | As a maintainer, I want a config that exists but fails or times out on evaluation to make those gates exit 2 with a message naming the config and `--env-dir`, so that a broken evaluation is never a silent guess (#173). | High | Open | [build] | no |
| FR-003 | `--env-dir` bypasses evaluation | As a maintainer, I want `--env-dir <dir\|false>` to skip config evaluation and win, so that I keep an explicit escape hatch (#173). | High | Open | [ratchet] | yes — paired with FR-002's failing-config fixture as the same-fixture positive control |
| FR-004 | No-config behaviour unchanged | As a maintainer of a site with no `astro.config.*`, I want the gates to behave as today (#173). | Medium | Open | [ratchet] | yes — paired with FR-001's imported-envDir fixture as positive control |
| FR-005 | Retire the config-text search | As a contributor, I want the regex over the config's text, its error, the now-dead `configEvaluated` parameter and its JSDoc (`draft-publication.mjs` `resolveDraftPublicationForGate`) removed, so that there is one way the gates learn env settings (#173). | Medium | Open | [build] | no |
| FR-006 | `--index-path` for the dead-link check | As a maintainer of a site with a custom agent-API `indexPath`, I want `assert:artifacts --index-path <path>` (relative to `dist/`) to move every check that reads the agent-API index (the pinned page count, the Specification cross-check and the `_links` walk) to that path, derive the site base from the index's `self`, and check every `_links` href, so that my site can pass the gate (#172). | High | Open | [build] | no |
| FR-007 | Default index path unchanged | As a maintainer of a default site, I want the gate without the flag to keep checking `api/index.json` (#172). | Medium | Open | [ratchet] | yes — paired with FR-006's custom-path fixture |
| FR-008 | Docs drop the path rule | As a reader, I want the "must end in `/api/index.json`" rule removed from the `agent-index.ts`/`agent-page.ts` JSDoc, ADR-0058's `indexPath` bullet and `docs/guides/consumer-setup.md`, and `--index-path` documented in their place (#172). | Medium | Open | [build] | no |
| FR-009 | `sitemapDraftFilter` in its integration module | As a contributor, I want `sitemapDraftFilter` to live in `src/lib/integrations/route-shaping.ts`, re-exported from `./config`. It and the helpers it needs come from `draft-publication` or `route-shaping`, never `../config`, so the re-export creates no import cycle (#174). | Low | Open | [build] | no |
| FR-010 | Pin the `./config` export list | As a maintainer, I want a test that fails when a runtime export of `./config` is added or dropped, so that moves like FR-009 cannot change the public surface by accident (#174). | Low | Open | [build] | no |
| FR-011 | Record the decision | As a reader, I want ADR-0058 amended (the gates evaluate the config; the remaining limits are `updateConfig` and mode-branching configs; the text-search failure and the imported-module limit are dropped) and a CHANGELOG `[Unreleased]` entry for the user-facing changes (#172, #173). | Medium | Open | [build] | no |
| FR-012 | One config per gate run | As a maintainer, I want both gates to evaluate the `astro.config.*` in the resolved site root, with `--astro-config` overriding it on both. When `check-redirect-coverage` gets both `--docs` and `--site-root` and they point at different sites, it exits 2 (#173). | Medium | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Evaluation cost | Config evaluation runs at most once per gate run. On the example site with a warm install, the median of 3 runs adds no more than 2 seconds compared with the same gate run with `--env-dir`. | Performance | Medium | Open |
| NFR-002 | Byte-identical site | Build the example on `main` and on the branch, then run `diff -r` on the two `dist/` trees: 0 differences. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | One evaluator | Reuse the config evaluator `check-links` already uses (the child-process Vite `runnerImport` in `site-index-names.mjs`), extracted to one shared owner. Add no new dependency. | Technical | High | Open |
| C-002 | Public surface | Every runtime export of `./config` and every `package.json` export stays unchanged. | Technical | High | Open |
| C-003 | Test economy | Follow DIRECTIVE_041: strengthen existing tests rather than add files, delete the tests of the retired text-search error, and add at most one focused test per change. | Process | High | Open |
| C-004 | Documented limits | Two cases are not supported and are documented in ADR-0058: an `envDir` set inside an integration's `updateConfig` hook, and a config that branches on the build mode, which is evaluated without one. | Technical | Medium | Open |
| C-005 | No build needed to evaluate | Config evaluation needs only the workspace install. It never needs a built `dist` or network access. | Technical | High | Open |

### Key Entities

- **Evaluated site config**: the Astro config module's default export, after its imports are resolved. The gates read only `vite.envDir` and `vite.envFile` from it.
- **Agent-API index**: the JSON file the agent index route emits. The gate starts its `_links` walk there and derives the site base from its `self` link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A site whose imported base config sets `envDir` gets the correct draft verdict from both gates, with no flag needed. — [build] · no-op passable: no
- **SC-002**: A config that fails to evaluate stops both gates with exit 2 in 100% of runs without `--env-dir`. — [build] · no-op passable: no
- **SC-003**: A site with a custom index path passes the dead-link check with one flag, and fails it when one href is dangling. — [build] · no-op passable: no
- **SC-004**: Running `diff -r` on the example `dist/` built on `main` and on the branch shows 0 differences. — [ratchet] · no-op passable: yes — paired with SC-001/SC-003's fixtures, which change behaviour
