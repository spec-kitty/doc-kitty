---
work_package_id: WP06
title: Declared-mode classifier, verifier and verdict messages (no CLI, no docker)
dependencies:
- WP03
- WP05
requirement_refs:
- FR-004
- FR-005
- FR-006
- NFR-001
- FR-007
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: a2f0be2ca418ed02b2dff628724bbddd96879470
created_at: '2026-11-02T22:35:44.946673+00:00'
subtasks:
- T026
- T027
- T058
- T032
agent: claude
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-02T23:30:00Z'
  agent: planner-priti
  action: Split per post-tasks squad (CLI and docker reader moved to WP11)
agent_profile: node-norris
authoritative_surface: src/scripts/plantuml-mode-check.mjs
create_intent:
- src/scripts/plantuml-mode-check.mjs
- src/tests/plantuml-mode-check.test.ts
execution_mode: code_change
model: opus
owned_files:
- src/scripts/plantuml-mode-check.mjs
- src/tests/plantuml-mode-check.test.ts
role: implementer
tags: []
---

# Work Package Prompt: WP06 – Declared-mode classifier, verifier and verdict messages (no CLI, no docker)

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Build the security-critical **decision logic** of the declared-mode include check as one module, `src/scripts/plantuml-mode-check.mjs`, with **no CLI and no docker**:

1. Pure functions: `canaryEntry`, `classifyObserved` (three classes or no class), `compareAllowlist` (raw set comparison), `parseContainerEnv`, `systemPropertyConfig`.
2. Message and verdict builders producing every stable substring in contracts/include-check-cli.md, and the one verdict line.
3. `checkDeclaredMode(...)`: the orchestration over the canary (WP05) and the PlantUML server, with **injected** `probe(url)` and `readEnv(container)` functions. It never spawns `docker` itself; WP11 supplies the real `readEnv` (docker inspect) and `probe` (docker exec curl).

The CLI (`assert-plantuml-no-remote-include.mjs`), its flags, the docker reader and the R8 fixtures are **WP11**, not here.

### Why this WP is not gated on WP01 (the spike)

