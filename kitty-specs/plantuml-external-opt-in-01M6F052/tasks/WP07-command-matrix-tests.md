---
work_package_id: WP07
title: Command-level 9-cell matrix tests
dependencies:
- WP01
- WP11
requirement_refs:
- C-006
- FR-005
- FR-011
- SC-002
- FR-007
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: ff212135cabbe4816091707303c7d3934b835589
created_at: '2026-11-02T23:11:49.054936+00:00'
subtasks:
- T033
- T034
- T059
agent: claude
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-02T23:30:00Z'
  agent: planner-priti
  action: Split per post-tasks squad (halves, edge cases and NFR-001 moved to WP12)
agent_profile: implementer-ivan
authoritative_surface: src/tests/plantuml-include-check-cli.test.ts
create_intent:
- src/tests/plantuml-include-check-cli.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/tests/plantuml-include-check-cli.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP07 – Command-level 9-cell matrix tests

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `implementer-ivan`, or run
  `spec-kitty agent profile show implementer-ivan`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Prove, **through the real command** (`node src/scripts/assert-plantuml-no-remote-include.mjs`), with fake PlantUML services and WP02's strict fake `docker`:

- all 9 cells of the declared × observed matrix (FR-005, FR-011, SC-002);
- the output shape: one `declared:` first line and exactly one verdict line in declared modes; neither in unset mode;
- the C-006 guard (no static import of `site-config-eval.mjs`), `--print-declared`, and the FR-007 `--canary-port` golden equivalence.

The half-removal table, edge cases 1–10, the NFR-001 pair and the docker-failure cases are **WP12** (its own test file). This WP adds tests only; a bug found in `src/scripts/` goes back through review, never fixed here.

### Spike findings that bind this WP

F1 / D5: in declared modes the observed class is the **profile read from the container**; internet mode requires `--service-container` and a real INTERNET service **refuses** the private canary. So every declared-mode row runs with `--service-container fake` and an inspect file whose `PLANTUML_SECURITY_PROFILE` sets the column. F4: fakes should request each fetched include twice (harness `fetchCount: 2`) in the declared rows; assertions never count exact hits.

## Context

- contracts/include-check-cli.md: the stable substrings per cell — **your oracle**.
- data-model.md §3, §6; research.md R13 (free ports).
- WP02 harness `src/tests/helpers/plantuml-check-harness.ts`: `startFakePlantuml(policy, options)` with `prefixPolicy(prefixes)`, `followRedirects`, `strayPath`; `runCheck(args, { env, fakeDocker, pathMode })` (async spawn); `freePort()`; `normalizePorts(text)` (one regex); `FAKE_DOCKER_DIR`. WP02 fake `docker` switches: `DK_FAKE_DOCKER_INSPECT_FILE`, `DK_FAKE_DOCKER_FAIL`, `DK_FAKE_DOCKER_EXEC_FAIL`, `DK_FAKE_DOCKER_EXEC_FAIL_MATCH`, `DK_FAKE_DOCKER_LOG`.
- WP11: `src/tests/fixtures/plantuml-fake-docker/inspect-capture.json` (verbatim spike capture). Write temp copies with edited `PLANTUML_SECURITY_PROFILE=` / `PLANTUML_ALLOWLIST_URL=` entries per test.
- WP02 goldens in `src/tests/fixtures/plantuml-include-check/`.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.
- Depends on WP01 explicitly: the inspect capture originates from the orchestrator-run spike, committed to `feat/268-plantuml-external-opt-in` before this lane starts.

## Subtasks

### T033 – Matrix service fixtures

**Steps**:
1. In the test file, build services from WP02's harness options:
   - `sandboxService` — refuses every URL include.
   - `allowlistService(prefixes)` — `prefixPolicy(prefixes)`: fetch iff the URL starts with an entry (raw `startsWith`); no redirect following.
   - `internetService` — the **realistic** internet fake: refuses the canary paths (as the pinned image does for dotless, inner-network hosts, F1). Use it with an inspect profile `INTERNET`.
   - `fetchAllService` — fetches everything, follows redirects (a non-real behaviour, used only where a row needs the canary to see a denied fetch).
2. Sanity-assert each service directly once (e.g. `allowlistService([canary])` refuses a denied URL when called with a crafted request), so a permissive fake cannot make a row pass for the wrong reason.
3. Every test binds a free `--canary-port` from `freePort()`; **never 18091**. `--canary-host 127.0.0.1`.
4. Declared allowlist entry: `http://127.0.0.1:<p2>/dk-declared/` pointing at a second local server (no request to it is expected; WP12 asserts that).

### T034 – The 9-cell matrix

**Steps**: `describe('matrix (9 cells)')` with `it.each` rows `{ declared, service, container, exit, mustContain[] }`:

| # | Declared (env) | Service | Exit | Must contain |
|---|---|---|---|---|
| M1 | unset | sandbox | 0 | output equals `golden-unset-refuse-no-container` after `normalizePorts` |
| M2 | unset | allowlist(canary entry), with `--canary-port <p>`, no container | 1 | `the server FETCHED the remote include` |
| M2c | unset | allowlist(canary entry), matching `--canary-host`/`--canary-port`, `--service-container fake`, inspect profile `ALLOWLIST` | 1 | `the server FETCHED the remote include` (behavioural half fails first; no profile read — contract row "canary entry allowlisted") |
| M2d | unset | `allowlistService([other entry])` (canary **not** allowlisted), `--service-container fake`, inspect profile `ALLOWLIST` | 1 | `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"` (behavioural half passed; profile read fails — contract row "canary entry not allowlisted") |
| M3 | unset | `fetchAllService`, no container — **fake-only proof**: the real INTERNET image refuses the private canary, so without a container this cell is undetectable (spec Limits) | 1 | `the server FETCHED the remote include` |
| M3c | unset | `internetService` (refuses the canary, like the real image), `--service-container fake`, inspect profile `INTERNET` | 1 | `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "INTERNET"` |
| M4 | allowlist | sandbox | 1 | `declared allowlist, but the allowed path was refused`, `(observed: sandbox)`, `/dk-canary/allowed/` |
| M5 | allowlist | allowlist(declared + canary), container, inspect equal | 0 | `OK — declared allowlist matches the service`, `verdict: declared allowlist, observed allowlist` |
| M6 | allowlist | `allowlistService([declared, canary])` (canary looks like allowlist), inspect profile `INTERNET` | 1 | `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is "INTERNET"`, `(observed: internet)` (F1 ii) |
| M6b | allowlist | `fetchAllService`, inspect profile `INTERNET` | 1 | the M6 substrings **and** `declared allowlist, but the denied path was fetched`, `/dk-canary/denied/` |
| M7 | internet | sandbox, inspect profile `SANDBOX` | 1 | `declared internet, but the service's PLANTUML_SECURITY_PROFILE is "SANDBOX"`, `(observed: sandbox)` |
| M8 | internet | allowlist(canary), inspect profile `ALLOWLIST` | 1 | `declared internet, but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"`, `(observed: allowlist)` |
| M9 | internet | `internetService` (refuses the canary), inspect profile `INTERNET` | 0 | stderr `warning — declared internet`, stdout `OK — declared internet matches the service`, `verdict: declared internet, observed internet` |

Every declared row (M4–M9) passes `--service-container fake` with the fake `docker` on `PATH` and a temp inspect file (copy of WP11's fixture with the row's profile; M5 also the row's allowlist).

### T059 – Output shape, C-006, `--print-declared`, FR-007 equivalence

**Steps**:
1. Declared rows (M4–M9, M6b): stdout's first line starts `assert-plantuml-no-remote-include: declared: `; exactly one line matches `/verdict: declared (allowlist|internet), observed (sandbox|allowlist|internet|no class)$/`.
2. Unset rows (M1–M3): **no** `declared:` line and **no** `verdict:` line.
3. C-006: read `src/scripts/assert-plantuml-no-remote-include.mjs` as text; assert no line matching `/^import .*site-config-eval/m`, and a dynamic `import('./site-config-eval.mjs')` exists. Also assert `src/scripts/plantuml-mode-check.mjs`, `plantuml-include-guard.mjs` and `src/lib/plantuml-external.mjs` have only `node:` or relative top-level imports.
4. `--print-declared` with env `internet`: exactly one stdout line, valid JSON `{"mode":"internet","entries":[],"source":"environment"}`, exit 0, and the fake service logged 0 requests.
5. FR-007 equivalence: re-run all five WP02 golden cases with `--canary-port <free port>` added; output after `normalizePorts` equals the same golden files.

## Test Strategy

Black-box (DIRECTIVE_036): spawn the real CLI, assert exit code plus **stable substrings** (DIRECTIVE_041). Free ports per test.

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-include-check-cli.test.ts`, then the full suite.

## Definition of Done

- [ ] Rows M1–M9, M2c, M2d, M3c and M6b green, each with its exit code and every listed substring; M9 passes with a fake that refuses the canary (the real image's behaviour, F1).
- [ ] T059 items 1–5 green.
- [ ] Stability: `pnpm test` (full suite, default workers) passes **three consecutive runs**.
- [ ] `grep -n 18091 src/tests/plantuml-include-check-cli.test.ts` returns nothing.
- [ ] No file outside `src/tests/plantuml-include-check-cli.test.ts` changed.

## Risks

- A permissive fake makes rows pass for the wrong reason; T033 step 2 guards it.
- Port collisions under parallel workers: free ports only.

## Reviewer Guidance

- Check each row's substrings against contracts/include-check-cli.md.
- Check unset rows assert the **absence** of `declared:` and `verdict:`.
- Temporarily change one message in WP06's `MESSAGES` locally and confirm exactly the expected matrix row goes red; revert.

## Requirement trace

| Requirement | Subtask |
|---|---|
| FR-005, FR-011, SC-002 | T034 |
| C-006 | T059.3 |
| FR-007 (`--canary-port` equivalence) | T059.5 |

## Implement command

```bash
spec-kitty agent action implement WP07 --agent claude --mission plantuml-external-opt-in-01M6F052
```
