---
work_package_id: WP02
title: Unset-mode golden characterization and test harness
dependencies: []
requirement_refs:
- FR-007
- SC-003
- C-001
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 373921590984c72ea48ff19c7dcd436011c4da56
created_at: '2026-11-02T22:17:28.862607+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/fixtures/plantuml-include-check/
create_intent:
- src/tests/plantuml-include-check-golden.test.ts
- src/tests/plantuml-fake-docker.test.ts
- src/tests/helpers/plantuml-check-harness.ts
- src/tests/fixtures/plantuml-fake-docker/docker
- src/tests/fixtures/plantuml-include-check/golden-unset-refuse-no-container.stdout
- src/tests/fixtures/plantuml-include-check/golden-unset-refuse-no-container.stderr
- src/tests/fixtures/plantuml-include-check/golden-unset-refuse-no-container.exit
- src/tests/fixtures/plantuml-include-check/golden-unset-refuse-container.stdout
- src/tests/fixtures/plantuml-include-check/golden-unset-refuse-container.stderr
- src/tests/fixtures/plantuml-include-check/golden-unset-refuse-container.exit
- src/tests/fixtures/plantuml-include-check/golden-unset-fetch.stdout
- src/tests/fixtures/plantuml-include-check/golden-unset-fetch.stderr
- src/tests/fixtures/plantuml-include-check/golden-unset-fetch.exit
- src/tests/fixtures/plantuml-include-check/golden-unset-canary-unreachable.stdout
- src/tests/fixtures/plantuml-include-check/golden-unset-canary-unreachable.stderr
- src/tests/fixtures/plantuml-include-check/golden-unset-canary-unreachable.exit
- src/tests/fixtures/plantuml-include-check/golden-unset-control-fails.stdout
- src/tests/fixtures/plantuml-include-check/golden-unset-control-fails.stderr
- src/tests/fixtures/plantuml-include-check/golden-unset-control-fails.exit
- src/tests/fixtures/plantuml-include-check/inspect-sandbox.json
execution_mode: code_change
model: sonnet
owned_files:
- src/tests/plantuml-include-check-golden.test.ts
- src/tests/plantuml-fake-docker.test.ts
- src/tests/helpers/plantuml-check-harness.ts
- src/tests/fixtures/plantuml-include-check/**
- src/tests/fixtures/plantuml-fake-docker/docker
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 – Unset-mode golden characterization and test harness

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Freeze **today's** include-check output (stdout, stderr, exit code) for the unset path, for pass **and** fail cases, as committed golden files, from the **unchanged** code, in a commit that lands before any change to `src/scripts/plantuml-include-guard.mjs` or `src/scripts/assert-plantuml-no-remote-include.mjs`. Build the shared test harness and the strict fake `docker` that later WPs (WP05, WP06, WP07, WP09, WP11, WP12) reuse.

This is a characterization WP (DIRECTIVE_034, test-first; FR-007, SC-003, US4 AS1–2, C-001). **You must not edit anything under `src/scripts/`.** If a golden cannot be captured without a code change, stop and report.

## Context

- `src/scripts/assert-plantuml-no-remote-include.mjs` (whole file, 72 lines): flags `--server`, `--canary-host`, `--service-container`; probe via `docker exec <c> curl -sf --max-time 5 -o /dev/null <url>`; output lines at `:56-71`.
- `src/scripts/plantuml-include-guard.mjs`: canary on random port (`:86-100`), `/reachability` probe (`:149-164`), per-fixture renders (`:166-181`).
- `src/tests/plantuml-include-guard.test.ts`: existing `fakePlantuml(behaviour)` pattern (`refuse` / `fetch` / `broken`) — copy the idea, do not import from a test file.
- research.md R3 "Golden output" and R4 "fake docker"; contracts/include-check-cli.md "Output, unset mode (frozen)"; post-plan N2, N4.
- Tests run with Vitest from `src/` (`pnpm --filter @spec-kitty/doc-toolkit test`). Helpers live in `src/tests/helpers/` (e.g. `restore-internal-env.ts`).

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.
- This WP's commit must contain only goldens, harness and tests; it is the "before" commit IC-02 requires. WP05 (canary) depends on this WP, so the goldens always land first.

## Subtasks

### T007 – Strict fake `docker`

**Purpose**: tests must never call a real `docker`, and a fake that accepts any argv would let wrong argv pass (post-plan N2).

**Steps**:
1. Create `src/tests/fixtures/plantuml-fake-docker/docker`: a Node script with `#!/usr/bin/env node`, mode `0755` (commit the exec bit; verify with `git ls-files -s`).
2. Accept **exactly** two argv shapes:
   - `exec <container> curl -sf --max-time 5 -o /dev/null <url>` → perform `fetch(url)` with a 5 s timeout; exit 0 on a 2xx, else write `curl: (22) The requested URL returned error` to stderr and exit 22; on a connection error write `curl: (7) Failed to connect` and exit 7.
   - `inspect -f {{json .Config.Env}} <container>` → print the contents of the file named by `DK_FAKE_DOCKER_INSPECT_FILE` to stdout and exit 0; if that variable is unset, write `fake docker: DK_FAKE_DOCKER_INSPECT_FILE not set` and exit 1.
3. Behaviour switches via env (all optional, for later WPs): `DK_FAKE_DOCKER_FAIL=1` → exit 1 with `fake docker: forced failure` on stderr for every call; `DK_FAKE_DOCKER_EXEC_FAIL=1` → the `exec` form exits 7 without fetching (unreachable canary); `DK_FAKE_DOCKER_EXEC_FAIL_MATCH=<substring>` → the same, but only for URLs containing that substring (WP12 uses `/dk-canary/denied/` to fail only the denied probe); `DK_FAKE_DOCKER_INSPECT_FAIL=1` → only the `inspect` form exits 1 with `fake docker: forced inspect failure` (the `exec` probe still works; WP12 row u5); `DK_FAKE_DOCKER_LOG=<file>` → append each argv as one JSON line.
4. Anything else: write `fake docker: unexpected argv: <JSON argv>` to stderr and exit 125.
5. Output must be deterministic: every stderr message is a fixed string ending in exactly one `\n`; no timestamps, PIDs, URLs-with-ports or random text (the probe-failure message embeds the child's stderr).

**Validation**:
- [ ] `src/tests/fixtures/plantuml-fake-docker/docker inspect -f '{{json .Config.Env}}' x` with the env set prints the file.
- [ ] `docker ps` through the fake exits 125.

**Edge cases**: `execFile` resolves `docker` from `PATH`; the harness prepends the fixture directory. Do not name the file `docker.mjs`.

### T008 – Shared CLI test harness

**Purpose**: one place for fake services, free ports, spawning the CLI and normalizing ports; WP05, WP06, WP07, WP09, WP11 and WP12 import it.

**Steps**:
1. Create `src/tests/helpers/plantuml-check-harness.ts` exporting:
   - `freePort(): Promise<number>` (bind `0`, read, close).
   - `startFakePlantuml(policy, options)` where `policy` is `'fetch' | 'refuse' | ((url) => 'fetch' | 'refuse')`, and options `{ broken?: boolean, followRedirects?: boolean, strayPath?: string }`. Base behaviours `refuse` (SANDBOX-like: HTTP 400 + `x-plantuml-diagram-error`), `fetch` (GET the include with `redirect: followRedirects ? 'follow' : 'manual'`, append body), `broken` (500). `strayPath`: on the first render, also GET `<canary origin><strayPath>` (NFR-001 positive control). `fetchCount` (default **1**, so today's goldens are unchanged): how many times each fetched include is requested — WP07 / WP12 set **2**, because the real image requests each included URL twice (spike F4). With `followRedirects: false`, a redirect response (3xx) is **not** fetched further and the fake answers the render with **HTTP 200 and an empty diagram** (no `x-plantuml-diagram-error` header), as the pinned image does (spike F3). A `refusePrivateHosts` option (refuse URLs whose host has no dot or is an IP literal, as the real INTERNET profile does, spike F1) lets WP07 / WP12 model a realistic internet-mode service. Export `prefixPolicy(prefixes)` (fetch iff the URL starts with one entry, raw `startsWith`, like PlantUML) so WP07 and WP12 share one ALLOWLIST emulation. Parse includes with the same regex as `plantuml-include-guard.test.ts` (`!include`, `!includeurl`, `!include_once`, `!include_many`).
   - `runCheck(args: string[], opts: { env?: Record<string,string>, fakeDocker?: boolean, pathMode?: 'inherit' | 'node-only' }): Promise<{ stdout: string, stderr: string, exit: number }>` spawning `process.execPath src/scripts/assert-plantuml-no-remote-include.mjs` (path resolved from the helper's location) with **async** `child_process.spawn` collecting output — **never `spawnSync`/`execFileSync`**: the fake PlantUML server runs in the test's own event loop, and a synchronous spawn deadlocks it. `fakeDocker: true` prefixes `PATH` with the fake-docker dir. `pathMode: 'node-only'` builds a temp dir containing only a symlink `node → process.execPath` and sets `PATH` to **that dir alone** (WP12's "docker missing" case; a `PATH` merely lacking the fake still finds a real `docker` on many machines). `DK_PLANTUML_ALLOW_EXTERNAL` and `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` are **removed** from the child env unless explicitly passed.
   - `normalizePorts(text): string` — exactly one regex, `/(127\.0\.0\.1|localhost):\d+/g` → `$1:<PORT>`; no ports parameter, nothing else normalized.
   - `FAKE_DOCKER_DIR` constant.
2. Close every server in `afterEach` (export a `trackServer` / `closeAll` pair).

**Validation**:
- [ ] Harness compiles under the repo's TypeScript config (`pnpm --filter @spec-kitty/doc-toolkit exec tsc --noEmit` or the repo's typecheck command).

**Edge cases**: the canary port is random in unset mode and appears in failure messages (`control: the canary at http://127.0.0.1:<port> …`, `probe failed: Command failed: docker exec … http://127.0.0.1:<port>/reachability`), and the fake server's port appears in `OK — … refused by http://127.0.0.1:<port>/svg/`. The single regex covers both; document it in the helper as the only normalization.

### T009 – Capture the goldens

**Purpose**: the frozen output of today's code.

**Cases** (each produces `golden-unset-<case>.stdout`, `.stderr`, `.exit`):

| Case | Setup | Expected today |
|---|---|---|
| `refuse-no-container` | fake refuses | exit 0, note line on stderr, OK line |
| `refuse-container` | fake refuses, `--service-container fake`, fake docker, `DK_FAKE_DOCKER_INSPECT_FILE` → a **SANDBOX** inspect file | exit 0, OK line "with the canary proven reachable" |
| `fetch` | fake fetches | exit 1, `the server FETCHED the remote include` |
| `canary-unreachable` | fake refuses, container given, `DK_FAKE_DOCKER_EXEC_FAIL=1` | exit 1, `probe failed: …`, `control: the canary … is not reachable` |
| `control-fails` | fake `broken` | exit 1, `control: a plain diagram did not render (HTTP 500)` |

**Steps**:
1. Add a capture mode to the golden test: when `DK_UPDATE_GOLDENS=1`, write the normalized output to `src/tests/fixtures/plantuml-include-check/`; otherwise compare. If `DK_UPDATE_GOLDENS=1` and `CI=true` are both set, the test **fails** (`refusing to update goldens in CI`).
2. Record the base sha first (`git rev-parse HEAD` in your worktree, before any change). Run the CLI with the flag on that unchanged code; inspect every file by eye; write the sha into the test's header comment (`goldens captured from <sha>`) and into the commit message; commit.
3. Add a short `README`-free header comment in the test describing the five cases and the one normalization.

**Validation**:
- [ ] 15 files exist (5 cases × 3).
- [ ] `.exit` files contain the bare number and a newline.
- [ ] `git diff --stat src/scripts` is empty.

### T010 – Golden test

**Steps**:
1. `src/tests/plantuml-include-check-golden.test.ts`: one `it` per case, runs the real CLI through `runCheck`, normalizes ports, and asserts `stdout`, `stderr` and `exit` equal the files byte for byte.
2. Also assert the US4 AS2 same-fixture positive control explicitly: `refuse-no-container` passes and `fetch` fails **with the same fixtures** (both runs read `src/scripts/fixtures/plantuml-remote-include/`).
3. Do not add the `--canary-port` equivalence assertion here (today's CLI rejects that flag with exit 2); WP07 adds it against these same golden files.

**Validation**:
- [ ] The test passes on today's code, three runs in a row (no flakiness from ports or timing).

### T011 – Fake-docker self-test

**Steps**:
1. `src/tests/plantuml-fake-docker.test.ts`: spawn the fake directly (async); assert the two accepted forms work, and that each near-miss exits **125** with `unexpected argv`: `docker ps`; `inspect c` (missing `-f`); `inspect -f '{{json .Config.Env}}' c extra` (extra arg); `exec c curl -s --max-time 5 -o /dev/null <url>` (wrong curl flag); `inspect -f '{{.Config.Env}}' c`. `DK_FAKE_DOCKER_FAIL=1` exits 1.
2. Assert determinism: two failing `exec` calls produce identical stderr.

**Validation**:
- [ ] Test passes; no real `docker` is ever invoked (assert `PATH` in the child starts with the fixture dir).

## Test Strategy

Characterization first (DIRECTIVE_034): these tests pass **today** and are ratchets (FR-007, SC-003). Black-box (DIRECTIVE_036): only the CLI's stdout, stderr and exit code are asserted. The only normalization is port numbers.

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-include-check-golden.test.ts src/tests/plantuml-fake-docker.test.ts`, then the full `pnpm test`.

### Golden validity under decision `01M6F4XFDPJ6XFBYM5HM65G1AM` (analyze A2)

From WP11 on, unset mode with `--service-container` reads the service profile after a passing check and requires `SANDBOX`. A `SANDBOX` profile prints nothing new, so the goldens **stay valid** for a correctly sandboxed service. Therefore the golden test sets `DK_FAKE_DOCKER_INSPECT_FILE` for every container case (`refuse-container`, `canary-unreachable`) to a committed file `src/tests/fixtures/plantuml-include-check/inspect-sandbox.json` (a JSON array with `PLANTUML_SECURITY_PROFILE=SANDBOX` plus a few image variables, e.g. `JAVA_HOME=/opt/java/openjdk`). Today's code never calls `inspect`, so the setting is harmless now and required later. Only a misconfigured service gains a failure (WP12 rows).

## Definition of Done

- [ ] Strict fake `docker`, harness, 15 golden files, `inspect-sandbox.json`, golden test and fake-docker test committed; every container golden case runs with the SANDBOX inspect file.
- [ ] Goldens were generated by running the CLI at a **recorded base sha** (in the test header and commit message), with `DK_UPDATE_GOLDENS=1`; the update mode refuses to run with `CI=true`.
- [ ] At least one **pass** golden (`refuse-no-container`, `refuse-container`) and one **fail** golden (`fetch`, `canary-unreachable`, `control-fails`), each with `.stdout`, `.stderr` and `.exit`.
- [ ] Fake-docker near-miss test green: `docker ps`, missing `-f`, extra args, wrong curl flag → exit 125.
- [ ] Harness: one normalization regex, async spawn only, `pathMode: 'node-only'` implemented and covered by one self-test (`runCheck` with node-only PATH still starts the CLI).
- [ ] No file under `src/scripts/` changed, and this WP's commit precedes any `src/scripts/` change on the mission branch (`git log --oneline -- src/scripts` after merge shows WP05/WP06/WP11 commits later).
- [ ] `pnpm test` and `pnpm lint` pass.
- [ ] The WP's commit is self-contained (goldens land before WP05 / WP11 change the guard or CLI).

## Risks

- Over-normalization hides regressions: normalize ports only.
- Timing-dependent output (none expected; the CLI prints no durations) — if any appears, stop and report.
- The exec bit on the fake `docker` lost on commit → tests fail on CI; check `git ls-files -s`.

## Reviewer Guidance

- Confirm `git diff` for this WP touches no `src/scripts/` file.
- Open two golden files and confirm they read like real CLI output, including the `note —` line and `FAIL —` lines.
- Confirm the fake `docker` rejects near-miss argv.

## Requirement trace

| Requirement | Subtask |
|---|---|
| FR-007, SC-003 (goldens, pass and fail) | T009, T010 |
| US4 AS1 (unset output matches golden) | T010 |
| US4 AS2 (same-fixture positive control) | T010 step 2 |
| C-003 groundwork (strict docker) | T007, T011 |

## Implement command

```bash
spec-kitty agent action implement WP02 --agent claude --mission plantuml-external-opt-in-01M6F052
```