Everything here is pure logic or talks only to the canary and an HTTP render endpoint passed in by the caller. The spike (WP01) can change *how* the service configuration is read (the `docker inspect` output shape, or fallback (a)'s `docker run` step) and whether extra fixture forms exist; both live in WP11. Classification, the 3×3 verdict table and the messages do not depend on any spike outcome. If the spike returns to the operator, this WP still proceeds.

### Spike findings that bind this WP (research.md addendum, F1–F5)

- **F1 / D5 (`01M6F4BRKQ4E9H9Z41BYZH37MC`)**: a real INTERNET service refuses the private dotless canary. In declared modes the observed class is the **profile read from the container**; internet mode requires `--service-container` and passes only on `PLANTUML_SECURITY_PROFILE=INTERNET`; its canary results are informational. An INTERNET service whose allowlist holds the canary entry looks like allowlist to the canary — only the profile read catches it.
- **F2 / D6 (`01M6F4BVDASAREW2NVH23727CW`)**: an empty item in the service's `PLANTUML_ALLOWLIST_URL` other than one trailing `;` allows every URL; the configuration half fails on it.
- **F3**: a refused redirect renders **HTTP 200 with an empty diagram**; judge the redirect only from the request log.
- **F4**: PlantUML requests each included URL **twice**; test "at least one hit", never exact counts.
- **F5**: entries containing `@` never match; declared entries with `@` are rejected (WP03, edge case 9).

## Context

- plan.md "The check's decision flow" (mermaid); IC-06.
- contracts/include-check-cli.md — stable substrings per cell, half-specific substrings, "other stable substrings", verdict line.
- data-model.md §2 (canary), §3 (classes), §4 (service config rules), §5 (Verdict type), §6 (3×3 table and additional failing states).
- research.md R3, R4 (raw set comparison; Java system properties fail closed), R11 (classes), R12 (internet and the container).
- `src/scripts/plantuml-include-guard.mjs` after WP05: `startCanary({ port, redirectBase })`, `CANARY_ALLOWED_PREFIX`, `CANARY_DENIED_PREFIX`, `CANARY_DENIED_MARKER`, `encodePlantuml`, `loadFixtures`.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.

## Subtasks

### T032 – Unit tests first

**Purpose**: pin the pure decision logic before writing it (DIRECTIVE_034).

**Steps**: create `src/tests/plantuml-mode-check.test.ts`:
1. `canaryEntry('dk-canary', 18091)` → `http://dk-canary:18091/dk-canary/allowed/`.
2. `profileClass(env)`: `SANDBOX` → `'sandbox'`, `ALLOWLIST` → `'allowlist'`, `INTERNET` → `'internet'`, anything else or missing → `null` (exact, case-sensitive). `classifyObserved(perFixture)` (the **behavioural** class) where each element is `{ allowed: boolean, denied: boolean }` (**at least one** `include/` hit under that prefix; build inputs from a log where each fetched URL appears **twice**, F4): all `{F,F}` → `'sandbox'`; all `{T,F}` → `'allowlist'`; all `{T,T}` → `'internet'`; any `{F,T}` → `null`; fixtures disagreeing (`{T,F}` + `{T,T}`) → `null`.
3. `compareAllowlist(configuredText, declared, canary)` → `{ extra, missing, emptyItems, expected }`: split on `;`; one trailing empty item (a single trailing `;`) is ignored, **any other empty item sets `emptyItems: true`** (F2: it allows every URL); **no trimming, no normalization**, set semantics. Rows: same entries different order → no diff; duplicate → no diff; `…/x` vs `…/x/` → one extra and one missing; leading space → differs (PlantUML would trim; the check stays raw and fails safe); `HTTP://…` vs `http://…` → differs; trailing `;` → equal; `;http://…` → `emptyItems`; `a;;b` → `emptyItems`; `expected` is `[...declared, canary].join(';')`.
4. `parseContainerEnv('["A=1","B=x=y"]')` → `{ A: '1', B: 'x=y' }`; keys are looked up **by name** — a shuffled copy of the spike capture (with `GITHUB_ACTIONS=true`, `CI=true` first) yields the same two `PLANTUML_*` values; non-JSON or non-array → throws `ServiceConfigError` with `could not read the service configuration`.
4b. Empty items are reported **only** through `emptyItems`: `compareAllowlist(';http://a/;<canary>', ['http://a/'], canary)` → `emptyItems: true`, `extra: []`, `missing: []` (the empty string never appears in `extra` or `missing`; analyze A8).
4c. `checkUnsetProfile(env)` (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`): `PLANTUML_SECURITY_PROFILE=SANDBOX` → ok; `INTERNET`/`ALLOWLIST`/other → failure message `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "<v>"`; key absent → `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is not set (the image default is INTERNET)`; `systemPropertyConfig(env)` true → the existing `configured through Java system properties…` message even when the profile is `SANDBOX` (fails closed exactly as the declared modes; re-analyze B3). Rule order: system properties first, then the profile.
5. `systemPropertyConfig(env)` true for `JAVA_OPTS`, `JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, `CATALINA_OPTS` carrying a `-D` property named `plantuml.*`/`PLANTUML_*` in any case or separator (incl. `-DPLANTUML_SECURITY_PROFILE=INTERNET`), or any env key named `plantuml.*`; false otherwise.
6. Message builders: for each of the 9 cells and each "other stable substring" in the contract, the builder output contains the listed substrings; every declared-mode failure message contains `declared <mode>` and `(observed: <class>)` or `(observed: no class)`.
7. `formatVerdictLine({ declared, observed })` → `assert-plantuml-no-remote-include: verdict: declared allowlist, observed allowlist` / `observed no class`.
8. `checkDeclaredMode` with fake injected functions and a tiny in-test fake PlantUML server (use WP02's `startFakePlantuml` from `src/tests/helpers/plantuml-check-harness.ts`): one passing allowlist run; one passing internet run where the fake **refuses both canary paths** (as the real image does, F1) and `readEnv` returns `INTERNET`; one internet run whose fake fetches both paths but `readEnv` returns `ALLOWLIST` (fails); one allowlist run where the canary looks like allowlist but `readEnv` returns `INTERNET` (fails, F1 ii); allowlist and internet runs without `container` (each fails before starting the canary — assert the canary port stays free); one redirect run where the fake answers the redirect render with HTTP 200 and an empty diagram without fetching the target (passes: F3).

### T026 – Pure functions

**Steps**:
1. Create the module; Node built-ins only at top level (it is loaded by the pre-install CLI path; C-006). It imports only from `./plantuml-include-guard.mjs`.
2. Header comment: what each mode proves, and the spec's Limits (what it cannot prove).
3. Export `checkUnsetProfile` (unset-mode rule, used by WP11 after the unchanged unset check passes), `canaryEntry`, `profileClass`, `classifyObserved`, `compareAllowlist`, `parseContainerEnv`, `systemPropertyConfig`, `ServiceConfigError`.
4. JSDoc the `Verdict` type exactly as data-model.md §5.

### T058 – Message and verdict builders

**Purpose**: one place owning every stable string, so WP11 prints and WP07 / WP12 assert the same text.

**Steps**:
1. Export `MESSAGES` (functions) and `formatVerdictLine`. Required texts (verbatim substrings from contracts/include-check-cli.md):
   - `declared allowlist, but the allowed path was refused` (+ `(observed: sandbox)`, path `/dk-canary/allowed/`)
   - `declared allowlist, but the denied path was fetched` (+ `/dk-canary/denied/`)
   - `the service's PLANTUML_ALLOWLIST_URL has an empty entry, which allows every URL` (F2; the empty item never appears in `extra:` / `missing:`)
   - `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "<v>"` and `… is not set (the image default is INTERNET)` (unset mode with a container, decision `01M6F4XFDPJ6XFBYM5HM65G1AM`)
   - `declared allowlist, but the service's allowlist differs` with `extra: <…>` only when non-empty, `missing: <…>` only when non-empty, `expected PLANTUML_ALLOWLIST_URL=<…>`
   - `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is "<v>"`
   - `declared internet, but the service's PLANTUML_SECURITY_PROFILE is "<v>"` (+ `(observed: <profile class|no class>)`)
   - `declared internet needs --service-container to read the service's security profile`
   - `declared allowlist needs --service-container to prove the denied path was reachable and the entries match`
   - `the canary's <allowed|denied> path is not reachable from the service, so its <fetch|refusal> proves nothing`
   - `the allowed path's redirect to the denied path was followed`
   - `the canary received a request outside its two paths: <path>`
   - `inconsistent fetches` (+ per-fixture results)
   - `configured through Java system properties; the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL`
   - `could not read the service configuration (<reason>)`
   - `cannot listen on canary port <n>` (exit 2)
   - OK texts: `OK — declared allowlist matches the service: …`, `OK — declared internet matches the service`; warning `warning — declared internet: the service may fetch any URL, including internal networks and cloud metadata endpoints`.
2. Keep `extra: ` and `missing: ` absent when empty: the half-removal rows (WP12) assert their absence.

### T027 – `checkDeclaredMode`

**Signature**: `checkDeclaredMode({ declared, serverUrl, canaryHost = '127.0.0.1', canaryPort = 18091, container, probe, readEnv, fixtures = loadFixtures(), extraFixtures = [], fetchImpl = fetch, timeoutMs })` → `{ verdict, lines }` where `lines` are per-path output lines. `readEnv(container)` returns the parsed env map or throws `ServiceConfigError`.

**Steps** (follow plan.md's flowchart):
1. Allowlist or internet without `container` → fail immediately (exit 1) with that mode's "needs --service-container" message, before starting the canary.
2. `startCanary({ port: canaryPort, redirectBase: \`http://${canaryHost}:${canaryPort}\` })`; busy port → verdict exit 2.
3. Control render with today's texts (`control: the PlantUML server at … did not answer`, `control: a plain diagram did not render`).
4. Probes: allowlist probes `<allowed>probe` and `<denied>probe` via `probe`; a probe whose path is not in the canary log afterwards → the not-reachable message (exit 1). Internet mode runs the probes too, but only prints their result (informational, R12).
5. For each fixture (plus `extraFixtures`, which WP11 passes when R8 says so): render against `<allowed>include/<f>`, `<denied>include/<f>`, `<allowed>redirect/<f>`; record per-path hits from the log (**at least one** hit = fetched; PlantUML requests twice, F4; a hit counts even if the render then errors). Line: `<fixture> → <allowed|denied|redirect>: HTTP <status>, canary requests <n>`.
6. Redirect followed = a log hit under `/dk-canary/denied/redirected/` → fails allowlist; informational in internet mode. **Never** infer it from the HTTP status: the pinned image answers a refused redirect with HTTP 200 and an empty diagram (F3).
7. Stray request: any log entry outside the two prefixes → fail (NFR-001).
8. Read the configuration: `readEnv(container)` (both declared modes): `ServiceConfigError` → `could not read the service configuration`; system properties → fail. `observed = profileClass(env)` — this is the class on the verdict line (F1).
9. Allowlist: fail unless `observed === 'allowlist'` (profile message otherwise, e.g. an INTERNET service whose canary behaviour looks like allowlist, F1 ii) **and** the behavioural class is allowlist (allowed fetched, denied refused; their own messages otherwise) **and** `compareAllowlist` has no `extra`, `missing` or `emptyItems`. Report every failing half, not only the first.
10. Internet: fail unless `observed === 'internet'`; canary results are printed but not judged. Pass → warning + OK.
11. `finally` closes the canary. The function never requests a declared entry's URL (NFR-001).

## Test Strategy

Unit tests (T032) here. Command-level proofs live in WP07 (9-cell matrix) and WP12 (half-removal table, edge cases, NFR-001 pair). This WP must leave WP02's goldens and `plantuml-include-guard.test.ts` green (it does not touch the unset path).

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-mode-check.test.ts`, then `pnpm test`, `pnpm lint`.

## Definition of Done

- [ ] `plantuml-mode-check.mjs` exports the pure functions, `MESSAGES`, `formatVerdictLine`, `ServiceConfigError`, `checkDeclaredMode`; no `node:child_process` import (no docker here).
- [ ] T032 rows 1–8 green.
- [ ] FR-004 (a) is the code WP12 row **a** removes; (b) row **b**; (c) rows **c1, c2, c3, c4**; unset-profile rows **u1, u2** (`checkUnsetProfile`); FR-006 rows **i, ii**; the 9 matrix outcomes are WP07's rows. Each named code location is listed in the completion notes so WP12's mutation record can cite file:line.
- [ ] `pnpm test` and `pnpm lint` pass; WP02 goldens unchanged and green.

## Risks

- Trimming or normalizing in `compareAllowlist` hides real mismatches.
- Counting a hit only on a successful render misclassifies a fetch that errors; expecting exactly one hit breaks on PlantUML's double request (F4).
- Judging internet mode by canary fetches would fail every real internet-mode service (F1).
- Printing `extra: ` with an empty list breaks WP12's absence assertions.

## Reviewer Guidance

- Walk data-model.md §6 (table and additional failing states) and find the code line for each.
- Confirm no `child_process` import and no CLI parsing.

## Requirement trace

| Requirement | Subtask | Command-level proof |
|---|---|---|
| FR-004 (a)(b)(c) | T027, T058 | WP12 rows a, b, c1–c3 |
| FR-005 | T027, T058 | WP07 matrix (9 cells) |
| FR-006 (container required; profile INTERNET) | T027 steps 1, 10 | WP12 rows i, ii |
| NFR-001 | T027 steps 7, 10 | WP12 NFR-001 pair |

## Implement command

```bash
spec-kitty agent action implement WP06 --agent claude --mission plantuml-external-opt-in-01M6F052
```
