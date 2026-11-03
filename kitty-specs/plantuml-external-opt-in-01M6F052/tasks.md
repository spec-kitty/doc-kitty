# Work Packages: PlantUML external-connection opt-in (#268)

**Mission**: `plantuml-external-opt-in-01M6F052` · **Branch**: `feat/268-plantuml-external-opt-in` (planning base and final merge target)
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md) (Implementation Concern Map IC-01..IC-11, requirement → test table), [research.md](./research.md) (R1–R13), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md), [squad/post-spec.md](./squad/post-spec.md), [squad/post-plan.md](./squad/post-plan.md).
**Planner**: planner-priti (profile loaded with `spec-kitty agent profile show planner-priti`).

Revised after the post-tasks squad and the CI spike (WP01 verdict **GO**, evidence in commit 2eefef7; findings F1–F5, decisions D5 `01M6F4BRKQ4E9H9Z41BYZH37MC` and D6 `01M6F4BVDASAREW2NVH23727CW`); dispositions in [squad/post-tasks.md](./squad/post-tasks.md). Revised after `/spec-kitty.analyze` (A1–A19, report `analysis-report.md`) and decision D7 `01M6F4XFDPJ6XFBYM5HM65G1AM` (unset mode with `--service-container` requires `SANDBOX`; pass output unchanged).

