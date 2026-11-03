---
work_package_id: WP12
title: Half-removal table, edge cases 1–10, NFR-001 pair, unset-profile rows and mutation record
dependencies:
- WP11
requirement_refs:
- C-003
- FR-002
- FR-004
- FR-006
- FR-011
- NFR-001
- FR-007
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 7f34d7be1e062510d45ceb27ad56d7af7f959419
created_at: '2026-11-02T23:12:37.099619+00:00'
subtasks:
- T035
- T036
- T037
- T060
agent: claude
history:
- timestamp: '2026-11-02T23:30:00Z'
  agent: planner-priti
  action: Created by the post-tasks squad split of WP07
agent_profile: implementer-ivan
authoritative_surface: src/tests/plantuml-include-check-halves.test.ts
create_intent:
- src/tests/plantuml-include-check-halves.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/tests/plantuml-include-check-halves.test.ts
role: implementer
tags: []
---

# Work Package Prompt: WP12 – Half-removal table, edge cases 1–10, NFR-001 pair, unset-profile rows and mutation record

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `implementer-ivan`, or run
  `spec-kitty agent profile show implementer-ivan`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

In a new test file `src/tests/plantuml-include-check-halves.test.ts`, through the **real command**:

1. The table-driven half-removal proofs (FR-004 a, b, c1–c3; FR-006 i, ii): each row differs from a passing baseline in exactly one half, asserts its own substring **and the absence of every other row's substring** (post-plan N3).
2. Edge cases 1–10 at the command (FR-011, FR-002; 10 is half-removal row c4).
3. The NFR-001 pair, docker missing and erroring, Java system properties, no container, strict-argv log (C-003), busy canary port.
4. A recorded manual mutation pass (USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY).

Tests only; bugs in `src/scripts/` go back through review.

### Spike findings that bind this WP

F1 / D5: internet mode is verified by the container's profile (container required); its canary results are informational, so the FR-006 halves are now (i) the container requirement and (ii) the profile comparison. F2 / D6: an empty item in the service's allowlist fails (new row c4). F3: a refused redirect renders HTTP 200 with an empty diagram; the redirect cell is judged from the request log. F4: fakes request each include twice; never assert exact counts. F5: entries with `@` are rejected (edge case 9).

## Context

- contracts/include-check-cli.md: "Half-specific substrings" and "Other stable substrings" tables.
- research.md R13 (half-removal design, NFR-001, free ports); data-model.md §6.
- WP02 harness and fake `docker` (switches incl. `DK_FAKE_DOCKER_EXEC_FAIL_MATCH`, `DK_FAKE_DOCKER_LOG`; `runCheck({ pathMode: 'node-only' })`).
- WP11 fixture `src/tests/fixtures/plantuml-fake-docker/inspect-capture.json` (temp copies with edits per row).
- WP06 completion notes: the code location of each half (for the mutation record).

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.

## Subtasks

### T035 – Half-removal table

**Steps**:
1. `describe('half-removal table')`. Baseline row: allowlist declared, `allowlistService([declared, canary])`, container, inspect equal → exit 0.
2. Rows, by name, each exit 1 (fakes use `fetchCount: 2`, F4):

| Row | One difference from the baseline | Own substring |
|---|---|---|
| a | service refuses the allowed path | `the allowed path was refused` |
| b | `DK_FAKE_DOCKER_EXEC_FAIL_MATCH=/dk-canary/denied/` (only the denied probe fails) | `the canary's denied path is not reachable from the service` |
| c1 | inspect `PLANTUML_SECURITY_PROFILE=SANDBOX` | `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is` |
| c2 | inspect allowlist has one extra entry | `extra: ` |
| c3 | inspect allowlist lacks the declared entry | `missing: ` |
| c4 | inspect allowlist is `;` + the expected entries (a leading empty item) | `has an empty entry, which allows every URL` |
| i | internet declared, baseline-internet setup but **no** `--service-container` | `declared internet needs --service-container to read the service's security profile` |
| ii | internet declared, container named, inspect profile `ALLOWLIST` | `declared internet, but the service's PLANTUML_SECURITY_PROFILE is` |

