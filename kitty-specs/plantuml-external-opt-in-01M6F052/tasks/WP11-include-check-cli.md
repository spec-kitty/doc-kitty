---
work_package_id: WP11
title: Include-check CLI routing, flags, docker reader and verdict output
dependencies:
- WP01
- WP04
- WP06
requirement_refs:
- C-003
- C-006
- FR-004
- FR-005
- FR-006
- FR-013
- NFR-001
- FR-007
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: ff228ce4763eadd476829be21d1701494f408050
created_at: '2026-11-02T22:50:43.698971+00:00'
subtasks:
- T028
- T029
- T030
- T031
- T057
agent: claude
history:
- timestamp: '2026-11-02T23:30:00Z'
  agent: planner-priti
  action: Created by the post-tasks squad split of WP06
agent_profile: node-norris
authoritative_surface: src/scripts/assert-plantuml-no-remote-include.mjs
create_intent:
- src/scripts/plantuml-service-config.mjs
- src/tests/plantuml-service-config.test.ts
- src/tests/fixtures/plantuml-fake-docker/inspect-capture.json
execution_mode: code_change
model: opus
owned_files:
- src/scripts/assert-plantuml-no-remote-include.mjs
- src/scripts/plantuml-service-config.mjs
- src/scripts/fixtures/plantuml-remote-include-modes/**
- src/tests/plantuml-service-config.test.ts
- src/tests/fixtures/plantuml-fake-docker/inspect-capture.json
role: implementer
tags: []
---

# Work Package Prompt: WP11 – Include-check CLI routing, flags, docker reader and verdict output

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Turn WP06's decision module into the shipped command:

1. `src/scripts/plantuml-service-config.mjs`: the **only** code that runs `docker` for the declared-mode check: `readServiceEnv(container)` (`docker inspect -f {{json .Config.Env}} <c>`) and `dockerProbe(container)` (`docker exec <c> curl -sf --max-time 5 -o /dev/null <url>`).
2. `src/scripts/assert-plantuml-no-remote-include.mjs`: flags `--canary-port`, `--astro-config`, `--print-declared`; resolution of the declared value; routing (sandbox → today's path, byte-identical; else → `checkDeclaredMode`); printing of the `declared:` line, per-path lines, the stable verdict line, FAIL / warning / OK lines; exit codes 0 / 1 / 2.
3. R8 conditional fixtures from the spike.
4. The real inspect capture as a committed test fixture, and unit tests for the reader.

### Why this WP is gated on WP01

The spike can invalidate how the service's configuration is read: the shape of `docker inspect .Config.Env`, whether the service is a `services:` container or (fallback (a)) a `docker run` container named in a step, and whether `!import` / `!includesub` need fixtures. All three land here. If WP01 ends in RETURN TO OPERATOR, this WP and everything depending on it (WP07, WP08, WP09, WP10, WP12) are blocked; WP02–WP06 proceed.

### Spike findings that bind WP11 (research.md addendum, F1–F5)

- **F1 / D5 (`01M6F4BRKQ4E9H9Z41BYZH37MC`)**: a real INTERNET service refuses the private dotless canary. In declared modes the observed class is the **profile read from the container**; internet mode requires `--service-container` and passes only on `PLANTUML_SECURITY_PROFILE=INTERNET`; its canary results are informational. An INTERNET service whose allowlist holds the canary entry looks like allowlist to the canary — only the profile read catches it.
- **F2 / D6 (`01M6F4BVDASAREW2NVH23727CW`)**: an empty item in the service's `PLANTUML_ALLOWLIST_URL` other than one trailing `;` allows every URL; the configuration half fails on it.
- **F3**: a refused redirect renders **HTTP 200 with an empty diagram**; judge the redirect only from the request log.
- **F4**: PlantUML requests each included URL **twice**; test "at least one hit", never exact counts.
- **F5**: entries containing `@` never match; declared entries with `@` are rejected (WP03, edge case 9).

## Context

- contracts/include-check-cli.md (flags, exit codes, unset output frozen, declared output, every stable substring).
- research.md R2 (`--astro-config`, `null` → env-only, never read `_RESOLVED` from own env), R4 (strict argv), R7 (unset routing), R8, and the **WP01 spike addendum** (inspect shape, decision, R8 outcome).
- WP06: `checkDeclaredMode`, `MESSAGES`, `formatVerdictLine`, `parseContainerEnv`, `ServiceConfigError`.
- WP03: `resolvePlantumlAllowExternal`, `describeDeclared`, `PlantumlAllowExternalError`.
- WP04: `site-config-eval.mjs` now returns `plantumlAllowExternal` in `EvaluatedConfig`.
- WP02: strict fake `docker` and harness.

### The `evaluateSiteConfig` contract (pinned, `src/scripts/site-config-eval.mjs:118-135`)

```js
evaluateSiteConfig({ siteRoot, astroConfig, tool })
  → { configPath: string | null, siteDir: string, config: EvaluatedConfig | null }
```

- Call it as `evaluateSiteConfig({ siteRoot: path.dirname(path.resolve(astroConfig)), astroConfig, tool: 'assert-plantuml-no-remote-include' })`.
- Read the declared value from **`result.config.plantumlAllowExternal`** (added by WP04): a resolution object → use it; `null` (the config never called `defineDocKittyIntegrations`) → env-only fallback `resolvePlantumlAllowExternal({ env: process.env.DK_PLANTUML_ALLOW_EXTERNAL, siteValue: undefined })`.
- `result.config === null` cannot happen when `astroConfig` is given (it only means "no config file found"); treat it as the env-only fallback defensively.
- **Missing file**: `evaluateSiteConfig` throws a plain `Error` (`[<tool>] --astro-config <path>: no such file`) → print it on stderr and **exit 2**.
- **Config that fails to load / throws / times out** (including an invalid setting inside the config): `ConfigEvalError` → `evalRefusal(err, label)` text (`could not evaluate <path>` / `could not load …`) on stderr and **exit 2**.
- Import it **dynamically** inside the `--astro-config` branch only: `const { evaluateSiteConfig, evalRefusal } = await import('./site-config-eval.mjs');`. A top-level import pulls `gray-matter` and breaks the pre-install path (C-006). WP07 asserts this.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.
- WP01's evidence is committed to `feat/268-plantuml-external-opt-in` by the orchestrator before this lane starts; read it from `kitty-specs/plantuml-external-opt-in-01M6F052/spike/` and the research.md addendum in your worktree.

## Subtasks

### T057 – Inspect fixture and reader tests first

**Steps**:
1. Copy `kitty-specs/plantuml-external-opt-in-01M6F052/spike/inspect-capture.json` verbatim to `src/tests/fixtures/plantuml-fake-docker/inspect-capture.json` (WP07 and WP12 reuse it; they write temp copies with edits).
2. Create `src/tests/plantuml-service-config.test.ts`:
   - the committed fixture parses as a JSON array and contains `PLANTUML_SECURITY_PROFILE=` and an image-own variable (`JAVA_HOME=` or a `JETTY_` variable) — guards against a hand-written fixture;
   - `readServiceEnv('c')` with WP02's fake `docker` on `PATH` and `DK_FAKE_DOCKER_INSPECT_FILE` pointing at the fixture → env map with `PLANTUML_SECURITY_PROFILE: 'ALLOWLIST'` and the spike's `PLANTUML_ALLOWLIST_URL`;
   - a reversed-order copy of the fixture gives the same two values (order independence);
   - `DK_FAKE_DOCKER_FAIL=1` → `ServiceConfigError` with `could not read the service configuration`;
   - node-only `PATH` (WP02 harness `pathMode: 'node-only'` helper, or the same temp-dir technique) → `ServiceConfigError` (ENOENT mapped);
   - `DK_FAKE_DOCKER_LOG` shows exactly the argv `["inspect","-f","{{json .Config.Env}}","c"]` and, for `dockerProbe`, `["exec","c","curl","-sf","--max-time","5","-o","/dev/null","<url>"]`.

### T028 – `plantuml-service-config.mjs`

**Steps**:
1. `readServiceEnv(container)`: `execFile('docker', ['inspect', '-f', '{{json .Config.Env}}', container])`; parse with WP06's `parseContainerEnv`; callers pick `PLANTUML_SECURITY_PROFILE` and `PLANTUML_ALLOWLIST_URL` **by name** (the array also holds runner-injected `GITHUB_ACTIONS` / `CI` and the image's env, in varying order — spike Q6); map `ENOENT` and non-zero exit to `ServiceConfigError('could not read the service configuration (<reason>)')`.
2. `dockerProbe(container)` returns `async (url) => execFile('docker', ['exec', container, 'curl', '-sf', '--max-time', '5', '-o', '/dev/null', url])` — the same argv the unset path uses today.
3. The spike decision was **GO** (services block; fallback (a) not taken). The argv works with a service id or a container name alike.
4. Never `start`, `stop`, `run`, `rm` or `exec` anything else (C-003).

### T029 – Flags, resolution and routing

**Steps**:
1. Extend `parseArgs`: value flags `--server`, `--canary-host`, `--service-container`, `--canary-port` (integer 1–65535, else exit 2), `--astro-config`; boolean `--print-declared`. Unknown flags keep today's message and exit 2.
2. Resolve per the pinned contract above. `PlantumlAllowExternalError` → `assert-plantuml-no-remote-include: <message>` on stderr, exit 2, before any canary, render or docker call.
3. Never read `process.env.DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` (A2b). Grep for it before handing off: absent.
4. `--print-declared` → one JSON line `{"mode":…,"entries":[…],"source":…}`, exit 0; no canary, no render, no docker.
5. `mode === 'sandbox'` → today's code verbatim, passing `canaryPort` to `checkRemoteIncludesRefused` only when `--canary-port` was given. No new line in pass or fail, with or without `--astro-config` (decision `01M6F21BY4VJVWE4VY889F80CP`). **Plus, decision `01M6F4XFDPJ6XFBYM5HM65G1AM` (analyze A2)**: when `--service-container` is given and the unchanged check **passed**, call `readServiceEnv(container)` (keys by name) and WP06's `checkUnsetProfile(env)` **before** printing the `note —`/`OK —` lines. `SANDBOX` (and no Java system-property configuration) → print exactly today's lines: no new line on pass. Otherwise (other or absent profile, system properties) → `assert-plantuml-no-remote-include: FAIL — <message>` on stderr, exit 1. `ServiceConfigError` here → `FAIL — could not read the service configuration (<reason>)`, exit 1. Today's failure paths are untouched (the read happens only after a pass), so every golden stays byte-identical as long as the container cases' fake inspect returns `SANDBOX` (WP02).
6. Else → `checkDeclaredMode({ …, canaryPort: opts['canary-port'] ?? 18091, container, probe: container ? dockerProbe(container) : undefined, readEnv: readServiceEnv })`. Both allowlist **and internet** mode need `--service-container` (decision `01M6F4BRKQ4E9H9Z41BYZH37MC`); WP06 fails either without it.
7. Update the header usage comment.

### T030 – Output and exit codes

**Steps**:
1. First stdout line: `assert-plantuml-no-remote-include: declared: <describeDeclared(resolution)>`, ending with `; site configuration not read (no --astro-config)` when the flag was absent.
2. Per-path lines from `checkDeclaredMode`, each prefixed with the tool name.
3. Exactly one verdict line via `formatVerdictLine` for every declared-mode run (`observed no class` when it stopped before classification).
4. Failures `assert-plantuml-no-remote-include: FAIL — <message>` (stderr, exit 1); warning lines on stderr; OK on stdout (exit 0); exit 2 for usage, invalid setting, `--astro-config` errors, busy canary port.

### T031 – R8 conditional fixtures

**Spike outcome (GO addendum, R8)**: `!import` and `!includesub` fetch under **no** profile on the pinned image. So this subtask adds **no** fixture and no `extraFixtures` wiring; record "R8: no fixture needed (spike)" in the completion notes and confirm `src/scripts/fixtures/plantuml-remote-include-modes/` does not exist. The original conditional text follows for reference.

**Steps (conditional, not triggered)**: read the WP01 addendum's R8 outcome. If the pinned image fetches `!import` and / or `!includesub` under ALLOWLIST or INTERNET, add one fixture per fetching form to `src/scripts/fixtures/plantuml-remote-include-modes/` (same `{{CANARY_URL}}` convention), load them in the CLI and pass as `extraFixtures` in declared modes only. Never touch `src/scripts/fixtures/plantuml-remote-include/` (pinned; FR-007). Note a follow-up issue for the unset path. If neither fetches, add nothing and say so in the completion notes.

## Test Strategy

Reader unit tests here (T057). Command-level proofs: WP07 (9 cells, verdict-line shape, `--canary-port` golden equivalence, static-import guard, `--print-declared`) and WP12 (halves, edge cases, NFR-001, docker missing / erroring). Before handing off, run WP02's goldens and the existing guard test: unset output must be byte-identical.

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-service-config.test.ts src/tests/plantuml-include-check-golden.test.ts src/tests/plantuml-include-guard.test.ts`, then `pnpm test`, `pnpm lint`.

## Definition of Done

- [ ] `--astro-config` follows the pinned `evaluateSiteConfig` contract: `result.config.plantumlAllowExternal`; `null` → env-only; missing file → exit 2; `ConfigEvalError` → exit 2. Proven by WP09 (parity, `null` fixture) and WP12 (edge case for a missing file).
- [ ] `site-config-eval.mjs` imported only dynamically — proven by WP07's static-import row.
- [ ] Forged `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` in the CLI's own env is never read — `grep -n _RESOLVED src/scripts/assert-plantuml-no-remote-include.mjs` is empty; proven by WP09's forged-handoff case.
- [ ] Allowlist mode cannot pass without the container (WP12 "no container" row), both probes (WP12 row b), profile `ALLOWLIST` (row c1), equal entries (rows c2, c3) and no empty item (row c4).
- [ ] Internet mode cannot pass without the container (WP12 row i) or with a profile other than `INTERNET` (row ii); WP07 M9 passes with a fake that refuses the canary and an `INTERNET` inspect.
- [ ] R8: no fixture added (spike: neither form fetches).
- [ ] Unset mode with a container: a misconfigured service gains a failure, nothing else changes; profile read only after a passing check; `SANDBOX` → output byte-identical to the goldens (WP02 golden test green); other or absent profile → exit 1 with the `opt-in unset (sandbox), but …` message (WP12 rows u1–u5; WP07 M2d, M3c).
- [ ] Every cell's message matches the contract — proven by WP07's 9 matrix rows.
- [ ] Unset output byte-identical: WP02 goldens unchanged and green.
- [ ] Inspect fixture is the verbatim spike capture; T057 green; `pnpm test`, `pnpm lint` pass.

## Risks

- A static import of `site-config-eval.mjs` breaks the CI lane, which runs before install.
- Any new unset-mode line breaks FR-007.
- A docker argv differing from the strict fake's two forms makes every container test fail (good), so keep them identical.

## Reviewer Guidance

- Compare the `--astro-config` branch line by line against the pinned contract above.
- Run the CLI once with `--print-declared` and once with a missing `--astro-config` path.
- Confirm only `plantuml-service-config.mjs` imports `node:child_process` for declared mode (the unset path's existing import stays).

## Requirement trace

| Requirement | Subtask | Proof |
|---|---|---|
| FR-004 (c) reading half | T028 | WP12 rows c1–c3 |
| FR-005 output | T030 | WP07 matrix |
| FR-013 check half | T029 | WP09 parity |
| NFR-001 | T029 (never fetches entries) | WP12 NFR-001 pair |
| C-003 | T028 | T057 argv log; WP12 strict-argv row |
| C-006 | T029 | WP07 static-import row |

## Implement command

```bash
spec-kitty agent action implement WP11 --agent claude --mission plantuml-external-opt-in-01M6F052
```