Tests are required by this spec (FR-011, the plan's requirement → test table, the half-removal table, the unset-mode goldens and the strict fake `docker`). Every code WP is test-first.

## Concern → work package translation

| Concern | Work package | Note |
|---|---|---|
| IC-01 CI feasibility spike | WP01 | **Orchestrator-run** (push, `gh`, real runner); `push` trigger on a throwaway branch; fallback returns to the operator |
| IC-02 Unset-mode characterization | WP02 | Goldens captured from today's code, in their own commit, before WP05 touches the guard |
| IC-03 Shared resolver | WP03 | |
| IC-04 Build integration | WP04 | |
| IC-05 Canary redesign | WP05 | Depends on WP02 (goldens first) |
| IC-06 Declared-mode verification and CLI | WP06 + WP11 | Split: WP06 pure classifier / verdict / messages (not gated on WP01); WP11 CLI, flags, docker reader (gated on WP01). Both opus |
| IC-07 Command-level matrix tests | WP07 + WP12 | Split: WP07 9-cell matrix; WP12 half-removal, edge cases, NFR-001, mutation record. Separate files; separate from parity (IC-11) |
| IC-08 Real allowlist CI lane + IC-09 Workflow services test | WP08 | Merged: the inventory test is the lane's structural guard and touches no other surface |
| IC-10 Documentation and records | WP10 | ADR-0074, guide subsection, diagrams.md, changelog fragment, lane lists, prose tests |
| IC-11 Resolution parity (NFR-003) | WP09 | Separate from the matrix (IC-07) |

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Create the throwaway spike branch and a `push`-triggered spike workflow | WP01 | no |
| T002 | Prove `--add-host dk-canary:host-gateway` reachability and allowed-fetch / denied-refuse under ALLOWLIST | WP01 | no |
| T003 | Probe redirect handling, `!import` / `!includesub`, entry trimming and trailing `;` | WP01 | [P] with T004 |
| T004 | Capture a real `docker inspect .Config.Env` output and the lane wall time | WP01 | [P] with T003 |
| T005 | Write the spike addendum in research.md and decide go / fallback (a) / return to operator | WP01 | no |
| T006 | Delete the throwaway branch and record its last run URL | WP01 | no |
| T007 | Strict fake `docker` executable (exact argv only: `inspect` and `exec … curl`) | WP02 | [P] with T008 |
| T008 | Shared CLI test harness: fake PlantUML server with a fetch policy, free ports, CLI spawn, port normalization | WP02 | [P] with T007 |
| T009 | Capture today's unset-mode stdout / stderr / exit for five pass and fail cases | WP02 | no |
| T010 | Golden test asserting byte identity (ports normalized only) | WP02 | no |
| T011 | Fake-docker self-test (strict argv rejection, deterministic stderr) | WP02 | [P] with T010 |
| T012 | `src/lib/plantuml-external.mjs` skeleton: constants, `PlantumlAllowExternalError`, message shape | WP03 | no |
| T013 | `parseAllowExternalEnv` and `validateAllowExternal` (edge cases 1–4 and 9) | WP03 | no |
| T014 | `resolvePlantumlAllowExternal` precedence (edge cases 5–6) | WP03 | no |
| T015 | `describeDeclared` (the one line shared by build notice and check) | WP03 | no |
| T016 | `plantuml-external-setting.test.ts`: resolution table, rejection table, no-imports assertion | WP03 | [P] (write first) |
| T017 | `DocKittyOptions.plantumlAllowExternal` type and JSDoc | WP04 | no |
| T018 | Eager resolution and always-published `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` handoff | WP04 | no |
| T019 | FR-003 build notice (`[dk-plantuml]`, full verify command, diagrams-off suffix) | WP04 | no |
| T020 | `site-config-eval.mjs` returns `plantumlAllowExternal` (resolution or `null`), deletes inherited handoff | WP04 | [P] with T019 |
| T021 | `plantuml-allow-external-config.test.ts`: build-side unit tests | WP04 | [P] (write first) |
| T022 | Exported `startCanary({ port })`: allowed / denied / redirect paths, markers, request log, busy-port error | WP05 | no |
| T023 | Retarget unset fixtures to `/dk-canary/allowed/include/<fixture>`, keep `/reachability`, accept `canaryPort` | WP05 | no |
| T024 | `plantuml-canary.test.ts`: canary unit tests | WP05 | [P] (write first) |
| T025 | Prove goldens and `plantuml-include-guard.test.ts` pass unmodified | WP05 | no |
| T026 | `plantuml-mode-check.mjs` pure functions: `canaryEntry`, `classifyObserved`, `compareAllowlist`, `parseContainerEnv`, `systemPropertyConfig` | WP06 | no |
| T027 | `checkDeclaredMode` with injected `probe` / `readEnv`: control render, probes, allowed / denied / redirect renders, request log, verdict | WP06 | no |
| T058 | Message and verdict-line builders owning every stable substring | WP06 | [P] with T026 |
| T028 | `plantuml-service-config.mjs`: `readServiceEnv` (`docker inspect`) and `dockerProbe` (`docker exec … curl`) | WP11 | no |
| T029 | CLI flags `--canary-port`, `--astro-config` (pinned `evaluateSiteConfig` contract, dynamic import), `--print-declared`; routing; unset-mode profile read with a container (D7) | WP11 | no |
| T030 | Declared-mode output: declared line, per-path lines, verdict line, FAIL / warning / OK, exit codes | WP11 | no |
| T031 | R8: spike says neither `!import` nor `!includesub` fetches — confirm and record, add no fixture | WP11 | [P] |
| T032 | `plantuml-mode-check.test.ts`: unit tests for the pure functions, builders and `checkDeclaredMode` | WP06 | [P] (write first) |
| T057 | Commit the spike's inspect capture; `plantuml-service-config.test.ts` (reader, strict argv, docker missing / erroring) | WP11 | [P] (write first) |
| T033 | Matrix service fixtures from the shared harness, with sanity assertions | WP07 | no |
| T034 | Matrix: all 9 declared × observed cells (M1–M9) through the real command | WP07 | no |
| T059 | Output shape (declared / verdict lines), C-006 static-import guard, `--print-declared`, `--canary-port` golden equivalence | WP07 | [P] with T034 |
| T035 | Half-removal table (rows a, b, c1, c2, c3, c4 empty item, i no container, ii profile not INTERNET + two baselines) with presence / absence assertions | WP12 | no |
| T036 | Edge cases 1–9 (+ missing `--astro-config` file) at the command; edge case 10 is row c4 | WP12 | [P] with T035 |
| T037 | NFR-001 pair, docker missing (`pathMode: 'node-only'`) / erroring, Java properties, no container, strict argv, busy port, unset-profile rows u0–u2 (D7), US1 AS4 fake row | WP12 | [P] with T035 |
| T060 | Manual mutation record (file:line per half-removal row) | WP12 | no |
| T038 | New `plantuml-allowlist` job in `ci.yml` (pinned image, ALLOWLIST, `--add-host`, verdict grep, 5-minute timeout) | WP08 | no |
| T039 | `ci-ok` wiring: `needs`, `PLANTUML_ALLOWLIST_RESULT`, `REQUIRED_LANES`, `ci-ok-decision.test.mjs` | WP08 | no |
| T040 | `ci.yml` header comment and lane count | WP08 | [P] |
| T041 | `plantuml-workflow-services.test.ts`: every PlantUML service in every workflow, found by image | WP08 | [P] (write first) |
| T042 | Lane vacuity, C-004 (`plantuml.com`, `INTERNET`), NFR-001 static (canary-host entries only) | WP08 | no |
| T043 | Lane green on CI and wall time (NFR-002): orchestrator-owned mission-review / PR-check item | WP08 | no |
| T044 | Parity fixture site `src/tests/fixtures/plantuml-opt-in-site/` calling the real `defineDocKittyIntegrations` | WP09 | no |
| T045 | Build-side runner: evaluate the fixture, capture the resolution, `names` and `[dk-plantuml]` stderr | WP09 | no |
| T046 | Check-side runner: `--astro-config <fixture> --print-declared`, with and without the flag | WP09 | [P] with T045 |
| T047 | 9 / 9 grid + E5 case + `names: ['PARITY']` proof | WP09 | no |
| T048 | Notice text per source and silence on unset cells (FR-003, US4 AS3) | WP09 | no |
| T049 | Forged-handoff case and env-only (no `--astro-config`) cells | WP09 | [P] with T048 |
| T050 | Commit the recommended SANDBOX block copy and the docs test skeleton (before editing the guide) | WP10 | no |
| T051 | Guide subsection "Allowing external includes" in `docs/guides/consumer-setup.md` | WP10 | no |
| T052 | ADR-0074 `docs/adr/0074-plantuml-external-include-opt-in.md` (file only, no index row) | WP10 | [P] with T051 |
| T053 | `docs/architecture/diagrams.md` pointer; lane lists in `ci-cd-pipeline.md` and `docs/ops/ci-cd.md` | WP10 | [P] |
| T054 | Changelog fragment `docs/changelog/unreleased/268-plantuml-external-include-opt-in.md` | WP10 | [P] |
| T055 | `plantuml-opt-in-docs.test.ts` assertions (blocks, topics, ADR and fragment content) | WP10 | no |
| T056 | Docs gates: `validate:docs`, `validate:links`, `validate:changelog`, `validate:adr-ids`, Vale | WP10 | no |

## Dependency graph

```
WP01 (spike, orchestrator-run) ───────────────┐
WP02 (goldens) ─► WP05 ─► WP06 (classifier) ──┼─► WP11 (CLI + docker reader) ─┬─► WP07 (matrix; also needs WP01)
WP03 (resolver) ─┬───────► WP06               │                              ├─► WP12 (halves, edges, NFR-001)
                 └─► WP04 ────────────────────┘                              ├─► WP08 (CI lane) ─► WP10 (docs; also WP01, WP11)
                          WP04 ───────────────────────────────────────────── └─► WP09 (parity; also WP04)
```

Start in parallel: WP01 (orchestrator), WP02, WP03. Then WP04 (after WP03) and WP05 (after WP02); WP06 after WP03 and WP05 — **not** gated on WP01. WP11 joins WP01, WP04 and WP06. WP07, WP08, WP09 and WP12 run in parallel after WP11. WP10 closes and runs the mission-level `pnpm test` + `pnpm lint` gate.

**If WP01 returns to the operator**: WP02–WP06 may proceed; WP11 and everything depending on it (WP07, WP08, WP09, WP10, WP12) are blocked until the operator decides. WP11 is the gate because the spike can invalidate how the service configuration is read (`docker inspect` shape, `services:` vs `docker run` container) and whether R8 fixtures are needed; WP06's classification and messages do not depend on it. Branch deletion (`git ls-remote` empty) and the evidence copy are done on every outcome, before reporting.

**Evidence visibility**: WP01 is a planning artifact run by the orchestrator in the planning checkout; it commits its evidence to `feat/268-plantuml-external-opt-in` before the WP11, WP07 and WP10 lanes start, so their worktrees contain it.

---

## WP01 — CI feasibility spike (IC-01)

**Status**: done — verdict **GO** (services block; fallback (a) not needed; lane 38 s; R8: no fixtures). Evidence committed in 2eefef7.
**Executor**: **orchestrator-run** (needs `git push`, `gh` and a real runner; lane agents have none of these).
**Goal**: prove on a real GitHub runner, before any lane is written, that a `services:` PlantUML container with `--add-host dk-canary:host-gateway` and a static ALLOWLIST reaches a runner-side canary on a fixed port, fetches the allowed prefix and refuses the denied one; record redirect, `!import` / `!includesub`, entry-trimming behaviour and wall time; capture a real `docker inspect` output.
**Priority**: P0 (gates WP11, WP07, WP08, WP10, and WP09, WP12 via WP11; it can invalidate the lane design).
**Independent test**: the addendum in research.md names a run URL whose log shows the allowed fetch and the denied refusal; `spike/inspect-capture.json` parses as a JSON array of `KEY=VALUE` strings.
**Prompt**: [tasks/WP01-ci-feasibility-spike.md](./tasks/WP01-ci-feasibility-spike.md)

Included subtasks:

- T001 Create the throwaway spike branch and a `push`-triggered spike workflow (WP01)
- T002 Prove `--add-host dk-canary:host-gateway` reachability and allowed-fetch / denied-refuse under ALLOWLIST (WP01)
- T003 Probe redirect handling, `!import` / `!includesub`, entry trimming and trailing `;` (WP01)
- T004 Capture a real `docker inspect .Config.Env` output and the lane wall time (WP01)
- T005 Write the spike addendum in research.md and decide go / fallback (a) / return to operator (WP01)
- T006 Delete the throwaway branch and record its last run URL (WP01)

**Implementation sketch**: branch `spike/268-allowlist-lane` off the mission branch; one workflow file with `on: push: branches: [spike/268-allowlist-lane]` (never `workflow_dispatch`: it only runs from the default branch); a Node canary started in a background step; `docker exec <id> curl` and PlantUML renders against it; results echoed into the log; `docker inspect` written to an artifact. Local Docker runs cover what does not need the runner.
**Parallel opportunities**: T003 and T004 share one workflow run.
**Dependencies**: none.
**Risks**: `host-gateway` refused for service containers → fallback (a) (`docker run` in a step); PlantUML follows the 302 into the denied prefix → real security finding; if neither the lane design nor fallback (a) can pass, **stop and return to the operator** (spec Assumption 3), never drop the lane.
**If RETURN TO OPERATOR**: WP02–WP06 proceed; WP11 and its dependents (WP07, WP08, WP09, WP10, WP12) are blocked. Branch deletion and evidence copy happen on every outcome, before reporting.

---

## WP02 — Unset-mode golden characterization (IC-02)

**Goal**: freeze today's include-check stdout, stderr and exit code for pass and fail cases, from the unchanged code, in a commit that lands before any change to the guard or the CLI.
**Priority**: P0 (FR-007 is the hardest rule; WP05 depends on it).
**Independent test**: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-include-check-golden.test.ts` passes against today's `plantuml-include-guard.mjs` and `assert-plantuml-no-remote-include.mjs`.
**Prompt**: [tasks/WP02-unset-mode-goldens.md](./tasks/WP02-unset-mode-goldens.md)

Included subtasks:

- T007 Strict fake `docker` executable (exact argv only: `inspect` and `exec … curl`) (WP02)
- T008 Shared CLI test harness: fake PlantUML server with a fetch policy, free ports, CLI spawn, port normalization (WP02)
- T009 Capture today's unset-mode stdout / stderr / exit for five pass and fail cases (WP02)
- T010 Golden test asserting byte identity (ports normalized only) (WP02)
- T011 Fake-docker self-test (strict argv rejection, deterministic stderr) (WP02)

**Implementation sketch**: Node fake `docker` under `src/tests/fixtures/plantuml-fake-docker/docker`; a TypeScript harness under `src/tests/helpers/`; goldens under `src/tests/fixtures/plantuml-include-check/golden-unset-<case>.{stdout,stderr,exit}`, regenerated only with an explicit env flag.
**Parallel opportunities**: T007 and T008 are independent; T011 beside T010.
**Dependencies**: none.
**Risks**: normalizing anything other than ports would hide a real regression; the WP must not touch `src/scripts/`.

---

## WP03 — Shared resolver and validation (IC-03)

**Goal**: one dependency-free module that parses, validates and resolves the opt-in setting and owns `describeDeclared`, nothing else.
**Priority**: P0 (WP04 and WP06 import it).
**Independent test**: `plantuml-external-setting.test.ts` passes: every accepted shape resolves, every edge-case 1–6 and 9 shape (E1–E7) is rejected or resolved as specified, and the module source contains no `import`.
**Prompt**: [tasks/WP03-shared-resolver.md](./tasks/WP03-shared-resolver.md)

Included subtasks:

- T012 `src/lib/plantuml-external.mjs` skeleton: constants, `PlantumlAllowExternalError`, message shape (WP03)
- T013 `parseAllowExternalEnv` and `validateAllowExternal` (edge cases 1–4 and 9) (WP03)
- T014 `resolvePlantumlAllowExternal` precedence (edge cases 5–6) (WP03)
- T015 `describeDeclared` (the one line shared by build notice and check) (WP03)
- T016 `plantuml-external-setting.test.ts`: resolution table, rejection table, no-imports assertion (WP03)

**Implementation sketch**: pure ESM with JSDoc types, following `src/lib/draft-publication.mjs`; URL validation by hand-rolled checks plus the global `URL` (no import needed); stable reason substrings from `contracts/opt-in-setting.md`.
**Parallel opportunities**: the test table (T016) is written first, then T013–T015 against it.
**Dependencies**: none.
**Risks**: a stray `import` breaks C-006; normalizing entries would hide PlantUML's raw-prefix semantics.

---

## WP04 — Build integration (IC-04)

**Goal**: `defineDocKittyIntegrations({ plantumlAllowExternal })` validates eagerly, always publishes the resolution as an internal handoff, prints the FR-003 notice only when not sandbox, and `site-config-eval.mjs` returns the resolution (or `null`).
**Priority**: P1.
**Independent test**: `plantuml-allow-external-config.test.ts` passes: invalid value throws at definition time, handoff always set (sandbox included), notice printed for allowlist / internet and absent when unset, `clearInternalEnv` clears the handoff, the eval child drops an inherited value.
**Prompt**: [tasks/WP04-build-integration.md](./tasks/WP04-build-integration.md)

Included subtasks:

- T017 `DocKittyOptions.plantumlAllowExternal` type and JSDoc (WP04)
- T018 Eager resolution and always-published `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` handoff (WP04)
- T019 FR-003 build notice (`[dk-plantuml]`, full verify command, diagrams-off suffix) (WP04)
- T020 `site-config-eval.mjs` returns `plantumlAllowExternal` (resolution or `null`), deletes inherited handoff (WP04)
- T021 `plantuml-allow-external-config.test.ts`: build-side unit tests (WP04)

**Implementation sketch**: mirror the `gherkin` / `indexBasename` eager pattern in `config.ts` (`:507-583`); add the name to `internal-env.mjs`; extend the child's JSON answer in `site-config-eval.mjs` like `docsRoot`.
**Parallel opportunities**: T019 and T020 touch different files.
**Dependencies**: Depends on WP03.
**Risks**: any output on the unset path breaks FR-007 / US4 AS3; `diagrams` stays a boolean.

---

## WP05 — Canary redesign (IC-05)

**Goal**: a fixed-port-capable canary with allowed, denied and redirect paths and a request log; the unset path's fixtures move onto the allowed path while its `/reachability` probe and every printed byte stay the same.
**Priority**: P1.
**Independent test**: `plantuml-canary.test.ts` passes; `plantuml-include-guard.test.ts` and `plantuml-include-check-golden.test.ts` pass unmodified.
**Prompt**: [tasks/WP05-canary-redesign.md](./tasks/WP05-canary-redesign.md)

Included subtasks:

- T022 Exported `startCanary({ port })`: allowed / denied / redirect paths, markers, request log, busy-port error (WP05)
- T023 Retarget unset fixtures to `/dk-canary/allowed/include/<fixture>`, keep `/reachability`, accept `canaryPort` (WP05)
- T024 `plantuml-canary.test.ts`: canary unit tests (WP05)
- T025 Prove goldens and `plantuml-include-guard.test.ts` pass unmodified (WP05)

**Implementation sketch**: replace the private `startCanary()` in `plantuml-include-guard.mjs` with an exported one; keep `checkRemoteIncludesRefused`'s signature and result shape, adding only an optional `canaryPort`.
**Parallel opportunities**: T024 is written first.
**Dependencies**: Depends on WP02.
**Risks**: the probe-failure message embeds the probe URL, so `/reachability` must not move (post-plan A4).

---

## WP06 — Declared-mode classifier, verifier and verdict messages (IC-06, part 1)

**Goal**: the pure decision module `src/scripts/plantuml-mode-check.mjs`: observed class from the container's profile plus the canary's behavioural class (allowlist mode), raw set comparison failing on empty items (D6), env parsing by key name, every stable message and the verdict line, and `checkDeclaredMode` with injected `probe` / `readEnv`. No CLI, no docker.
**Priority**: P1 (security-critical logic).
**Independent test**: `plantuml-mode-check.test.ts` passes; WP02's goldens untouched.
**Prompt**: [tasks/WP06-declared-mode-verifier.md](./tasks/WP06-declared-mode-verifier.md)

Included subtasks:

- T026 `plantuml-mode-check.mjs` pure functions: `canaryEntry`, `classifyObserved`, `compareAllowlist`, `parseContainerEnv`, `systemPropertyConfig` (WP06)
- T027 `checkDeclaredMode` with injected `probe` / `readEnv` (WP06)
- T058 Message and verdict-line builders owning every stable substring (WP06)
- T032 `plantuml-mode-check.test.ts`: unit tests (WP06)

**Implementation sketch**: pure functions and builders first, then the orchestrator over WP05's canary; dependencies injected so WP11 supplies docker.
**Parallel opportunities**: T026 and T058.
**Dependencies**: Depends on WP03, WP05. **Not** gated on WP01 (nothing here depends on a spike outcome).
**Spike findings**: internet mode is judged by the profile (`INTERNET`) read from the container, which it requires; canary results are informational there (F1/D5). Redirects judged from the log only (F3); "at least one hit" (F4).
**Risks**: trimming in `compareAllowlist`; counting hits only on successful renders or expecting exactly one; printing empty `extra:` / `missing:`.
**Model**: opus.

---

## WP11 — Include-check CLI routing, flags, docker reader (IC-06, part 2)

**Goal**: the shipped command: `--canary-port`, `--astro-config` (pinned `evaluateSiteConfig({ siteRoot, astroConfig, tool })` → `{ configPath, siteDir, config }` contract; `result.config.plantumlAllowExternal`; `null` → env-only; missing file → exit 2), `--print-declared`, routing (unset byte-identical), output and exit codes; `plantuml-service-config.mjs` (`docker inspect` reader, `docker exec curl` probe); R8 fixtures; the committed inspect fixture.
**Priority**: P1.
**Independent test**: `plantuml-service-config.test.ts` passes; goldens green; `--print-declared` prints one JSON line.
**Prompt**: [tasks/WP11-include-check-cli.md](./tasks/WP11-include-check-cli.md)

Included subtasks:

- T028 `plantuml-service-config.mjs`: `readServiceEnv` and `dockerProbe` (WP11)
- T029 CLI flags and routing (WP11)
- T030 Declared-mode output and exit codes (WP11)
- T031 R8 conditional fixtures (WP11)
- T057 Inspect fixture and reader tests (WP11)

**Implementation sketch**: reader and tests first; then flags, the dynamic `site-config-eval` import, routing and printing over WP06's builders.
**Parallel opportunities**: T031 independent.
**Dependencies**: Depends on WP01, WP04, WP06. Gated on WP01 because the spike can invalidate the service-config reading format and the fixture set.
**Risks**: static import of `site-config-eval.mjs` (C-006); a new unset-mode line (FR-007); reading `_RESOLVED` from its own env (A2b).
**Model**: opus.

---

## WP07 — Command-level 9-cell matrix (IC-07, part 1)

**Goal**: all 9 declared × observed cells (M1–M9, plus M6b) through the real command, every declared row with `--service-container` and an inspect profile setting the observed class (F1/D5; M9 passes with a fake that refuses the canary); output shape (one `declared:` line, one verdict line in declared modes; neither in unset); C-006 static-import guard; `--print-declared`; `--canary-port` golden equivalence.
**Priority**: P1 (FR-005, FR-011, SC-002).
**Independent test**: `plantuml-include-check-cli.test.ts` passes three consecutive full-suite runs; no test uses 18091.
**Prompt**: [tasks/WP07-command-matrix-tests.md](./tasks/WP07-command-matrix-tests.md)

Included subtasks:

- T033 Matrix service fixtures from the shared harness, with sanity assertions (WP07)
- T034 Matrix: all 9 cells M1–M9 (WP07)
- T059 Output shape, C-006, `--print-declared`, `--canary-port` golden equivalence (WP07)

**Implementation sketch**: WP02 harness (`prefixPolicy`, async `runCheck`), WP11's inspect fixture via temp copies; free ports.
**Parallel opportunities**: T034 and T059.
**Dependencies**: Depends on WP01, WP11.
**Risks**: permissive fakes; port collisions.

---

## WP12 — Half-removal table, edge cases, NFR-001 pair, mutation record (IC-07, part 2)

**Goal**: rows a, b, c1, c2, c3, c4 (empty item, D6), i (internet without container), ii (internet profile not `INTERNET`) (each asserting its own substring and the absence of every other row's), edge cases 1–9 (+ missing `--astro-config` file; edge case 8 passes on a 200-empty-diagram redirect, F3; `@` entries, F5), the NFR-001 pair, docker missing (`pathMode: 'node-only'`) and erroring, Java properties, no container, strict argv, busy port; the recorded manual mutation pass.
**Priority**: P1 (FR-004, FR-006, FR-011, NFR-001).
**Independent test**: `plantuml-include-check-halves.test.ts` passes three consecutive full-suite runs; mutation record present.
**Prompt**: [tasks/WP12-half-removal-and-edge-cases.md](./tasks/WP12-half-removal-and-edge-cases.md)

Included subtasks:

- T035 Half-removal table (WP12)
- T036 Edge cases 1–9 at the command; edge case 10 is row c4 (WP12)
- T037 NFR-001 pair, docker failures, C-003, misc (WP12)
- T060 Manual mutation record (WP12)

**Implementation sketch**: own test file; shared harness and fake docker switches (`DK_FAKE_DOCKER_EXEC_FAIL_MATCH`, `pathMode: 'node-only'`).
**Parallel opportunities**: T035, T036, T037 are independent `describe` blocks.
**Dependencies**: Depends on WP11.
**Risks**: a row that cannot fail for exactly one reason; a node-only PATH that still finds a real docker (hence the symlink-only dir).

---

## WP08 — Real allowlist CI lane and workflow services test (IC-08 + IC-09)

**Goal**: an unconditional `plantuml-allowlist` job running the digest-pinned image in ALLOWLIST mode against the canary, feeding `ci-ok`; plus a new inventory test holding every PlantUML service in every workflow to SANDBOX except that lane.
**Priority**: P1 (FR-012, FR-014, SC-001, SC-004).
**Independent test**: `node --test .github/scripts/ci-ok-decision.test.mjs` and `plantuml-workflow-services.test.ts` pass; the lane is green on the PR's CI run, its log contains `verdict: declared allowlist, observed allowlist`.
**Prompt**: [tasks/WP08-allowlist-ci-lane.md](./tasks/WP08-allowlist-ci-lane.md)

Included subtasks:

- T038 New `plantuml-allowlist` job in `ci.yml` (pinned image, ALLOWLIST, `--add-host`, verdict grep, 5-minute timeout) (WP08)
- T039 `ci-ok` wiring: `needs`, `PLANTUML_ALLOWLIST_RESULT`, `REQUIRED_LANES`, `ci-ok-decision.test.mjs` (WP08)
- T040 `ci.yml` header comment and lane count (WP08)
- T041 `plantuml-workflow-services.test.ts`: every PlantUML service in every workflow, found by image (WP08)
- T042 Lane vacuity, C-004 (`plantuml.com`, `INTERNET`), NFR-001 static (canary-host entries only) (WP08)
- T043 Lane green on CI and wall time (NFR-002): orchestrator-owned mission-review / PR-check item (WP08)

**Implementation sketch**: the job block from research R5 verbatim (or fallback (a) if WP01 chose it); the test copies the pin regex and block parser from `plantuml-service-hardening.test.ts`, which stays unedited.
**Parallel opportunities**: T041 is written first and drives T038–T040.
**Dependencies**: Depends on WP11 (WP01 transitively).
**CI proof**: the lane-green run (SC-001, SC-004, NFR-002) is an orchestrator-owned mission-review / PR-check item; the WP's DoD is the local inventory test, `ci-ok-decision` test and a recorded neutered-lane mutation check.
**Risks**: a `REQUIRED_LANES` entry without its `*_RESULT` env fails `ci-ok` closed; the existing build-example job must not change (C-001).

---

## WP09 — Resolution parity, NFR-003 (IC-11)

**Goal**: measure 9 of 9 (+1 E5 case) between the real `defineDocKittyIntegrations` and the check's `--astro-config --print-declared`, prove the real build code ran, and show a forged parent handoff is ignored.
**Priority**: P1 (NFR-003, FR-013).
**Independent test**: `plantuml-resolution-parity.test.ts` passes with 10 parity rows, notice assertions, and the forged-handoff case.
**Prompt**: [tasks/WP09-resolution-parity.md](./tasks/WP09-resolution-parity.md)

Included subtasks:

- T044 Parity fixture site `src/tests/fixtures/plantuml-opt-in-site/` calling the real `defineDocKittyIntegrations` (WP09)
- T045 Build-side runner: evaluate the fixture, capture the resolution, `names` and `[dk-plantuml]` stderr (WP09)
- T046 Check-side runner: `--astro-config <fixture> --print-declared`, with and without the flag (WP09)
- T047 9 / 9 grid + E5 case + `names: ['PARITY']` proof (WP09)
- T048 Notice text per source and silence on unset cells (FR-003, US4 AS3) (WP09)
- T049 Forged-handoff case and env-only (no `--astro-config`) cells (WP09)

**Implementation sketch**: the fixture's `astro.config.mjs` reads its site value from a test-only env knob and sets `indexBasename: ['PARITY']`; both sides run as child processes so stderr is captured.
**Parallel opportunities**: T045 and T046; T048 and T049.
**Dependencies**: Depends on WP04, WP11.
**Risks**: the fixture must resolve `astro` from the workspace; a stubbed build side must not be able to pass (the `names` proof).

---

## WP10 — Documentation and records (IC-10)

**Goal**: the guide subsection, ADR-0074, the `diagrams.md` pointer, the changelog fragment, the CI lane lists, and every prose-asserting test.
**Priority**: P2 (closes FR-008, FR-009, FR-010, C-002).
**Independent test**: `plantuml-opt-in-docs.test.ts` passes; `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:changelog`, `pnpm validate:adr-ids` pass.
**Prompt**: [tasks/WP10-docs-and-records.md](./tasks/WP10-docs-and-records.md)

Included subtasks:

- T050 Commit the recommended SANDBOX block copy and the docs test skeleton (before editing the guide) (WP10)
- T051 Guide subsection "Allowing external includes" in `docs/guides/consumer-setup.md` (WP10)
- T052 ADR-0074 `docs/adr/0074-plantuml-external-include-opt-in.md` (file only, no index row) (WP10)
- T053 `docs/architecture/diagrams.md` pointer; lane lists in `ci-cd-pipeline.md` and `docs/ops/ci-cd.md` (WP10)
- T054 Changelog fragment `docs/changelog/unreleased/268-plantuml-external-include-opt-in.md` (WP10)
- T055 `plantuml-opt-in-docs.test.ts` assertions (blocks, topics, ADR and fragment content) (WP10)
- T056 Docs gates: `validate:docs`, `validate:links`, `validate:changelog`, `validate:adr-ids`, Vale (WP10)

**Implementation sketch**: quickstart.md is the guide's outline; the allowlist service block is copied from WP08's lane with only the declared entry replaced; ADR follows `docs/adr/template.md`.
**Parallel opportunities**: T052, T053, T054 are independent files.
**Dependencies**: Depends on WP01, WP08, WP11.
**Mission-level gate**: full `pnpm test` and `pnpm lint` pass (WP10 is last).

**Risks**: editing the recommended SANDBOX block or `CHANGELOG.md` or the ADR index table; a test asserting prose wording rather than required substrings.

---

## Mission-level PR-check gate (orchestrator-owned; analyze A9)

Before accept / mission review passes, the orchestrator records the `plantuml-allowlist` run URL on the mission PR, the `verdict: declared allowlist, observed allowlist` line in its log, and its wall time (≤ 5 minutes). This record is the evidence for **SC-001, SC-004 and NFR-002**; without it the mission is not accepted. No lane agent can produce it.

---

## Requirement → work package

| Requirement | WPs |
|---|---|
| FR-001 | WP03, WP04 |
| FR-002 | WP03, WP12 |
| FR-003 | WP04, WP09 |
| FR-004 | WP06, WP11, WP12 |
| FR-005 | WP06, WP07, WP11 |
| FR-006 | WP06, WP11, WP12 |
| FR-007 | WP02, WP05, WP06, WP07, WP10, WP11, WP12 |
| FR-008 | WP10 |
| FR-009 | WP10 |
| FR-010 | WP10 |
| FR-011 | WP07, WP12 |
| FR-012 | WP01, WP08 |
| FR-013 | WP03, WP04, WP09, WP11 |
| FR-014 | WP08 |
| NFR-001 | WP05, WP06, WP08, WP11, WP12 |
| NFR-002 | WP01, WP08 |
| NFR-003 | WP09 |
| C-001 | WP02, WP08, WP10 |
| C-002 | WP10 |
| C-003 | WP03, WP11, WP12 |
| C-004 | WP08 |
| C-005 | WP01, WP08 |
| C-006 | WP03, WP07, WP11 |
| SC-001 | WP08 |
| SC-002 | WP07 |
| SC-003 | WP02, WP05 |
| SC-004 | WP08 |