A second baseline for rows i and ii: internet declared, container named, inspect profile `INTERNET`, service refusing the canary (the real behaviour, F1) → exit 0. Row c1's own substring is `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is`, so it stays distinct from row ii's.

3. Each row asserts its own substring present **and every other row's substring absent** (loop over the table).

### T036 – Edge cases 1–9 at the command (edge case 10 = row c4)

**Steps** (`describe('edge cases at the command')`):
1. Malformed env (`yes`, `INTERNET`, `ftp://a/`, `https://a.example/a@b/` — edge case 9, F5) → exit 2, `invalid DK_PLANTUML_ALLOW_EXTERNAL (environment)`, `accepted:`; the fake service logged **0** requests and the fake docker log is empty (failed before rendering or probing).
2. Empty allowlist (`;`) → exit 2, `an empty allowlist is not sandbox`.
3. Bare host (`http://host`) → exit 2, `must end with "/"`.
4. `;` inside an entry is the env separator: `--print-declared` with `https://a.example/x/;https://b.example/y/` prints two entries. (The site-value `;` rejection is WP03's unit test and WP09's fixture territory.)
5. Empty env `""` → unset: output equals `golden-unset-refuse-no-container` after normalization.
6. Env set → `--print-declared` prints `"source":"environment"`.
7. Canary unreachable: allowlist with `DK_FAKE_DOCKER_EXEC_FAIL=1` → exit 1, `the canary's allowed path is not reachable`; unset → equals golden `canary-unreachable`.
8. Redirect: `startFakePlantuml(prefixPolicy([declared, canary]), { followRedirects: true })` → exit 1, `the allowed path's redirect to the denied path was followed`. The non-following service answers the redirect render with **HTTP 200 and an empty diagram** (as the pinned image does, F3) and the run **passes** — proving the verdict comes from the request log, not the status.
9. `--astro-config` naming a missing file → exit 2, `no such file`.

### T037 – NFR-001, docker failures, C-003, misc

**Steps**:
1. **NFR-001 pair**: on the passing baseline run, the declared-entry server (`http://127.0.0.1:<p2>/dk-declared/`) logged **0** requests. Positive control: `startFakePlantuml(prefixPolicy(...), { strayPath: '/dk-canary/stray' })` → exit 1, `the canary received a request outside its two paths: /dk-canary/stray`.
2. **Docker missing**: `runCheck(args, { pathMode: 'node-only' })` — the harness builds a temp dir holding only a symlink to `process.execPath` (named `node`) and uses **only** that dir as `PATH` — allowlist mode → exit 1, `could not read the service configuration`. Docker erroring: `DK_FAKE_DOCKER_FAIL=1` → same substring.
3. Java system properties: inspect adds `JAVA_OPTS=-Dplantuml.security.profile=INTERNET` → exit 1, `configured through Java system properties`.
4. Allowlist without `--service-container` (US1 AS3) → exit 1, `declared allowlist needs --service-container`. (Internet without it is half-removal row i.)
5. C-003 strict argv: with `DK_FAKE_DOCKER_LOG`, every logged argv on the baseline run is exactly the inspect or the exec-curl form.
6. Busy canary port → exit 2, `cannot listen on canary port`.
7. **Unset-mode profile rows** (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`, analyze A2), opt-in unset, fake service refusing the canary (passes today's check), `--service-container fake`:
   - **u0** baseline: inspect `PLANTUML_SECURITY_PROFILE=SANDBOX` → exit 0 and output equal to golden `refuse-container` after normalization (no new line).
   - **u1**: inspect `PLANTUML_SECURITY_PROFILE=INTERNET` → exit 1, `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "INTERNET"`.
   - **u2**: inspect without any `PLANTUML_SECURITY_PROFILE` entry → exit 1, `PLANTUML_SECURITY_PROFILE is not set (the image default is INTERNET)`.
   - **u3**: inspect `PLANTUML_SECURITY_PROFILE=ALLOWLIST`, service allowlisting **other** entries only (the canary is refused, behavioural half passes) → exit 1, `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"` (contract row: canary entry not allowlisted).
   - **u4** (B3): inspect `PLANTUML_SECURITY_PROFILE=SANDBOX` **plus** `JAVA_TOOL_OPTIONS=-DPLANTUML_SECURITY_PROFILE=INTERNET` (the form the pinned jar actually reads; also a row with `-Dplantuml.security.profile=INTERNET`) → exit 1, `configured through Java system properties` (fails closed like the declared modes).
   - **u5** (B6): `DK_FAKE_DOCKER_INSPECT_FAIL=1` (WP02 switch: only `inspect` fails; the `exec` probe still works, so the behavioural check passes) → exit 1, `could not read the service configuration` (fail closed).
   - Each of u1–u5 asserts its own substring and that stdout has **no** `OK —` line; u0 asserts byte equality with the golden.
8. US1 AS4 (analyze A18): allowlist declared, fake ALLOWLIST service; a render of an undeclared URL through the fake is refused (fake-only proof; the real refusal is the service's behaviour, observed in the CI lane for the denied path).

### T060 – Manual mutation record

**Steps**:
1. For each of rows a, b, c1, c2, c3, c4, i, ii: delete (locally) the code in `src/scripts/plantuml-mode-check.mjs` (or `plantuml-service-config.mjs` for reading) that implements that half, run the table, confirm that row (and only that row besides the baseline where relevant) turns red, revert.
2. Record the result in a comment block above the table: `row → file:line removed → rows that turned red`.

## Test Strategy

Black-box through the CLI; stable substrings only; presence plus absence per row. Free ports. The mutation record is the evidence that each half is load-bearing (DIRECTIVE_041).

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-include-check-halves.test.ts`, then the full suite.

## Definition of Done

- [ ] Rows **a, b, c1, c2, c3, c4, i, ii** plus the two baselines (allowlist, internet) exist by those names; each asserts its own substring and the absence of every other row's substring.
- [ ] Mutation record present with file:line per row; the reviewer re-runs two rows of it (see Reviewer Guidance).
- [ ] NFR-001: the declared-entry server logs **0** requests on the passing run **and** the `strayPath` variant exits 1 with `the canary received a request outside its two paths`.
- [ ] Docker missing uses `pathMode: 'node-only'` (only a `node` symlink on `PATH`); docker erroring uses `DK_FAKE_DOCKER_FAIL=1`; both exit 1 with `could not read the service configuration`.
- [ ] Edge cases 1–9 and T037 items 3–8 green, including unset-profile rows u0–u5.
- [ ] Stability: `pnpm test` (full suite, default workers) passes three consecutive runs.
- [ ] `grep -n 18091 src/tests/plantuml-include-check-halves.test.ts` returns nothing.
- [ ] No file outside the owned test file changed.

## Risks

- A row that cannot fail for exactly one reason means the half is not independently proven; report it, never loosen the absence loop.
- The node-only PATH must still let the CLI start: spawn with `process.execPath` as the command, so only `docker` resolution is affected.

## Reviewer Guidance

- Re-do two rows of the mutation record yourself (delete the cited lines, run the file, confirm the row goes red, revert).
- Check every substring against contracts/include-check-cli.md.

## Requirement trace

| Requirement | Subtask |
|---|---|
| FR-004 (a)(b)(c), FR-006 | T035, T060 |
| FR-011, FR-002, edge cases 1–9 | T036 |
| Edge case 10 (empty service-allowlist item) | T035 row c4 |
| NFR-001 | T037.1 |
| C-003 | T037.5 |

## Implement command

```bash
spec-kitty agent action implement WP12 --agent claude --mission plantuml-external-opt-in-01M6F052
```
